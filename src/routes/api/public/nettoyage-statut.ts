import { createFileRoute } from "@tanstack/react-router";
import { json, verifierSecret } from "@/lib/publication.server";

// Appelée par n8n après un passage de nettoyage : nombre de messages supprimés ; « reste » remet le nettoyage en file.
export const Route = createFileRoute("/api/public/nettoyage-statut")({
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
        const supprimes = Math.max(0, Math.min(1000, Math.trunc(Number(body["supprimes"]) || 0)));
        const detail =
          typeof body["detail"] === "string" ? (body["detail"] as string).slice(0, 300) : "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("terminer_nettoyage", {
          p_id: id,
          p_ok: body["ok"] === true,
          p_supprimes: supprimes,
          p_reste: body["reste"] === true,
          p_detail: detail,
        });
        if (error) return json({ error: "Écriture impossible" }, 500);
        return json(data);
      },
    },
  },
});
