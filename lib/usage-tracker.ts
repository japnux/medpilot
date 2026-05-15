/**
 * Tracker des appels Anthropic : calcule le coût et persiste dans
 * la table `api_usage_logs` via la clé service_role.
 *
 * Pattern inspiré du projet health-dashboard, adapté pour MedPilot
 * (multi-famille, traçage erreurs, durée).
 *
 * À utiliser dans les API routes après chaque appel Claude.
 */

import { createServiceClient } from "@/lib/supabase/service";
import type { ClaudeModel } from "@/lib/anthropic";

/**
 * Tarifs Anthropic en USD par million de tokens (input / output).
 * Source : tarifs publics au 2026-05.
 * → mise à jour à faire si Anthropic change les prix.
 */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-7": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

/** Calcule le coût d'un appel à partir des tokens. */
export function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model];
  if (!p) return 0;
  return (
    (inputTokens / 1_000_000) * p.input +
    (outputTokens / 1_000_000) * p.output
  );
}

export interface LogApiUsageInput {
  endpoint: string;
  model: ClaudeModel | string;
  input_tokens: number;
  output_tokens: number;
  cached?: boolean;
  family_id?: string | null;
  user_id?: string | null;
  success?: boolean;
  error_message?: string | null;
  duration_ms?: number | null;
}

/**
 * Log un appel IA en base. Ne throw jamais : un échec de logging ne doit
 * pas faire échouer l'appel utilisateur.
 */
export async function logApiUsage(input: LogApiUsageInput): Promise<void> {
  try {
    const cost = computeCost(
      input.model,
      input.input_tokens,
      input.output_tokens,
    );
    const service = createServiceClient();
    await service.from("api_usage_logs").insert({
      endpoint: input.endpoint,
      model: input.model,
      input_tokens: input.input_tokens,
      output_tokens: input.output_tokens,
      cost_usd: cost,
      cached: input.cached ?? false,
      family_id: input.family_id ?? null,
      user_id: input.user_id ?? null,
      success: input.success ?? true,
      error_message: input.error_message ?? null,
      duration_ms: input.duration_ms ?? null,
    });
  } catch (err) {
    // Log silencieux : on ne casse jamais l'appel parent.
    console.error("[usage-tracker] insert failed:", err);
  }
}
