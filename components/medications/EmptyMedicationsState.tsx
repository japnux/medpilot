import { Pill } from "lucide-react";

interface Props {
  onAdd: () => void;
}

export default function EmptyMedicationsState({ onAdd }: Props) {
  return (
    <div className="rounded-lg border border-dashed border-hairline bg-canvas p-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-surface-card flex items-center justify-center mb-4">
        <Pill className="w-6 h-6 text-muted" />
      </div>
      <p className="text-base font-medium text-ink">
        Aucun médicament renseigné
      </p>
      <p className="text-sm text-muted mt-1 mb-5">
        Ajoutez les traitements en cours pour que les analyses IA en tiennent compte.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-ink text-canvas text-sm font-medium hover:opacity-90"
      >
        Ajouter le premier médicament
      </button>
    </div>
  );
}
