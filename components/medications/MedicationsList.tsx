"use client";

import MedicationCard from "./MedicationCard";
import type { Medication } from "@/lib/medications-helpers";

interface Props {
  medications: Medication[];
  onEdit: (m: Medication) => void;
  onStop: (m: Medication) => void;
  onDelete: (m: Medication) => void;
}

export default function MedicationsList({
  medications,
  onEdit,
  onStop,
  onDelete,
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
          onEdit={onEdit}
          onStop={onStop}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
