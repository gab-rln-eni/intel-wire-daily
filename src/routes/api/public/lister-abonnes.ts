import { createFileRoute } from "@tanstack/react-router";
import { json, verifierSecret } from "@/lib/publication.server";

export const Route = createFileRoute("/api/public/lister-abonnes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!verifierSecret(request)) return json({ error: "Non autorisé" }, 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("profiles")
          .select("email, canal, discord_webhook_url, rubriques");
        if (error) return json({ error: "Lecture impossible" }, 500);
        return json({ abonnes: data });
      },
    },
  },
});
