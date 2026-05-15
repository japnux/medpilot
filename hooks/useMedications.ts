"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { Medication } from "@/lib/medications-helpers";

/**
 * Hook realtime pour la liste des médicaments d'une famille.
 * - Tient un état local synchronisé avec Postgres via Supabase Realtime
 *   (channel filtré par family_id).
 * - Retourne aussi un setter optimiste : les composants peuvent l'utiliser
 *   pour patcher la liste avant que le payload realtime n'arrive (UX rapide).
 */
export function useMedications(
  familyId: string,
  initial: Medication[],
): {
  medications: Medication[];
  setMedications: React.Dispatch<React.SetStateAction<Medication[]>>;
} {
  const [medications, setMedications] = useState<Medication[]>(initial);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`medications:${familyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medications",
          filter: `family_id=eq.${familyId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const next = payload.new as Medication;
            setMedications((prev) => {
              if (prev.some((m) => m.id === next.id)) return prev;
              return [next, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            const next = payload.new as Medication;
            setMedications((prev) =>
              prev.map((m) => (m.id === next.id ? next : m)),
            );
          } else if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string }).id;
            if (!oldId) return;
            setMedications((prev) => prev.filter((m) => m.id !== oldId));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId]);

  return { medications, setMedications };
}
