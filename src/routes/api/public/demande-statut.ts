import { createFileRoute } from "@tanstack/react-router";
import { json, verifierSecret } from "@/lib/publication.server";

// Appelée par n8n en fin de traitement. L'app juge sur les faits : la demande est terminée
// si la synthèse du jour a été republiée après sa prise en charge, sinon elle est en échec.
export const Route = createFileRoute("/api/public/demande-statut")({
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
        const id = String(body["id"] ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "id invalide" }, 400);
        const erreur = typeof body["erreur"] === "string" ? (body["erreur"] as string).slice(0, 300) : "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const rpc = supabaseAdmin.rpc as unknown as (f: string, a?: object) => Promise<{ data: unknown; error: unknown }>;
        const { data, error } = await rpc("terminer_demande", { p_id: id, p_erreur: erreur });
        if (error) return json({ error: "Écriture impossible" }, 500);
        return json(data);
      },
    },
  },
});
