import { createFileRoute } from "@tanstack/react-router";
import { json, lireModeTest, verifierSecret } from "@/lib/publication.server";

// Liste des destinataires de la synthèse, lue par n8n (Publication v5, D-AUD-01) pour l'envoi par email.
// Liste d'autorisation : seuls les comptes à l'email confirmé et non suspendus ; adresse lue dans le compte (auth.users).
// Mode test (D-WEB-16) : seule l'équipe (admin, veilleur) ; une lecture du mode test en échec vaut mode test (lireModeTest).
export const Route = createFileRoute("/api/public/lister-abonnes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!verifierSecret(request)) return json({ error: "Non autorisé" }, 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profils, error } = await supabaseAdmin.from("profiles").select("id, canal, rubriques");
        if (error) return json({ error: "Lecture impossible" }, 500);
        // Tous les comptes, page par page (au-delà de 1 000 comptes, une seule page en laissait passer)
        const comptes = new Map<string, string>();
        const maintenant = Date.now();
        for (let page = 1; page <= 50; page++) {
          const { data, error: e2 } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
          if (e2) return json({ error: "Lecture impossible" }, 500);
          for (const u of data.users) {
            const b = (u as { banned_until?: string | null }).banned_until;
            const suspendu = !!b && Date.parse(b) > maintenant;
            if (u.email && u.email_confirmed_at && !suspendu) comptes.set(u.id, u.email);
          }
          if (data.users.length < 1000) break;
        }
        const modeTest = await lireModeTest(supabaseAdmin);
        let equipe = new Set<string>();
        if (modeTest) {
          const { data: r } = await supabaseAdmin.from("user_roles").select("user_id, role");
          equipe = new Set((r ?? []).filter((x) => ["admin", "veilleur"].includes(String(x.role))).map((x) => x.user_id));
        }
        const abonnes = (profils ?? [])
          .filter((p) => comptes.has(p.id) && (!modeTest || equipe.has(p.id)))
          .map((p) => ({ email: comptes.get(p.id)!, canal: p.canal, rubriques: p.rubriques }));
        return json({ mode_test: modeTest, abonnes });
      },
    },
  },
});
