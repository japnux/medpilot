"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useMedications } from "@/hooks/useMedications";
import {
  countByStatus,
  type Medication,
} from "@/lib/medications-helpers";
import type { MedicationStatus } from "@/types/database";
import MedicationsList from "./MedicationsList";
import MedicationForm, { type CareTeamMember } from "./MedicationForm";
import EmptyMedicationsState from "./EmptyMedicationsState";

type Filter = "active" | "all" | "stopped" | "planned" | "paused";

const FILTER_TABS: { value: Filter; label: string }[] = [
  { value: "active", label: "Actifs" },
  { value: "all", label: "Tous" },
  { value: "planned", label: "Planifiés" },
  { value: "paused", label: "Suspendus" },
  { value: "stopped", label: "Arrêtés" },
];

interface Props {
  familyId: string;
  initialMedications: Medication[];
  patientFirstName: string | null;
  careTeam: CareTeamMember[];
}

export default function MedicationsClient({
  familyId,
  initialMedications,
  patientFirstName,
  careTeam,
}: Props) {
  const { medications, setMedications } = useMedications(
    familyId,
    initialMedications,
  );
  const [filter, setFilter] = useState<Filter>("active");
  const [editing, setEditing] = useState<Medication | null>(null);
  const [creating, setCreating] = useState<{ defaultStatus: MedicationStatus } | null>(
    null,
  );

  const counts = useMemo(() => countByStatus(medications), [medications]);

  const filtered = useMemo(() => {
    if (filter === "all") return medications;
    return medications.filter((m) => m.status === filter);
  }, [medications, filter]);

  function handleSaved(updated: Medication) {
    // Patch optimiste : on remplace ou on ajoute. L'event realtime peut arriver
    // après ; le hook se charge de la dédup.
    setMedications((prev) => {
      const idx = prev.findIndex((m) => m.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [updated, ...prev];
    });
  }

  async function handleDelete(m: Medication) {
    const prev = medications;
    setMedications((list) => list.filter((x) => x.id !== m.id));
    try {
      const res = await fetch(`/api/medications/${m.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Échec suppression");
    } catch {
      setMedications(prev);
      alert("Impossible de supprimer ce médicament.");
    }
  }

  const titleName = patientFirstName ? ` de ${patientFirstName}` : "";

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-medium text-ink">
            Médicaments{titleName}
          </h1>
          <p className="text-sm text-muted mt-1">
            {counts.active} actif{counts.active > 1 ? "s" : ""}
            {counts.planned > 0 && ` · ${counts.planned} planifié${counts.planned > 1 ? "s" : ""}`}
            {counts.paused > 0 && ` · ${counts.paused} suspendu${counts.paused > 1 ? "s" : ""}`}
            {counts.stopped > 0 && ` · ${counts.stopped} arrêté${counts.stopped > 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating({ defaultStatus: "active" })}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-ink text-canvas text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </button>
      </header>

      {medications.length === 0 ? (
        <EmptyMedicationsState
          onAdd={() => setCreating({ defaultStatus: "active" })}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {FILTER_TABS.map((t) => {
              const count =
                t.value === "all" ? medications.length : counts[t.value as MedicationStatus];
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setFilter(t.value)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors ${
                    filter === t.value
                      ? "bg-ink text-canvas"
                      : "bg-surface-card text-body hover:text-ink"
                  }`}
                >
                  {t.label}
                  <span className="ml-1 opacity-60">{count}</span>
                </button>
              );
            })}
          </div>

          <MedicationsList
            medications={filtered}
            onEdit={(m) => setEditing(m)}
            onStop={(m) => setEditing({ ...m, status: "stopped" })}
            onDelete={handleDelete}
          />
        </>
      )}

      {(editing || creating) && (
        <MedicationForm
          initial={editing}
          existing={medications}
          defaultStatus={creating?.defaultStatus ?? "active"}
          careTeam={careTeam}
          onClose={() => {
            setEditing(null);
            setCreating(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
