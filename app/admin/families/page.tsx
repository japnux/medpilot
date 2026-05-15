import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

interface MemberRow {
  user_id: string;
  role: string | null;
  display_name: string | null;
  relation: string | null;
}

interface FamilyRow {
  id: string;
  name: string | null;
  created_at: string;
}

interface ProfileRow {
  family_id: string;
  cancer_type: string | null;
  cancer_label: string | null;
  patient_first_name: string | null;
  diagnosis_date: string | null;
}

/**
 * /admin/families — Liste de toutes les familles + leurs membres + profil cancer.
 */
export default async function AdminFamiliesPage() {
  const svc = createServiceClient();

  const [familiesRes, profilesRes, membersRes, biologyRes, docsRes] =
    await Promise.all([
      svc
        .from("families")
        .select("id, name, created_at")
        .order("created_at", { ascending: false }),
      svc
        .from("cancer_profiles")
        .select(
          "family_id, cancer_type, cancer_label, patient_first_name, diagnosis_date",
        ),
      svc
        .from("family_members")
        .select("family_id, user_id, role, display_name, relation"),
      svc
        .from("biology_records")
        .select("family_id", { count: "exact", head: false }),
      svc
        .from("medical_documents")
        .select("family_id", { count: "exact", head: false }),
    ]);

  const families: FamilyRow[] = (familiesRes.data ?? []) as FamilyRow[];
  const profiles = profilesRes.data ?? [];
  const members = (membersRes.data ?? []) as Array<MemberRow & { family_id: string }>;

  // Récupérer les emails des users via auth admin API
  const userIds = Array.from(new Set(members.map((m) => m.user_id)));
  const usersById: Record<string, { email: string | null }> = {};
  // Pagination 1 page suffit pour la plupart des installations
  const { data: usersList } = await svc.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  for (const u of usersList?.users ?? []) {
    if (userIds.includes(u.id)) usersById[u.id] = { email: u.email ?? null };
  }

  const profileByFamily = new Map<string, ProfileRow>();
  for (const p of profiles) profileByFamily.set(p.family_id, p as ProfileRow);

  const membersByFamily = new Map<string, MemberRow[]>();
  for (const m of members) {
    if (!membersByFamily.has(m.family_id)) membersByFamily.set(m.family_id, []);
    membersByFamily.get(m.family_id)!.push(m);
  }

  // Compter biology/docs par famille (côté JS car récup full)
  const bioByFam: Record<string, number> = {};
  for (const r of biologyRes.data ?? []) {
    bioByFam[r.family_id] = (bioByFam[r.family_id] ?? 0) + 1;
  }
  const docsByFam: Record<string, number> = {};
  for (const r of docsRes.data ?? []) {
    docsByFam[r.family_id] = (docsByFam[r.family_id] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink mb-1">Familles</h1>
        <p className="text-sm text-muted">
          {families.length} famille{families.length > 1 ? "s" : ""} ·{" "}
          {members.length} membre{members.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="space-y-3">
        {families.length === 0 && (
          <p className="text-sm text-muted">Aucune famille</p>
        )}
        {families.map((f) => {
          const profile = profileByFamily.get(f.id);
          const fams = membersByFamily.get(f.id) ?? [];
          return (
            <div
              key={f.id}
              className="bg-canvas-soft border border-hairline rounded-md p-4"
            >
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-base font-medium text-ink">
                    {f.name ?? "—"}
                    {profile?.patient_first_name && (
                      <span className="text-muted font-normal ml-2">
                        · {profile.patient_first_name}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-muted font-mono mt-0.5">
                    {f.id}
                  </p>
                </div>
                <div className="text-right text-xs text-muted">
                  <div>
                    Créée :{" "}
                    {new Date(f.created_at).toLocaleDateString("fr-FR")}
                  </div>
                  {profile?.diagnosis_date && (
                    <div>Dx : {profile.diagnosis_date}</div>
                  )}
                </div>
              </div>

              {profile && (
                <div className="text-xs text-body mb-3 flex flex-wrap gap-3">
                  {profile.cancer_label && (
                    <span>
                      🦀 <strong className="text-ink">{profile.cancer_label}</strong>
                    </span>
                  )}
                  <span>🧬 {bioByFam[f.id] ?? 0} mesures</span>
                  <span>📄 {docsByFam[f.id] ?? 0} documents</span>
                </div>
              )}

              <div className="border-t border-hairline pt-2 mt-2">
                <p className="text-xs text-muted uppercase tracking-wider mb-1">
                  Membres ({fams.length})
                </p>
                <ul className="text-sm space-y-0.5">
                  {fams.map((m) => (
                    <li
                      key={m.user_id}
                      className="flex items-center gap-3 py-0.5"
                    >
                      <span className="text-ink min-w-0 flex-1 truncate">
                        {m.display_name ?? "—"}
                        {m.relation && (
                          <span className="text-muted ml-2">({m.relation})</span>
                        )}
                      </span>
                      <span className="text-xs text-muted">
                        {m.role ?? "—"}
                      </span>
                      <span className="text-xs text-muted font-mono w-48 text-right truncate">
                        {usersById[m.user_id]?.email ?? m.user_id.slice(0, 8)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
