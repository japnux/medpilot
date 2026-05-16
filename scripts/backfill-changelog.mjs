#!/usr/bin/env node
/**
 * Script de backfill du changelog.
 *
 * Lit tous les commits du repo public japnux/medpilot via l'API GitHub,
 * génère un changelog user-friendly via Claude Haiku, et upsert dans la table
 * `changelog_entries` via la clé service_role.
 *
 * Usage : node scripts/backfill-changelog.mjs [limit]
 *   limit : nombre max de commits à traiter (def 200)
 */

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";

// Charge .env.local (tolère valeurs entre guillemets, vides, commentaires)
const env = fs.readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq === -1) continue;
  const key = line.slice(0, eq).trim();
  let val = line.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (key) process.env[key] = val;
}

const REPO = "japnux/medpilot";
const BATCH_SIZE = 25;
const LIMIT = Number(process.argv[2]) || 200;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 1. SHAs déjà en base
const { data: existing } = await supabase
  .from("changelog_entries")
  .select("commit_sha");
const existingShas = new Set((existing ?? []).map((e) => e.commit_sha));
console.log(`[backfill] ${existingShas.size} entries déjà en base`);

// 2. Fetch commits depuis GitHub
const allCommits = [];
const perPage = 100;
const pages = Math.ceil(LIMIT / perPage);
for (let p = 1; p <= pages; p++) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/commits?per_page=${perPage}&page=${p}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "medpilot-changelog-backfill",
      },
    },
  );
  if (!res.ok) {
    console.error(`GitHub API ${res.status}:`, await res.text());
    process.exit(1);
  }
  const arr = await res.json();
  allCommits.push(...arr);
  if (arr.length < perPage) break;
}
console.log(`[backfill] ${allCommits.length} commits récupérés depuis GitHub`);

const toProcess = allCommits
  .filter((c) => !existingShas.has(c.sha))
  .slice(0, LIMIT);
console.log(`[backfill] ${toProcess.length} commits à traiter`);

if (toProcess.length === 0) {
  console.log("[backfill] Tout est à jour.");
  process.exit(0);
}

// 3. Génération par batch
const SYSTEM = `Tu reçois une liste de commits Git d'une application web médicale (MedPilot, aide aux familles confrontées au cancer).

Pour chaque commit, génère un changelog user-friendly destiné aux utilisateurs finaux (proches d'un patient, non-techniques).

Règles :
- title : phrase courte (≤ 70 caractères), claire, sans jargon technique, sans nom de fichier, sans préfixe technique (pas de "Fix", "Refacto"…). Ex: "Suivi quotidien des symptômes amélioré".
- summary : 1 phrase qui explique l'apport pour l'utilisateur (≤ 200 caractères). null si trivial.
- category : "feature" (nouvelle fonctionnalité visible), "improvement" (amélioration UX/perf visible), "fix" (correction de bug visible), "internal" (technique non visible : refacto, clean code, types, build).
- user_visible : false pour les commits purement techniques (refacto, types, dépendances, fix linter, doc, tests, CI, infrastructure). True si l'utilisateur peut percevoir un changement.
- Garde le commit_sha tel quel.

Réponds UNIQUEMENT en JSON, format :
{ "entries": [ { "commit_sha": "abc...", "title": "...", "summary": "..." | null, "category": "feature|improvement|fix|internal", "user_visible": true|false }, ... ] }`;

const allEntries = [];
for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
  const batch = toProcess.slice(i, i + BATCH_SIZE);
  const userMsg = batch
    .map((c) => `## ${c.sha}\n${c.commit.message.trim()}`)
    .join("\n\n---\n\n");

  console.log(
    `[backfill] batch ${i / BATCH_SIZE + 1}/${Math.ceil(toProcess.length / BATCH_SIZE)} (${batch.length} commits)`,
  );

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  // Strip fences ```json …
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  allEntries.push(...(parsed.entries ?? []));
}

console.log(`[backfill] ${allEntries.length} entries générées par Claude`);

// 4. Upsert
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
  .filter(Boolean);

const { error } = await supabase
  .from("changelog_entries")
  .upsert(rows, { onConflict: "commit_sha" });

if (error) {
  console.error("[backfill] Erreur upsert :", error);
  process.exit(1);
}

console.log(`[backfill] ✓ ${rows.length} entries upserted`);
