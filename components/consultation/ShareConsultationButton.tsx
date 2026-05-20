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
    const blocks: string[] = [];

    // En-tête (un seul titre — pas de title passé à navigator.share)
    const typeLabel = consultationType
      ? consultationType[0].toUpperCase() + consultationType.slice(1)
      : "Consultation";
    const headerLines = [
      `🩺 *Consultation ${typeLabel}*`,
      `📅 ${formatDateFr(consultationDate)}`,
    ];
    const subParts = [doctorName, hospital].filter(Boolean);
    if (subParts.length > 0) headerLines.push(subParts.join(" · "));
    blocks.push(headerLines.join("\n"));

    if (prep?.consultation_summary) {
      blocks.push(`_${prep.consultation_summary}_`);
    }

    // Questions (avec réponses si déjà notées)
    if (prep?.questions && prep.questions.length > 0) {
      const lines = ["❓ *Questions à poser*", ""];
      prep.questions.forEach((q, i) => {
        const star = q.priority === "high" ? " ⭐" : "";
        lines.push(`${i + 1}. ${q.question}${star}`);
        if (q.answer && q.answer.trim()) {
          lines.push(`   ↳ ${q.answer.trim()}`);
        }
      });
      blocks.push(lines.join("\n"));
    }

    // Documents à apporter
    if (prep?.documents_to_bring && prep.documents_to_bring.length > 0) {
      const lines = ["📄 *Documents à apporter*", ""];
      for (const d of prep.documents_to_bring) lines.push(`• ${d}`);
      blocks.push(lines.join("\n"));
    }

    // À documenter pendant le RDV
    if (
      prep?.watch_for_during_consult &&
      prep.watch_for_during_consult.length > 0
    ) {
      const lines = ["✏️ *À noter pendant le RDV*", ""];
      for (const w of prep.watch_for_during_consult) lines.push(`• ${w}`);
      blocks.push(lines.join("\n"));
    }

    blocks.push("🌿 Préparé avec MedPilot");

    // Séparateur VISIBLE entre les blocs : certaines apps (WhatsApp,
    // Messages…) écrasent les lignes vides consécutives, donc une simple
    // succession de \n ne suffit pas à aérer. Une ligne de caractères
    // garantit une coupure nette quoi qu'il arrive.
    const separator = "\n\n┄┄┄┄┄┄┄┄┄┄\n\n";
    return blocks.join(separator);
  }

  async function share() {
    const message = buildMessage();

    // 1. API de partage native (mobile : ouvre la feuille de partage iOS/Android
    //    avec WhatsApp dedans). On ne passe QUE `text` — passer aussi `title`
    //    fait que WhatsApp préfixe le titre au message → double titre.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: message });
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
