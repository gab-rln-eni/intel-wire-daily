import { createFileRoute } from "@tanstack/react-router";
import { json, verifierSecret } from "@/lib/publication.server";

const STATUTS: Record<string, string> = { ENVOYE: "envoyee", EN_COURS: "en_cours", ECHEC: "echec" };

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? null : String(v));
const int = (v: unknown) => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null);
const httpOk = (u: string) => {
  try {
    const p = new URL(u).protocol;
    return p === "http:" || p === "https:";
  } catch {
    return false;
  }
};

export const Route = createFileRoute("/api/public/publier-synthese")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifierSecret(request)) return json({ error: "Non autorisé" }, 401);
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "JSON invalide" }, 400);
        }
        const s = body?.synthese as Record<string, unknown> | undefined;
        if (!s || typeof s !== "object") return json({ error: "synthese manquante" }, 400);
        const date = str(s["date_veille"]);
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "date_veille invalide" }, 400);
        const statut = STATUTS[String(s["statut"] ?? "")];
        if (!statut) return json({ error: "statut invalide" }, 400);
        const envoye = str(s["envoye_le"]);
        if (envoye && isNaN(Date.parse(envoye))) return json({ error: "envoye_le invalide" }, 400);

        const synthese = {
          date_veille: date,
          statut,
          nb_sources: int(s["nb_sources"]),
          nb_sources_echec: int(s["nb_sources_echec"]),
          nb_articles: int(s["nb_articles"]),
          nb_sujets: int(s["nb_sujets"]),
          degrade: s["degrade"] === true,
          envoye_le: envoye,
        };

        let sujets: Record<string, unknown>[] | null = null;
        if (Array.isArray(body["sujets"])) {
          sujets = [];
          for (const raw of body["sujets"] as Record<string, unknown>[]) {
            const titre = str(raw?.["titre"]) ?? "";
            const resume = str(raw?.["resume"]) ?? "";
            const extrait = str(raw?.["extrait"]) ?? "";
            const lien = str(raw?.["lien"]) ?? "";
            if (!titre || titre.length > 300) return json({ error: "titre invalide" }, 400);
            if (resume.length > 1000) return json({ error: "resume trop long" }, 400);
            if (extrait.length > 500) return json({ error: "extrait trop long" }, 400);
            if (!httpOk(lien)) return json({ error: "lien invalide" }, 400);
            const publie = str(raw?.["publie_le"]);
            sujets.push({
              n: int(raw?.["n"]) ?? 0,
              rubrique: (str(raw?.["rubrique"]) ?? "Autres actualités").slice(0, 100),
              ordre_rubrique: int(raw?.["ordre_rubrique"]) ?? 0,
              titre,
              resume,
              extrait,
              redige: raw?.["redige"] !== false,
              source: (str(raw?.["source"]) ?? "").slice(0, 200),
              lien,
              publie_le: publie && !isNaN(Date.parse(publie)) ? publie : null,
            });
          }
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("publier_synthese", { p: { synthese, sujets } });
        if (error) return json({ error: "Écriture impossible" }, 500);
        const r = data as { conflict?: boolean; ok?: boolean; date_veille: string; nb_sujets?: number };
        if (r.conflict) return json({ ok: false, error: "Sujets existants et liste reçue vide", date_veille: date }, 409);
        return json({ ok: true, date_veille: r.date_veille, nb_sujets: r.nb_sujets });
      },
    },
  },
});
