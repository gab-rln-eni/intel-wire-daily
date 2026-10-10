import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Articles sauvegardés (A-5, A-6) : l'abonné ne fournit jamais d'URL libre. Le favori est copié depuis un sujet publié
// (titre, résumé, source, lien), puis le lien est vérifié par l'app au plus une fois par jour, à l'ouverture de « Mes articles ».
// Tables ajoutées hors des types générés : accès non typé, toujours lié à son client (PNPR-WEB-3).

const MAX_FAVORIS = 30; // plafond par abonné (consigne G_R)
const DELAI_VERIF_MS = 24 * 3600 * 1000;
const PAR_PASSAGE = 15;

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
interface Requete extends PromiseLike<{ data: unknown; error: unknown; count?: number | null }> {
  select(c: string, o?: object): Requete;
  insert(v: object): Requete;
  update(v: object): Requete;
  eq(k: string, v: unknown): Requete;
  order(k: string, o: object): Requete;
  limit(n: number): Requete;
  maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: unknown }>;
}
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
const table = (sb: Admin, nom: string) => (sb.from as unknown as (n: string) => Requete).bind(sb)(nom);

const lienValide = (d: { lien: string }) => {
  const lien = String(d?.lien ?? "").trim();
  if (!/^https?:\/\/\S+$/i.test(lien) || lien.length > 2000) throw new Error("Lien invalide");
  return { lien };
};

/** Sauvegarder un article : seulement un sujet publié (copie côté serveur), sans doublon, 30 au plus par compte. */
export const sauverFavori = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(lienValide)
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { data: s } = await table(sb, "sujets")
      .select("titre, resume, extrait, redige, source, rubrique, lien, syntheses(date_veille)")
      .eq("lien", data.lien)
      .limit(1)
      .maybeSingle();
    if (!s) throw new Error("Article introuvable dans les synthèses publiées");
    const { count } = (await table(sb, "favoris").select("id", { count: "exact", head: true }).eq("user_id", context.userId)) as { count?: number | null };
    if ((count ?? 0) >= MAX_FAVORIS) throw new Error(`Limite de ${MAX_FAVORIS} articles sauvegardés atteinte : retirez-en un dans Mes articles`);
    const synth = s["syntheses"] as { date_veille?: string } | null;
    const { error } = await table(sb, "favoris").insert({
      user_id: context.userId,
      lien: data.lien,
      titre: String(s["titre"] ?? "").slice(0, 300),
      resume: String((s["redige"] ? s["resume"] : s["extrait"]) ?? "").slice(0, 1000),
      source: String(s["source"] ?? "").slice(0, 200),
      rubrique: String(s["rubrique"] ?? "").slice(0, 100),
      date_veille: synth?.date_veille ?? null,
    });
    // Doublon (déjà sauvegardé) : sans effet, c'est l'état voulu
    if (error && (error as { code?: string }).code !== "23505") throw new Error("Sauvegarde impossible");
    return { ok: true };
  });

/** Adresse publique seulement : pas d'IP littérale, pas de nom local (garde-fou contre l'appel de services internes). */
function adressePublique(u: URL) {
  const h = u.hostname.toLowerCase();
  if (!/^https?:$/.test(u.protocol)) return false;
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":") || h.startsWith("[")) return false;
  return h.includes(".");
}

type Etat = "ok" | "rompu" | "incertain";

/** 404 ou 410, ou domaine introuvable : rompu. 2xx ou 3xx : ok. Le reste (403, 429, 5xx, délai) : incertain, jamais déclaré rompu. */
async function sonder(lien: string): Promise<Etat> {
  let u: URL;
  try {
    u = new URL(lien);
  } catch {
    return "rompu";
  }
  if (!adressePublique(u)) return "incertain";
  const essai = async (methode: "HEAD" | "GET") => {
    const ctrl = new AbortController();
    const minuterie = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(u.toString(), {
        method: methode,
        redirect: "manual", // CYB-10 : redirection jamais suivie (cible non contrôlée) ; une réponse 3xx compte comme « ok »
        signal: ctrl.signal,
        headers: { "user-agent": "LeFilIA-verif-liens/1.0", ...(methode === "GET" ? { range: "bytes=0-0" } : {}) },
      });
      return r.status;
    } finally {
      clearTimeout(minuterie);
    }
  };
  try {
    let code = await essai("HEAD");
    if (code === 405 || code === 403 || code === 400 || code === 501) code = await essai("GET");
    if (code === 404 || code === 410) return "rompu";
    if (code >= 200 && code < 400) return "ok";
    return "incertain";
  } catch (e) {
    const m = String((e as { cause?: { code?: string } })?.cause?.code ?? (e as Error)?.message ?? "");
    return /ENOTFOUND|EAI_AGAIN|getaddrinfo|DNS/i.test(m) ? "rompu" : "incertain";
  }
}

/** Vérifie les liens des articles sauvegardés de l'abonné : au plus 15 par passage, chacun au plus une fois par 24 h. */
export const verifierFavoris = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const { data } = await table(sb, "favoris")
      .select("id, lien, verifie_le")
      .eq("user_id", context.userId)
      .order("verifie_le", { ascending: true, nullsFirst: true })
      .limit(200);
    const maintenant = Date.now();
    const aVerifier = ((data ?? []) as { id: string; lien: string; verifie_le: string | null }[])
      .filter((f) => !f.verifie_le || maintenant - Date.parse(f.verifie_le) > DELAI_VERIF_MS)
      .slice(0, PAR_PASSAGE);
    const resultats = await Promise.all(aVerifier.map(async (f) => ({ id: f.id, etat: await sonder(f.lien) })));
    for (const r of resultats) {
      await table(sb, "favoris").update({ lien_etat: r.etat, verifie_le: new Date().toISOString() }).eq("id", r.id).eq("user_id", context.userId);
    }
    return { verifies: resultats.length, rompus: resultats.filter((r) => r.etat === "rompu").length };
  });
