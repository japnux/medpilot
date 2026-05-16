#!/usr/bin/env node
/**
 * Seed initial du changelog (sans IA) — backfill rapide via heuristique
 * sur les messages de commit. L'utilisateur peut ensuite cliquer
 * « Synchroniser depuis GitHub » pour régénérer en mode Haiku.
 *
 * Produit du SQL pretty-printé à exécuter via le MCP Supabase.
 *
 * Usage : node scripts/seed-changelog.mjs > /tmp/seed.sql
 */

import { execSync } from "node:child_process";

const log = execSync(
  "git log --all --format='%H|%aI|%an|%s' -300",
  { encoding: "utf8" },
);

function classify(msg) {
  const m = msg.toLowerCase();
  // Patterns internes (non-visibles)
  if (
    /\b(clean|cleanup|refacto|refactor|types|typo|fix lint|fix typescript|ci|build|deps|dependencies|chore)\b/i.test(
      msg,
    ) ||
    msg.startsWith("Console admin") // pas user-facing
  ) {
    return { category: "internal", user_visible: false };
  }
  if (/\bfix\b/i.test(msg)) return { category: "fix", user_visible: true };
  if (/^module\b|nouveau|nouvelle|ajout/i.test(m))
    return { category: "feature", user_visible: true };
  return { category: "improvement", user_visible: true };
}

function cleanTitle(msg) {
  let t = msg
    // Strip prefixes techniques courants
    .replace(/^(fix|feat|chore|refacto|refactor|docs|test|build|ci)[:\s]\s*/i, "")
    .replace(/^Module\s+\d+\s*[—-]\s*/, "")
    // Capitalisation
    .trim();
  if (t.length > 0) t = t[0].toUpperCase() + t.slice(1);
  // Tronque à 100 chars max
  if (t.length > 100) t = t.slice(0, 97) + "…";
  return t;
}

const lines = log.trim().split("\n");
const rows = [];
for (const line of lines) {
  const [sha, date, author, ...rest] = line.split("|");
  const msg = rest.join("|");
  if (!sha || !msg) continue;
  const { category, user_visible } = classify(msg);
  rows.push({
    sha,
    date,
    author,
    msg,
    title: cleanTitle(msg),
    category,
    user_visible,
  });
}

// Génère le SQL upsert
const escape = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const sql = rows
  .map(
    (r) =>
      `(${escape(r.sha)}, ${escape(r.date)}, ${escape(r.msg)}, ${escape(r.author)}, ${escape(r.title)}, null, ${escape(r.category)}, ${r.user_visible}, ${escape(r.date)}, null)`,
  )
  .join(",\n");

console.log(`insert into public.changelog_entries
  (commit_sha, commit_date, commit_message, commit_author, title, summary, category, user_visible, published_at, generated_model)
values
${sql}
on conflict (commit_sha) do nothing;`);
