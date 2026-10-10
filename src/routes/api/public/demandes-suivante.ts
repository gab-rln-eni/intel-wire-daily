import { createFileRoute } from "@tanstack/react-router";
import { json, rpcLiee, verifierSecret } from "@/lib/publication.server";

// Appelée par n8n (Fil_IA_Veille_Demandes) toutes les 2 minutes : signe de vie, expirations,
// puis prise atomique de la plus ancienne demande en attente (une seule à la fois).
export const Route = createFileRoute("/api/public/demandes-suivante")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifierSecret(request)) return json({ error: "Non autorisé" }, 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const rpc = rpcLiee(supabaseAdmin);
        const { data, error } = await rpc("prendre_demande");
        if (error) return json({ error: "Lecture impossible" }, 500);
        const d = (data as { demande: { id: string } | null }).demande;
        return json({ demande: d, a_traiter: d ? "oui" : "non" });
      },
    },
  },
});
