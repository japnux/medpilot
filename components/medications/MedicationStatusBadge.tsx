import type { MedicationStatus } from "@/types/database";
import {
  getStatusBadgeClass,
  getStatusLabel,
} from "@/lib/medications-helpers";

interface Props {
  status: MedicationStatus;
}

export default function MedicationStatusBadge({ status }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(status)}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
      {getStatusLabel(status)}
    </span>
  );
}
