import { createFileRoute } from "@tanstack/react-router";
import { json, rpcLiee, verifierSecret } from "@/lib/publication.server";

// Appelée par n8n après application au classeur : appliquee, ou refusee avec le motif des contrôles.
export const Route = createFileRoute("/api/public/action-source-statut")({
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
        const id = String(body["id"] ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "id invalide" }, 400);
        const statut = String(body["statut"] ?? "");
        if (statut !== "appliquee" && statut !== "refusee")
          return json({ error: "statut invalide" }, 400);
        const detail =
          typeof body["detail"] === "string" ? (body["detail"] as string).slice(0, 300) : "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await rpcLiee(supabaseAdmin)("terminer_action_source", {
          p_id: id,
          p_statut: statut,
          p_detail: detail,
        });
        if (error) return json({ error: "Écriture impossible" }, 500);
        return json(data);
      },
    },
  },
});
