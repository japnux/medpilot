/**
 * Types d'événements de la timeline avec leurs métadonnées d'affichage.
 */

import type { EventType } from "@/types/database";
import {
  Scissors,
  Stethoscope,
  TestTube,
  Scan,
  Microscope,
  Pill,
  SlidersHorizontal,
  CheckCircle,
  Users,
  FlaskConical,
  Building2,
  AlertTriangle,
  Circle,
  type LucideIcon,
} from "lucide-react";

export interface EventTypeMeta {
  label: string;
  color: string;
  icon: LucideIcon;
}

export const EVENT_TYPES: Record<EventType, EventTypeMeta> = {
  surgery: { label: "Chirurgie", color: "#ef4444", icon: Scissors },
  consultation: { label: "Consultation", color: "#3b82f6", icon: Stethoscope },
  biology: { label: "Bilan biologique", color: "#10b981", icon: TestTube },
  imaging: { label: "Imagerie", color: "#8b5cf6", icon: Scan },
  anapath: { label: "Anatomopathologie", color: "#f97316", icon: Microscope },
  treatment_start: { label: "Début traitement", color: "#06b6d4", icon: Pill },
  treatment_adjustment: {
    label: "Ajustement traitement",
    color: "#f59e0b",
    icon: SlidersHorizontal,
  },
  treatment_end: { label: "Fin traitement", color: "#64748b", icon: CheckCircle },
  rcp: { label: "RCP", color: "#a855f7", icon: Users },
  clinical_trial: { label: "Essai clinique", color: "#ec4899", icon: FlaskConical },
  hospitalization: { label: "Hospitalisation", color: "#dc2626", icon: Building2 },
  emergency: { label: "Urgence", color: "#991b1b", icon: AlertTriangle },
  other: { label: "Autre", color: "#94a3b8", icon: Circle },
};

export function getEventMeta(type: EventType | string): EventTypeMeta {
  return EVENT_TYPES[type as EventType] ?? EVENT_TYPES.other;
}
