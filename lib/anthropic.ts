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
 * Strip les fences markdown ```json ... ```, et tronque à la première { ... dernière }.
 */
export function parseJsonResponse<T = unknown>(raw: string): T {
  let s = raw.trim();
  // Strip fences markdown
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  // Extraire entre première { et dernière }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  try {
    return JSON.parse(s) as T;
  } catch (e) {
    throw new Error(
      `Réponse Claude non parsable en JSON. Aperçu : ${raw.slice(0, 200)}`,
    );
  }
}
