/**
 * Wrapper Anthropic SDK pour les appels Claude côté serveur.
 *
 * - Sélection du modèle par tâche (Opus 4.7 pour analyse, Haiku 4.5 pour prep)
 * - Parsing robuste de JSON (strip fences ```, extraction par accolades)
 * - Gestion d'erreur uniforme
 *
 * À utiliser EXCLUSIVEMENT côté serveur (API routes).
 */

import Anthropic from "@anthropic-ai/sdk";

export type ClaudeModel =
  | "claude-opus-4-7"
  | "claude-haiku-4-5-20251001"
  | "claude-sonnet-4-6";

export interface CallClaudeOptions {
  /** Modèle à utiliser (par défaut : Opus 4.7). */
  model?: ClaudeModel;
  /** Prompt système. */
  system: string;
  /** Message utilisateur (le document, la question, etc.). */
  user: string;
  /**
   * PDF optionnel en base64 (sans préfixe data:). Si fourni, est envoyé
   * en content block `document` natif Claude — le modèle lit alors le PDF
   * directement (texte + images), idéal pour les scans non OCRisables.
   */
  pdf_base64?: string;
  /** Tokens max (défaut 4096). */
  max_tokens?: number;
}

export interface ClaudeJsonResult<T = unknown> {
  json: T;
  raw: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquant");
  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Appel Claude qui attend une réponse JSON.
 * Fait du parsing tolérant : strip ``` fences, extrait entre première { et dernière }.
 */
export async function callClaudeJson<T = unknown>(
  opts: CallClaudeOptions,
): Promise<ClaudeJsonResult<T>> {
  const client = getClient();

  // Si un PDF est fourni, on l'envoie en content block `document` (vision
  // multimodale Claude — supporte les scans). Sinon, simple message texte.
  const messages: Anthropic.MessageParam[] = opts.pdf_base64
    ? [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: opts.pdf_base64,
              },
            },
            { type: "text", text: opts.user },
          ],
        },
      ]
    : [{ role: "user", content: opts.user }];

  const response = await client.messages.create({
    model: opts.model ?? "claude-opus-4-7",
    max_tokens: opts.max_tokens ?? 4096,
    system: opts.system,
    messages,
  });

  // Concatène tous les blocs text
  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const json = parseJsonResponse<T>(raw);

  return {
    json,
    raw,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

/**
 * Parsing tolérant d'une réponse JSON de Claude.
 * Stratégies (en cascade) :
 *  1. Strip fences markdown ```json ... ```
 *  2. Tente JSON.parse direct
 *  3. Cherche le 1er `{` puis utilise un compteur d'accolades équilibré pour
 *     trouver le `}` correspondant (gère un préambule + suffixe parasite)
 *  4. Fallback : ancien comportement first `{` / last `}`
 */
export function parseJsonResponse<T = unknown>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  // Tentative 1 : parse direct (cas optimal)
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // continue
  }

  // Tentative 2 : extraction via compteur d'accolades depuis le 1er {
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = firstBrace; i < cleaned.length; i++) {
      const c = cleaned[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          const candidate = cleaned.slice(firstBrace, i + 1);
          try {
            return JSON.parse(candidate) as T;
          } catch {
            break;
          }
        }
      }
    }
  }

  // Tentative 3 : ancien comportement (first { / last })
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(cleaned.slice(first, last + 1)) as T;
    } catch {
      // tombe en erreur ci-dessous
    }
  }

  throw new Error(
    `Réponse Claude non parsable en JSON. Longueur ${raw.length}. Aperçu début : ${raw.slice(0, 300)}. Aperçu fin : ${raw.slice(-300)}`,
  );
}
