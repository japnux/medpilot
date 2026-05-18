"use client";

import MedicationCard from "./MedicationCard";
import type { Medication } from "@/lib/medications-helpers";
import type { DosageChangeRow } from "@/lib/medication-dosage-helpers";
import type { ScheduleStep } from "@/lib/medication-schedule";

interface Props {
  medications: Medication[];
  dosageChangesByMed: Record<string, DosageChangeRow[]>;
  scheduleByMed?: Record<string, ScheduleStep[]>;
  onEdit: (m: Medication) => void;
  onStop: (m: Medication) => void;
  onDelete: (m: Medication) => void;
  onChangeDosage: (m: Medication) => void;
}

export default function MedicationsList({
  medications,
  dosageChangesByMed,
  scheduleByMed = {},
  onEdit,
  onStop,
  onDelete,
  onChangeDosage,
}: Props) {
  if (medications.length === 0) {
    return (
      <p className="text-sm text-muted italic py-8 text-center">
        Aucun médicament dans cette catégorie.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {medications.map((m) => (
        <MedicationCard
          key={m.id}
          medication={m}
          dosageChanges={dosageChangesByMed[m.id] ?? []}
          schedule={scheduleByMed[m.id] ?? []}
          onEdit={onEdit}
          onStop={onStop}
          onDelete={onDelete}
          onChangeDosage={onChangeDosage}
        />
      ))}
    </div>
  );
}
