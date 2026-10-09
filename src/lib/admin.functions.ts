import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Gestion des utilisateurs par l'administrateur.
// Chaque fonction revérifie le rôle admin côté serveur : masquer un bouton ne suffit pas.
// La clé d'administration Supabase reste côté serveur (client.server).

const DUREE_SUSPENSION = "876000h"; // environ 100 ans : suspension jusqu'à réactivation manuelle

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function exigerAdmin(userId: string) {
  const sb = await admin();
  const { data, error } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error || !data) throw new Error("Accès réservé à l'administrateur");
  return sb;
}

/** Refuse une action sur son propre compte ou sur un autre administrateur. */
async function exigerCible(sb: Awaited<ReturnType<typeof admin>>, appelant: string, cible: string) {
  if (!/^[0-9a-f-]{36}$/i.test(cible)) throw new Error("Identifiant invalide");
  if (cible === appelant) throw new Error("Action impossible sur votre propre compte");
  const { data } = await sb.from("user_roles").select("role").eq("user_id", cible).eq("role", "admin").maybeSingle();
  if (data) throw new Error("Action impossible sur un compte administrateur");
}

export type UtilisateurAdmin = {
  id: string;
  email: string;
  fournisseur: string;
  inscrit_le: string;
  derniere_connexion: string | null;
  confirme: boolean;
  suspendu: boolean;
  admin: boolean;
  canal: "email" | "discord";
  nb_rubriques: number;
};

export const listerUtilisateurs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UtilisateurAdmin[]> => {
    const sb = await exigerAdmin(context.userId);
    const [{ data: users, error }, { data: profils }, { data: roles }] = await Promise.all([
      sb.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      sb.from("profiles").select("id, canal, rubriques"),
      sb.from("user_roles").select("user_id, role").eq("role", "admin"),
    ]);
    if (error) throw new Error("Lecture des utilisateurs impossible");
    const p = new Map((profils ?? []).map((x) => [x.id, x]));
    const admins = new Set((roles ?? []).map((r) => r.user_id));
    const maintenant = Date.now();
    return users.users
      .map((u) => {
        const prof = p.get(u.id);
        const bannedUntil = (u as { banned_until?: string | null }).banned_until;
        return {
          id: u.id,
          email: u.email ?? "",
          fournisseur: String(u.app_metadata?.["provider"] ?? "email"),
          inscrit_le: u.created_at,
          derniere_connexion: u.last_sign_in_at ?? null,
          confirme: !!u.email_confirmed_at,
          suspendu: !!bannedUntil && Date.parse(bannedUntil) > maintenant,
          admin: admins.has(u.id),
          canal: prof?.canal === "discord" ? "discord" : "email",
          nb_rubriques: prof?.rubriques?.length ?? 0,
        } satisfies UtilisateurAdmin;
      })
      .sort((a, b) => Date.parse(b.inscrit_le) - Date.parse(a.inscrit_le));
  });

export const suspendreUtilisateur = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d?.id ?? "") }))
  .handler(async ({ context, data }) => {
    const sb = await exigerAdmin(context.userId);
    await exigerCible(sb, context.userId, data.id);
    const { error } = await sb.auth.admin.updateUserById(data.id, { ban_duration: DUREE_SUSPENSION });
    if (error) throw new Error("Suspension impossible");
    return { ok: true };
  });

export const reactiverUtilisateur = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d?.id ?? "") }))
  .handler(async ({ context, data }) => {
    const sb = await exigerAdmin(context.userId);
    await exigerCible(sb, context.userId, data.id);
    const { error } = await sb.auth.admin.updateUserById(data.id, { ban_duration: "none" });
    if (error) throw new Error("Réactivation impossible");
    return { ok: true };
  });

export const supprimerUtilisateur = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d?.id ?? "") }))
  .handler(async ({ context, data }) => {
    const sb = await exigerAdmin(context.userId);
    await exigerCible(sb, context.userId, data.id);
    const { error } = await sb.auth.admin.deleteUser(data.id);
    if (error) throw new Error("Suppression impossible");
    return { ok: true };
  });

/** Demande de veille à la demande : garde-fous appliqués en base (une à la fois, 15 min d'écart, 5 par jour). */
export const lancerVeille = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await exigerAdmin(context.userId);
    // Fonction ajoutée hors des types générés : appel non typé
    const { data, error } = await (sb.rpc as unknown as (f: string, a: object) => Promise<{ data: unknown; error: unknown }>)(
      "lancer_demande",
      { p_user: context.userId },
    );
    if (error) throw new Error("Demande impossible");
    const r = data as { ok: boolean; motif?: string };
    if (!r.ok) throw new Error(r.motif ?? "Demande refusée");
    return { ok: true };
  });
