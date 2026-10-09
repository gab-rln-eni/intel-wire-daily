import { createFileRoute } from "@tanstack/react-router";
import { json, verifierSecret } from "@/lib/publication.server";

export const Route = createFileRoute("/api/public/lister-abonnes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!verifierSecret(request)) return json({ error: "Non autorisé" }, 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [{ data, error }, { data: users, error: e2 }] = await Promise.all([
          supabaseAdmin.from("profiles").select("id, email, canal, discord_webhook_url, rubriques"),
          supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        ]);
        if (error || e2) return json({ error: "Lecture impossible" }, 500);
        // Les comptes suspendus par l'administrateur ne reçoivent plus la synthèse
        const maintenant = Date.now();
        const suspendus = new Set(
          users.users
            .filter((u) => {
              const b = (u as { banned_until?: string | null }).banned_until;
              return !!b && Date.parse(b) > maintenant;
            })
            .map((u) => u.id),
        );
        // Mode test (D-WEB-16) : seule l'équipe (admin, veilleur) reste dans la liste, aucun abonné n'est servi
        const lecture = (supabaseAdmin.from as unknown as (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { valeur: unknown } | null }> } } }).bind(supabaseAdmin);
        const { data: mt } = await lecture("parametres").select("valeur").eq("cle", "mode_test").maybeSingle();
        const modeTest = mt?.valeur === true;
        let equipe = new Set<string>();
        if (modeTest) {
          const { data: r } = await supabaseAdmin.from("user_roles").select("user_id, role");
          equipe = new Set((r ?? []).filter((x) => ["admin", "veilleur"].includes(String(x.role))).map((x) => x.user_id));
        }
        const liste = (data ?? []).filter((p) => !suspendus.has(p.id) && (!modeTest || equipe.has(p.id)));
        return json({ mode_test: modeTest, abonnes: liste.map(({ id: _id, ...p }) => p) });
      },
    },
  },
});
