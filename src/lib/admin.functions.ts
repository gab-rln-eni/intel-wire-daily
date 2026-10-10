import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Console d'administration : chaque fonction revérifie côté serveur le rôle de l'appelant (liste exacte des rôles autorisés,
// jamais « tout sauf user ») et inscrit son action au journal d'audit. Masquer un bouton dans l'interface n'est que du confort.
// La clé d'administration Supabase reste côté serveur (client.server).
// Rôles : admin (propriétaire, tous les droits) ; veilleur (rôle restreint, D-WEB-11 : voir, lancer une veille, emails masqués).

const DUREE_SUSPENSION = "876000h"; // environ 100 ans : suspension jusqu'à réactivation manuelle
type Role = "admin" | "veilleur";
type SB = Awaited<ReturnType<typeof clientAdmin>>;

async function clientAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// Tables et fonctions ajoutées hors des types générés : accès non typé, toujours lié à son client (sinon « this » est perdu)
interface Requete extends PromiseLike<{ data: unknown; error: unknown }> {
  insert(v: object): Requete;
  update(v: object): Requete;
  delete(): Requete;
  select(c: string): Requete;
  eq(k: string, v: unknown): Requete;
  ilike(k: string, v: string): Requete;
  maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: unknown }>;
}
const table = (sb: SB, nom: string) => (sb.from as unknown as (n: string) => Requete).bind(sb)(nom);
const rpc = (sb: SB, nom: string, args?: object) =>
  (sb.rpc as unknown as (f: string, a?: object) => Promise<{ data: unknown; error: unknown }>).bind(sb)(nom, args);

async function roleDe(sb: SB, userId: string): Promise<Role | null> {
  const { data } = await sb.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => String(r.role));
  return roles.includes("admin") ? "admin" : roles.includes("veilleur") ? "veilleur" : null;
}

/** Exige l'un des rôles listés ; renvoie le client serveur, le rôle et l'email de l'appelant (pour le journal).
 *  Une tentative refusée d'un membre de l'équipe (veilleur sur une action d'admin) est inscrite au journal. */
async function exiger(userId: string, autorises: Role[], action: string) {
  const sb = await clientAdmin();
  const role = await roleDe(sb, userId);
  const email = role ? ((await sb.auth.admin.getUserById(userId)).data.user?.email ?? "") : "";
  if (!role || !autorises.includes(role)) {
    if (role) await journal({ sb, role, email }, userId, action, "", "rôle insuffisant", "refus");
    throw new Error("Action non autorisée pour votre rôle");
  }
  return { sb, role, email };
}

type Qui = { sb: SB; role: Role; email: string };
/** Journal d'audit, ajout seul : une ligne par action, réussie ou refusée. */
async function journal(q: Qui, auteur: string, action: string, cible: string, detail = "", resultat = "ok") {
  await table(q.sb, "admin_journal").insert({ auteur, auteur_email: q.email, role: q.role, action, cible, detail: detail.slice(0, 300), resultat });
}

/** Cible valide, jamais soi-même ni un administrateur. */
async function exigerCible(sb: SB, appelant: string, cible: string) {
  if (!/^[0-9a-f-]{36}$/i.test(cible)) throw new Error("Identifiant invalide");
  if (cible === appelant) throw new Error("Action impossible sur votre propre compte");
  if ((await roleDe(sb, cible)) === "admin") throw new Error("Action impossible sur un compte administrateur");
}

const emailDe = async (sb: SB, id: string) => (await sb.auth.admin.getUserById(id)).data.user?.email ?? id;

/** g***@d***.fr : ce que voit le veilleur. */
export function masquer(email: string) {
  const [loc = "", dom = ""] = email.split("@");
  const p = dom.lastIndexOf(".");
  return `${loc.slice(0, 1)}***@${dom.slice(0, 1)}***${p > 0 ? dom.slice(p) : ""}`;
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
  role: "admin" | "veilleur" | "abonne";
  canal: "email" | "discord" | "aucun";
  nb_rubriques: number;
};

export const listerUtilisateurs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ moi: Role; utilisateurs: UtilisateurAdmin[] }> => {
    const q = await exiger(context.userId, ["admin", "veilleur"], "Lister les utilisateurs");
    const [{ data: users, error }, { data: profils }, { data: roles }] = await Promise.all([
      q.sb.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      q.sb.from("profiles").select("id, canal, rubriques"),
      q.sb.from("user_roles").select("user_id, role"),
    ]);
    if (error) throw new Error("Lecture des utilisateurs impossible");
    const p = new Map((profils ?? []).map((x) => [x.id, x]));
    const roleDeU = (id: string) => {
      const r = (roles ?? []).filter((x) => x.user_id === id).map((x) => String(x.role));
      return r.includes("admin") ? "admin" : r.includes("veilleur") ? "veilleur" : "abonne";
    };
    const maintenant = Date.now();
    const utilisateurs = users.users
      .map((u) => {
        const prof = p.get(u.id);
        const bannedUntil = (u as { banned_until?: string | null }).banned_until;
        const role = roleDeU(u.id);
        return {
          id: u.id,
          email: q.role === "admin" ? (u.email ?? "") : masquer(u.email ?? ""),
          fournisseur: String(u.app_metadata?.["provider"] ?? "email"),
          inscrit_le: u.created_at,
          derniere_connexion: u.last_sign_in_at ?? null,
          confirme: !!u.email_confirmed_at,
          suspendu: !!bannedUntil && Date.parse(bannedUntil) > maintenant,
          admin: role === "admin",
          role,
          canal: prof?.canal === "discord" ? "discord" : prof?.canal === "aucun" ? "aucun" : "email",
          nb_rubriques: prof?.rubriques?.length ?? 0,
        } satisfies UtilisateurAdmin;
      })
      .sort((a, b) => Date.parse(b.inscrit_le) - Date.parse(a.inscrit_le));
    return { moi: q.role, utilisateurs };
  });

const avecId = (d: { id: string }) => ({ id: String(d?.id ?? "") });

/** Action admin sur un compte : contrôle, exécution, journal (réussite comme refus). */
async function agirSurCompte(userId: string, cible: string, action: string, faire: (sb: SB) => Promise<{ error: unknown }>) {
  const q = await exiger(userId, ["admin"], action);
  const email = await emailDe(q.sb, cible);
  try {
    await exigerCible(q.sb, userId, cible);
    const { error } = await faire(q.sb);
    if (error) throw new Error(`${action} impossible`);
    await journal(q, userId, action, email);
    return { ok: true };
  } catch (e) {
    await journal(q, userId, action, email, e instanceof Error ? e.message : "", "refus");
    throw e;
  }
}

export const suspendreUtilisateur = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(avecId)
  .handler(({ context, data }) =>
    agirSurCompte(context.userId, data.id, "Suspendre", (sb) => sb.auth.admin.updateUserById(data.id, { ban_duration: DUREE_SUSPENSION })),
  );

export const reactiverUtilisateur = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(avecId)
  .handler(({ context, data }) =>
    agirSurCompte(context.userId, data.id, "Réactiver", (sb) => sb.auth.admin.updateUserById(data.id, { ban_duration: "none" })),
  );

export const supprimerUtilisateur = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(avecId)
  .handler(({ context, data }) => agirSurCompte(context.userId, data.id, "Supprimer", (sb) => sb.auth.admin.deleteUser(data.id)));

/** Nommer ou retirer un veilleur : propriétaire seul, jamais sur soi ni sur un admin. */
export const definirVeilleur = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; veilleur: boolean }) => ({ id: String(d?.id ?? ""), veilleur: d?.veilleur === true }))
  .handler(({ context, data }) =>
    agirSurCompte(context.userId, data.id, data.veilleur ? "Nommer veilleur" : "Retirer veilleur", async (sb) => {
      if (!data.veilleur) return table(sb, "user_roles").delete().eq("user_id", data.id).eq("role", "veilleur");
      if ((await roleDe(sb, data.id)) === "veilleur") return { error: null }; // déjà veilleur : rien à faire
      return table(sb, "user_roles").insert({ user_id: data.id, role: "veilleur" });
    }),
  );

/** Veille à la demande : admin et veilleur ; garde-fous en base (une à la fois, 15 min d'écart, 5 par jour). */
export const lancerVeille = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const q = await exiger(context.userId, ["admin", "veilleur"], "Lancer une veille");
    const { data, error } = await rpc(q.sb, "lancer_demande", { p_user: context.userId });
    const r = (data ?? {}) as { ok?: boolean; motif?: string };
    if (error || !r.ok) {
      await journal(q, context.userId, "Lancer une veille", "file des demandes", r.motif ?? "erreur", "refus");
      throw new Error(r.motif ?? "Demande impossible");
    }
    await journal(q, context.userId, "Lancer une veille", "file des demandes");
    return { ok: true };
  });

/** Mode test (D-WEB-16) : propriétaire seul ; tant qu'il est actif, la liste des abonnés transmise à n8n ne contient que l'équipe. */
export const basculerModeTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { actif: boolean }) => ({ actif: d?.actif === true }))
  .handler(async ({ context, data }) => {
    const q = await exiger(context.userId, ["admin"], data.actif ? "Activer le mode test" : "Désactiver le mode test");
    // Déjà dans l'état demandé (double clic, deux onglets) : rien à écrire, rien à journaliser
    const { data: actuel } = await table(q.sb, "parametres").select("valeur").eq("cle", "mode_test").maybeSingle();
    if (actuel && (actuel["valeur"] === true) === data.actif) return { ok: true, actif: data.actif, inchange: true };
    const { error } = await table(q.sb, "parametres")
      .update({ valeur: data.actif, maj_le: new Date().toISOString(), maj_par: q.email })
      .eq("cle", "mode_test");
    if (error) throw new Error("Bascule impossible");
    await journal(q, context.userId, data.actif ? "Activer le mode test" : "Désactiver le mode test", "mode_test");
    return { ok: true, actif: data.actif, inchange: false };
  });

/* Sources (D-WEB-9, D-WEB-17 b) : la console écrit une action dans une file ; n8n l'applique au classeur SOURCES
   avec les mêmes contrôles que le formulaire et inscrit l'HISTORIQUE. Le classeur reste la seule référence.
   Droits : admin, toutes les actions appliquées directement ; veilleur, Désactiver directement (geste de protection),
   Ajouter et Activer soumis à la validation de l'admin. */

const ACTIONS = ["Ajouter", "Activer", "Désactiver"] as const;
export const CATEGORIES = ["Officiel", "Média EN", "Média FR", "Gouvernance", "Autre"];
type ActionSource = (typeof ACTIONS)[number];

export type ProposeSource = { action: ActionSource; nom: string; url?: string; categorie?: string; priorite?: string; motif: string };

function nettoyer(d: ProposeSource): Required<ProposeSource> {
  const action = ACTIONS.includes(d?.action) ? d.action : ("" as ActionSource);
  const prio = String(d?.priorite ?? "").trim();
  return {
    action,
    nom: String(d?.nom ?? "").trim().slice(0, 200),
    url: String(d?.url ?? "").trim().slice(0, 500),
    categorie: CATEGORIES.includes(String(d?.categorie ?? "")) ? String(d.categorie) : "Autre",
    priorite: ["1", "2", "3"].includes(prio) ? prio : "1",
    motif: String(d?.motif ?? "").trim().slice(0, 300),
  };
}

/** Contrôles anticipés sur le miroir (confort : n8n refait les contrôles de référence sur le classeur). */
async function controler(sb: SB, a: Required<ProposeSource>) {
  if (!a.action) return "action invalide";
  if (!a.nom) return "nom obligatoire";
  if (!a.motif) return "motif obligatoire";
  const { data: deja } = await table(sb, "actions_sources").select("id").eq("nom", a.nom).eq("statut", "a_valider").maybeSingle();
  if (deja) return "une action sur cette source attend déjà la validation";
  if (a.action === "Ajouter") {
    if (!/^https?:\/\/\S+$/i.test(a.url)) return "URL invalide (http ou https, sans espace)";
    const { data: n } = await table(sb, "sources_miroir").select("nom").ilike("nom", a.nom).maybeSingle();
    if (n) return `source déjà présente : ${a.nom}`;
    const { data: u } = await table(sb, "sources_miroir").select("nom").ilike("url", a.url).maybeSingle();
    if (u) return `URL déjà présente (source ${String(u["nom"])})`;
    return "";
  }
  const { data: s } = await table(sb, "sources_miroir").select("nom, active").eq("nom", a.nom).maybeSingle();
  if (!s) return `source inconnue : ${a.nom}`;
  if (a.action === "Activer" && s["active"] === true) return "source déjà active";
  if (a.action === "Désactiver" && s["active"] === false) return "source déjà inactive";
  return "";
}

export const proposerActionSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(nettoyer)
  .handler(async ({ context, data }) => {
    const intitule = `Source : ${data.action || "action"}`;
    const q = await exiger(context.userId, ["admin", "veilleur"], intitule);
    const refus = await controler(q.sb, data);
    if (refus) {
      await journal(q, context.userId, intitule, data.nom, refus, "refus");
      throw new Error(refus);
    }
    const aValider = q.role === "veilleur" && data.action !== "Désactiver";
    const ligne = {
      auteur: context.userId,
      auteur_email: q.email,
      role: q.role,
      action: data.action,
      nom: data.nom,
      url: data.action === "Ajouter" ? data.url : null,
      categorie: data.action === "Ajouter" ? data.categorie : null,
      priorite: data.action === "Ajouter" ? data.priorite : null,
      motif: data.motif,
      statut: aValider ? "a_valider" : "en_attente",
      valide_par: aValider ? null : q.email,
    };
    const { error } = await table(q.sb, "actions_sources").insert(ligne);
    if (error) throw new Error("Enregistrement impossible");
    await journal(q, context.userId, intitule, data.nom, aValider ? "soumise à validation" : "transmise à n8n");
    return { ok: true, a_valider: aValider };
  });

/** Validation par l'admin d'une action proposée par un veilleur : transmise à n8n, ou annulée. */
export const validerActionSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; accepter: boolean }) => ({ id: String(d?.id ?? ""), accepter: d?.accepter === true }))
  .handler(async ({ context, data }) => {
    const intitule = data.accepter ? "Source : valider" : "Source : rejeter";
    const q = await exiger(context.userId, ["admin"], intitule);
    const refuser = async (motif: string, cible = data.id): Promise<never> => {
      await journal(q, context.userId, intitule, cible, motif, "refus");
      throw new Error(motif);
    };
    if (!/^[0-9a-f-]{36}$/i.test(data.id)) await refuser("Identifiant invalide", "");
    const { data: a } = await table(q.sb, "actions_sources").select("nom, action, statut").eq("id", data.id).maybeSingle();
    if (!a || a["statut"] !== "a_valider") return refuser("Action introuvable ou déjà traitée", a ? `${String(a["action"])} ${String(a["nom"])}` : data.id);
    const { error } = await table(q.sb, "actions_sources")
      .update(
        data.accepter
          ? { statut: "en_attente", valide_par: q.email }
          : { statut: "annulee", valide_par: q.email, traite_le: new Date().toISOString(), detail: "Rejetée par l'administrateur" },
      )
      .eq("id", data.id)
      .eq("statut", "a_valider");
    if (error) return refuser("Mise à jour impossible");
    await journal(q, context.userId, intitule, `${String(a["action"])} ${String(a["nom"])}`);
    return { ok: true };
  });

/* Maintenance et nettoyage des données (visa G_R, M-1 à M-6) : admin seul ; les règles et la trace sont en base. */

/** Lancer la maintenance tout de suite (sinon elle passe d'elle même une fois par 24 h). */
export const lancerMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const q = await exiger(context.userId, ["admin"], "Maintenance des données");
    const { data, error } = await rpc(q.sb, "maintenance_executer", { p_force: true, p_auteur: context.userId, p_email: q.email });
    if (error) {
      await journal(q, context.userId, "Maintenance des données", "base", "erreur", "refus");
      throw new Error("Maintenance impossible");
    }
    return data as { fait: boolean; resultat: Record<string, number> };
  });

/** Purger le journal au delà de N jours (90 au minimum, contrôlé aussi en base) ; la purge laisse une trace indélébile. */
export const purgerJournal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jours: number }) => ({ jours: Math.trunc(Number(d?.jours)) }))
  .handler(async ({ context, data }) => {
    const q = await exiger(context.userId, ["admin"], "Purger le journal");
    if (![90, 180, 365].includes(data.jours)) throw new Error("Durée invalide (90, 180 ou 365 jours)");
    const { data: r, error } = await rpc(q.sb, "purger_journal", { p_jours: data.jours, p_auteur: context.userId, p_email: q.email });
    const res = (r ?? {}) as { ok?: boolean; supprimees?: number; motif?: string };
    if (error || !res.ok) throw new Error(res.motif ?? "Purge impossible");
    return { ok: true, supprimees: res.supprimees ?? 0 };
  });

/** Demander le nettoyage d'un salon Discord : n8n l'applique avec son bot (liste fermée de salons et de portées). */
export const demanderNettoyage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { salon: string; portee: string }) => ({
    salon: d?.salon === "assistant" ? "assistant" : d?.salon === "alertes" ? "alertes" : "",
    portee: d?.portee === "tout" ? "tout" : d?.portee === "30j" ? "30j" : "",
  }))
  .handler(async ({ context, data }) => {
    const intitule = "Nettoyer un salon";
    const q = await exiger(context.userId, ["admin"], intitule);
    if (!data.salon || !data.portee) throw new Error("Salon ou portée invalide");
    const cible = `#${data.salon} (${data.portee === "tout" ? "tous les messages" : "plus de 30 jours"})`;
    const { error } = await table(q.sb, "nettoyages_salons").insert({ salon: data.salon, portee: data.portee, mode: "manuel", auteur_email: q.email });
    if (error) {
      await journal(q, context.userId, intitule, cible, "erreur", "refus");
      throw new Error("Demande impossible");
    }
    await journal(q, context.userId, intitule, cible, "transmise à n8n");
    return { ok: true };
  });
