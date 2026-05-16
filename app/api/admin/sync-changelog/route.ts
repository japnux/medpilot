import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/service";
import { getAdminContext } from "@/lib/admin";
import { parseJsonResponse } from "@/lib/anthropic";
import { logApiUsage } from "@/lib/usage-tracker";

export const runtime = "nodejs";
export const maxDuration = 120;

const REPO = "japnux/medpilot";
const BATCH_SIZE = 25;

interface GhCommit {
  sha: string;
  commit: {
    author: { name: string; date: string } | null;
    message: string;
  };
}

interface ProcessedEntry {
  commit_sha: string;
  title: string;
  summary: string | null;
  category: "feature" | "improvement" | "fix" | "internal";
  user_visible: boolean;
}

/**
 * POST /api/admin/sync-changelog
 *
 * Récupère les commits récents du repo public japnux/medpilot via l'API
 * GitHub, et pour chaque commit absent de `changelog_entries`, génère via
 * Claude Haiku une formulation user-friendly (titre + résumé + catégorie).
 *
 * Body : { limit?: number } — nombre max de commits à traiter (def 100).
 *
 * Idempotent : un commit déjà en base est ignoré (unique sur commit_sha).
 */
export async function POST(request: NextRequest) {
  const { user, isAdmin } = await getAdminContext();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Number(body?.limit) || 100, 300);

  const svc = createServiceClient();

  // 1. Lister les SHAs déjà en base
  const { data: existing } = await svc
    .from("changelog_entries")
    .select("commit_sha");
  const existingShas = new Set((existing ?? []).map((e) => e.commit_sha));

  // 2. Fetch commits depuis GitHub (pagination par 100)
  const allCommits: GhCommit[] = [];
  const perPage = 100;
  const pages = Math.ceil(limit / perPage);
  for (let p = 1; p <= pages; p++) {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/commits?per_page=${perPage}&page=${p}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "medpilot-changelog-sync",
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub API ${res.status}: ${await res.text()}` },
        { status: 502 },
      );
    }
    const arr = (await res.json()) as GhCommit[];
    allCommits.push(...arr);
    if (arr.length < perPage) break;
  }

  // 3. Filtrer ceux pas encore traités
  const toProcess = allCommits
    .filter((c) => !existingShas.has(c.sha))
    .slice(0, limit);

  if (toProcess.length === 0) {
    return NextResponse.json({
      ok: true,
      already_synced: existingShas.size,
      processed: 0,
      message: "Tout est à jour",
    });
  }

  // 4. Génération par batch via Haiku
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY manquant" }, { status: 500 });
  }
  const anthropic = new Anthropic({ apiKey });

  const allEntries: ProcessedEntry[] = [];
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    const entries = await generateBatch(anthropic, batch, user.id);
    allEntries.push(...entries);
  }

  // 5. Upsert
  const rows = toProcess
    .map((c) => {
      const entry = allEntries.find((e) => e.commit_sha === c.sha);
      if (!entry) return null;
      return {
        commit_sha: c.sha,
        commit_date: c.commit.author?.date ?? new Date().toISOString(),
        commit_message: c.commit.message,
        commit_author: c.commit.author?.name ?? null,
        title: entry.title,
        summary: entry.summary,
        category: entry.category,
        user_visible: entry.user_visible,
        published_at: c.commit.author?.date ?? new Date().toISOString(),
        generated_model: "claude-haiku-4-5-20251001",
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length > 0) {
    const { error } = await svc
      .from("changelog_entries")
      .upsert(rows, { onConflict: "commit_sha" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    fetched: allCommits.length,
    new_entries: rows.length,
    already_synced: existingShas.size,
  });
}

async function generateBatch(
  anthropic: Anthropic,
  batch: GhCommit[],
  userId: string,
): Promise<ProcessedEntry[]> {
  const system = `Tu reçois une liste de commits Git d'une application web médicale (MedPilot, aide aux familles confrontées au cancer).

Pour chaque commit, génère un changelog user-friendly destiné aux utilisateurs finaux (proches d'un patient, non-techniques).

Règles :
- title : phrase courte (≤ 70 caractères), claire, sans jargon technique, sans nom de fichier, sans préfixe technique (pas de "Fix", "Refacto"…). Ex: "Suivi quotidien des symptômes amélioré".
- summary : 1 phrase qui explique l'apport pour l'utilisateur (≤ 200 caractères). null si trivial.
- category : "feature" (nouvelle fonctionnalité visible), "improvement" (amélioration UX/perf visible), "fix" (correction de bug visible), "internal" (technique non visible : refacto, clean code, types, build).
- user_visible : false pour les commits purement techniques (refacto, types, dépendances, fix linter, doc, tests, CI, infrastructure). True si l'utilisateur peut percevoir un changement.
- Garde le commit_sha tel quel.

Réponds UNIQUEMENT en JSON, format :
{ "entries": [ { "commit_sha": "abc...", "title": "...", "summary": "..." | null, "category": "feature|improvement|fix|internal", "user_visible": true|false }, ... ] }`;

  const userMsg = batch
    .map((c) => `## ${c.sha}\n${c.commit.message.trim()}`)
    .join("\n\n---\n\n");

  const t0 = Date.now();
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userMsg }],
  });

  await logApiUsage({
    endpoint: "admin/sync-changelog",
    model: "claude-haiku-4-5-20251001",
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    user_id: userId,
    duration_ms: Date.now() - t0,
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const parsed = parseJsonResponse<{ entries: ProcessedEntry[] }>(text);
  return parsed.entries ?? [];
}
