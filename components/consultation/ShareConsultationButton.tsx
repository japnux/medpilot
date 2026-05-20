"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import type { ConsultationPrepResult } from "@/lib/prompts";
import { formatDateFr } from "@/lib/dates";

interface Props {
  consultationType: string | null;
  consultationDate: string;
  doctorName: string | null;
  hospital: string | null;
  prep: ConsultationPrepResult | null;
}

/**
 * Bouton "Partager" : construit un message texte mis en forme pour
 * WhatsApp (gras *...*, listes) à partir de la prep consultation et
 * l'envoie via l'API de partage native (mobile) ou copie dans le
 * presse-papier (desktop / fallback).
 */
export default function ShareConsultationButton({
  consultationType,
  consultationDate,
  doctorName,
  hospital,
  prep,
}: Props) {
  const [copied, setCopied] = useState(false);

  function buildMessage(): string {
    const lines: string[] = [];

    // En-tête
    const typeLabel = consultationType
      ? consultationType[0].toUpperCase() + consultationType.slice(1)
      : "Consultation";
    lines.push(`*Consultation ${typeLabel} — ${formatDateFr(consultationDate)}*`);
    const subParts = [doctorName, hospital].filter(Boolean);
    if (subParts.length > 0) lines.push(subParts.join(" · "));

    if (prep?.consultation_summary) {
      lines.push("");
      lines.push(`_${prep.consultation_summary}_`);
    }

    // Questions (avec réponses si déjà notées)
    if (prep?.questions && prep.questions.length > 0) {
      lines.push("");
      lines.push("*Questions à poser*");
      prep.questions.forEach((q, i) => {
        const star = q.priority === "high" ? " ⭐" : "";
        lines.push(`${i + 1}. ${q.question}${star}`);
        if (q.answer && q.answer.trim()) {
          lines.push(`   ↳ ${q.answer.trim()}`);
        }
      });
    }

    // Documents à apporter
    if (prep?.documents_to_bring && prep.documents_to_bring.length > 0) {
      lines.push("");
      lines.push("*Documents à apporter*");
      for (const d of prep.documents_to_bring) lines.push(`• ${d}`);
    }

    // À documenter pendant le RDV
    if (
      prep?.watch_for_during_consult &&
      prep.watch_for_during_consult.length > 0
    ) {
      lines.push("");
      lines.push("*À noter pendant le RDV*");
      for (const w of prep.watch_for_during_consult) lines.push(`• ${w}`);
    }

    lines.push("");
    lines.push("— Préparé avec MedPilot");

    return lines.join("\n");
  }

  async function share() {
    const message = buildMessage();
    const title = `Consultation ${consultationType ?? ""} — ${formatDateFr(consultationDate)}`;

    // 1. API de partage native (mobile : ouvre la feuille de partage iOS/Android
    //    avec WhatsApp dedans). On teste navigator.share.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: message });
        return;
      } catch (e) {
        // L'utilisateur a annulé le partage : on ne fait rien.
        if (e instanceof Error && e.name === "AbortError") return;
        // Autre erreur : on bascule sur le fallback copie.
      }
    }

    // 2. Fallback desktop : copie dans le presse-papier.
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Dernier recours : ouvre WhatsApp Web avec le texte pré-rempli.
      const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  if (!prep) return null;

  return (
    <button
      type="button"
      onClick={share}
      className="shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-hairline-strong text-body hover:text-ink hover:bg-surface-card"
      title="Partager la préparation (WhatsApp, copier…)"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-success" />
          Copié
        </>
      ) : (
        <>
          <Share2 className="w-3.5 h-3.5" />
          Partager
        </>
      )}
    </button>
  );
}
