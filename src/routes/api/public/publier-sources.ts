import { createFileRoute } from "@tanstack/react-router";
import { json, verifierSecret } from "@/lib/publication.server";

const txt = (v: unknown, max: number) => (v == null ? "" : String(v).trim().slice(0, max));
const ent = (v: unknown) =>
  v == null || v === "" || !Number.isFinite(Number(v)) ? "" : String(Math.trunc(Number(v)));

// Appelée par n8n (Fil_IA_Veille_Miroir_Sources) : instantané complet du classeur SOURCES et de la santé des sources.
// La console lit ce miroir ; le classeur reste la seule référence. Les sources absentes de l'instantané sont retirées du miroir.
export const Route = createFileRoute("/api/public/publier-sources")({
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
        if (!body || typeof body !== "object" || Array.isArray(body))
          return json({ error: "JSON invalide" }, 400);
        const brut = body["sources"];
        if (!Array.isArray(brut) || brut.length === 0)
          return json({ error: "sources manquantes" }, 400);
        if (brut.length > 500) return json({ error: "trop de sources" }, 400);
        const sources = (brut as Record<string, unknown>[]).map((s) => {
          const sante = txt(s?.["sante_le"], 10);
          const active = s?.["active"];
          return {
            nom: txt(s?.["nom"], 200),
            url: txt(s?.["url"], 500),
            categorie: txt(s?.["categorie"], 50),
            priorite: ent(s?.["priorite"]),
            active:
              active === true ||
              String(active ?? "")
                .trim()
                .toUpperCase() === "OUI",
            statut_sante: txt(s?.["statut_sante"], 20),
            jours_echec: ent(s?.["jours_echec"]),
            nb_articles: ent(s?.["nb_articles"]),
            sante_le: /^\d{4}-\d{2}-\d{2}$/.test(sante) ? sante : "",
          };
        });
        if (sources.some((s) => !s.nom)) return json({ error: "source sans nom" }, 400);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("publier_sources", { p: sources });
        if (error) return json({ error: "Écriture impossible" }, 500);
        return json(data);
      },
    },
  },
});
