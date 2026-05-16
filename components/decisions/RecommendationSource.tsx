"use client";

import Link from "next/link";
import { FileText, BookOpen, Sparkles } from "lucide-react";
import type { RecommendationSource } from "@/lib/decisions";

/**
 * Affiche la source d'une recommandation : document signé, KB cancer, ou
 * suggestion Claude — avec niveau de confiance graphiquement marqué.
 */
export default function RecommendationSourceTag({
  source,
}: {
  source: RecommendationSource | null | undefined;
}) {
  if (!source || !source.type) return null;

  const confidenceColor =
    source.confidence === "high"
      ? "text-success border-success/40 bg-success/5"
      : source.confidence === "medium"
        ? "text-warning border-warning/40 bg-warning/5"
        : "text-muted border-hairline-strong bg-canvas-soft";

  const Icon =
    source.type === "document"
      ? FileText
      : source.type === "knowledge_base"
        ? BookOpen
        : Sparkles;

  const typeLabel =
    source.type === "document"
      ? "Recommandation médicale documentée"
      : source.type === "knowledge_base"
        ? "Protocole standard (knowledge base)"
        : "Suggestion contextuelle — à valider avec l'équipe";

  const href =
    source.type === "document" && source.source_id
      ? `/documents/${source.source_id}`
      : null;

  const inner = (
    <div className={`mt-2 text-[11px] border-l-2 pl-2 ${confidenceColor}`}>
      <div className="inline-flex items-center gap-1">
        <Icon className="w-3 h-3" />
        <span>{typeLabel}</span>
      </div>
      {source.source_label && (
        <p className="text-body mt-0.5">{source.source_label}</p>
      )}
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}
