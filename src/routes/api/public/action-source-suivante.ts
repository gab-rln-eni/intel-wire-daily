import { createFileRoute } from "@tanstack/react-router";
import { json, rpcLiee, verifierSecret } from "@/lib/publication.server";

// Appelée par n8n (Fil_IA_Veille_Demandes) toutes les 2 minutes : prise atomique de la plus ancienne action
// sur les sources décidée dans la console (une à la fois). n8n applique ensuite au classeur les mêmes contrôles que le formulaire.
export const Route = createFileRoute("/api/public/action-source-suivante")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifierSecret(request)) return json({ error: "Non autorisé" }, 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await rpcLiee(supabaseAdmin)("prendre_action_source");
        if (error) return json({ error: "Lecture impossible" }, 500);
        const a = (data as { action: Record<string, unknown> | null }).action;
        return json({ action: a, a_traiter: a ? "oui" : "non" });
      },
    },
  },
});
