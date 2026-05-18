"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDateFr } from "@/lib/dates";
import {
  CalendarDays,
  CheckCircle,
  ChevronRight,
  MapPin,
  Plus,
  Stethoscope,
  User,
} from "lucide-react";
import AddConsultationModal from "./AddConsultationModal";

interface ConsultationRow {
  id: string;
  consultation_date: string;
  doctor_name: string | null;
  consultation_type: string | null;
  hospital: string | null;
  status: string;
}

interface CareTeamMember {
  name?: string;
  specialty?: string;
  hospital?: string;
}

interface Props {
  familyId: string;
  upcoming: ConsultationRow[];
  past: ConsultationRow[];
  careTeam: CareTeamMember[];
}

type Tab = "upcoming" | "past";

/**
 * Page principale Consultations : vue liste (à venir + passées) avec un
 * CTA "+ Ajouter" qui ouvre un modal. Plus de gros formulaire inline.
 */
export default function ConsultationClient({
  familyId,
  upcoming,
  past,
  careTeam,
}: Props) {
  const [tab, setTab] = useState<Tab>(
    upcoming.length > 0 ? "upcoming" : past.length > 0 ? "past" : "upcoming",
  );
  const [adding, setAdding] = useState(false);

  const rows = useMemo(
    () => (tab === "upcoming" ? upcoming : past),
    [tab, upcoming, past],
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 pr-12 md:pr-0">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Consultations</h1>
          <p className="text-sm text-muted mt-1">
            Rendez-vous médicaux à venir et passés. Claude prépare des
            questions ciblées avant chaque consultation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-ink text-canvas text-sm hover:bg-ink/90"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </button>
      </header>

      {/* Tabs à venir / passées */}
      <nav className="flex gap-1 border-b border-hairline -mb-px">
        <TabButton
          active={tab === "upcoming"}
          onClick={() => setTab("upcoming")}
          label="À venir"
          count={upcoming.length}
        />
        <TabButton
          active={tab === "past"}
          onClick={() => setTab("past")}
          label="Passées"
          count={past.length}
        />
      </nav>

      <div className="pt-2">
        {rows.length === 0 ? (
          <EmptyState
            tab={tab}
            onAdd={() => setAdding(true)}
          />
        ) : (
          <ul className="space-y-2">
            {rows.map((c) => (
              <ConsultationRowCard key={c.id} row={c} />
            ))}
          </ul>
        )}
      </div>

      {adding && (
        <AddConsultationModal
          familyId={familyId}
          careTeam={careTeam}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-sm border-b-2 transition-colors ${
        active
          ? "border-ink text-ink"
          : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {label}
      {count > 0 && (
        <span className="ml-1.5 text-[10px] text-muted">({count})</span>
      )}
    </button>
  );
}

function ConsultationRowCard({ row: c }: { row: ConsultationRow }) {
  const isPast = c.status === "completed";
  return (
    <li>
      <Link
        href={`/consultation/${c.id}`}
        className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
          isPast
            ? "border-hairline bg-canvas-soft hover:bg-surface-card"
            : "border-hairline bg-surface-card hover:bg-canvas-soft"
        }`}
      >
        <div
          className={`shrink-0 w-9 h-9 rounded-md flex items-center justify-center ${
            isPast ? "bg-success/10 text-success" : "bg-blue-500/10 text-blue-600"
          }`}
        >
          {isPast ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Stethoscope className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-medium text-ink">
              {c.consultation_type
                ? c.consultation_type[0].toUpperCase() +
                  c.consultation_type.slice(1)
                : "Consultation"}
            </span>
            {isPast && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-success/10 text-success">
                Terminée
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted mt-0.5">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {formatDateFr(c.consultation_date)}
            </span>
            {c.doctor_name && (
              <>
                <span className="text-muted-soft">·</span>
                <span className="inline-flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {c.doctor_name}
                </span>
              </>
            )}
            {c.hospital && (
              <>
                <span className="text-muted-soft">·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {c.hospital}
                </span>
              </>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted shrink-0" />
      </Link>
    </li>
  );
}

function EmptyState({
  tab,
  onAdd,
}: {
  tab: Tab;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-hairline bg-canvas-soft p-10 text-center">
      <Stethoscope className="w-8 h-8 mx-auto text-muted-soft mb-3" />
      <p className="text-sm text-muted italic">
        {tab === "upcoming"
          ? "Aucune consultation à venir."
          : "Aucune consultation passée."}
      </p>
      {tab === "upcoming" && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-ink text-canvas text-sm hover:bg-ink/90"
        >
          <Plus className="w-4 h-4" />
          Ajouter une consultation
        </button>
      )}
    </div>
  );
}
