"use client";

import { useState } from "react";
import {
  Stethoscope,
  FileText,
  Calendar,
  Pencil,
  Trash2,
  Square,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import MedicationStatusBadge from "./MedicationStatusBadge";
import {
  formatDateFR,
  formatPosologyInline,
  getRouteLabel,
  type Medication,
} from "@/lib/medications-helpers";

interface Props {
  medication: Medication;
  onEdit: (m: Medication) => void;
  onStop: (m: Medication) => void;
  onDelete: (m: Medication) => void;
}

/**
 * Carte d'un médicament : identité, posologie, contexte clinique, dates, actions.
 * "Arrêter" est un raccourci vers l'édition pré-remplie (le form gère la date
 * de fin + raison).
 */
/** Liens officiels disponibles pour ce médicament, ordre fixe. */
function getLinks(m: Medication): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];
  if (m.wikipedia_url) links.push({ label: "Wikipedia", url: m.wikipedia_url });
  if (m.vidal_url) links.push({ label: "Vidal", url: m.vidal_url });
  if (m.ansm_url) links.push({ label: "ANSM", url: m.ansm_url });
  return links;
}

export default function MedicationCard({
  medication: m,
  onEdit,
  onStop,
  onDelete,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const links = getLinks(m);

  return (
    <div className="rounded-lg border border-hairline bg-canvas p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="text-base font-medium text-ink">{m.name}</h3>
            {m.brand_name && (
              <span className="text-sm text-muted">({m.brand_name})</span>
            )}
            {m.dosage && (
              <span className="text-sm text-muted">· {m.dosage}</span>
            )}
            {m.form && <span className="text-sm text-muted">· {m.form}</span>}
          </div>
          <p className="text-sm text-body mt-1.5">{m.posology}</p>
          {m.route !== "oral" && (
            <p className="text-xs text-muted mt-1">
              Voie : {getRouteLabel(m.route)}
            </p>
          )}
        </div>
        <MedicationStatusBadge status={m.status} />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {m.indication && (
          <span className="inline-flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            {m.indication}
          </span>
        )}
        {m.prescriber && (
          <span className="inline-flex items-center gap-1">
            <Stethoscope className="w-3.5 h-3.5" />
            {m.prescriber}
          </span>
        )}
        {m.started_at && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Depuis le {formatDateFR(m.started_at)}
          </span>
        )}
        {m.ended_at && m.status === "stopped" && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Arrêté le {formatDateFR(m.ended_at)}
          </span>
        )}
      </div>

      {m.status_reason && (
        <p className="mt-2 text-xs text-muted italic">
          Raison : {m.status_reason}
        </p>
      )}

      {m.notes && (
        <p className="mt-2 text-xs text-body whitespace-pre-line">{m.notes}</p>
      )}

      {/* Effets indésirables : section dépliable */}
      {m.known_side_effects && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setSideOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-body hover:text-ink"
            aria-expanded={sideOpen}
          >
            {sideOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
            Effets indésirables connus
          </button>
          {sideOpen && (
            <p className="mt-1.5 ml-5 text-xs text-body whitespace-pre-line">
              {m.known_side_effects}
            </p>
          )}
        </div>
      )}

      {/* Liens officiels */}
      {links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-card text-xs text-body hover:text-ink"
              title={`Voir ${l.label}`}
            >
              <ExternalLink className="w-3 h-3" />
              {l.label}
            </a>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-hairline flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onEdit(m)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-body hover:text-ink hover:bg-surface-card"
        >
          <Pencil className="w-3.5 h-3.5" />
          Éditer
        </button>
        {m.status === "active" && (
          <button
            type="button"
            onClick={() => onStop(m)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-body hover:text-ink hover:bg-surface-card"
          >
            <Square className="w-3.5 h-3.5" />
            Arrêter
          </button>
        )}
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted hover:text-red-700 hover:bg-red-50 ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Supprimer
          </button>
        ) : (
          <div className="ml-auto inline-flex items-center gap-2 text-xs">
            <span className="text-muted">Confirmer ?</span>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onDelete(m);
              }}
              className="px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700"
            >
              Supprimer
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-2 py-1 rounded-md text-muted hover:text-ink"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
