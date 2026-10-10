import { createFileRoute } from "@tanstack/react-router";
import { json, verifierSecret } from "@/lib/publication.server";

// Appelée par n8n (Fil_IA_Veille_Demandes) toutes les 2 minutes : prise du prochain nettoyage de salon Discord
// (demandes de l'admin d'abord, puis nettoyage automatique des messages de plus de 30 jours, une fois par 24 h et par salon).
export const Route = createFileRoute("/api/public/nettoyage-suivant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifierSecret(request)) return json({ error: "Non autorisé" }, 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("prendre_nettoyage");
        if (error) return json({ error: "Lecture impossible" }, 500);
        const n = (data as { nettoyage: Record<string, unknown> | null }).nettoyage;
        return json({ nettoyage: n, a_traiter: n ? "oui" : "non" });
      },
    },
  },
});
