import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime, maskEmail, todayParis } from "@/lib/rubriques";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/" });
    const { data: ok } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    if (!ok) throw redirect({ to: "/" });
    return { userId: data.user.id };
  },
  head: () => ({
    meta: [
      { title: "Admin | Le Fil IA" },
      { name: "description", content: "Suivi des synthèses, des demandes de veille et des abonnés." },
      { property: "og:title", content: "Admin | Le Fil IA" },
      { property: "og:description", content: "Tableau de bord d'administration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

const STATUTS: Record<string, string> = {
  envoyee: "Envoyée",
  en_cours: "En cours",
  echec: "Échec",
  en_attente: "En attente",
  prise: "Prise",
  terminee: "Terminée",
};

function Admin() {
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const [note, setNote] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["admin"],
    queryFn: async () => {
      const [syn, dem, prof] = await Promise.all([
        supabase.from("syntheses").select("*").order("date_veille", { ascending: false }),
        supabase.from("demandes").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, email, canal, rubriques, created_at").order("created_at", { ascending: false }),
      ]);
      const today = (syn.data ?? []).find((s) => s.date_veille === todayParis());
      let sujetsJour = 0;
      if (today) {
        const { count } = await supabase.from("sujets").select("id", { count: "exact", head: true }).eq("synthese_id", today.id);
        sujetsJour = count ?? 0;
      }
      return { syntheses: syn.data ?? [], demandes: dem.data ?? [], profils: prof.data ?? [], sujetsJour };
    },
  });

  const lancer = async () => {
    const { error } = await supabase.from("demandes").insert({ demandeur: userId, statut: "en_attente" });
    setNote(error ? "La demande n'a pas pu être enregistrée." : "Demande enregistrée ; prise en charge par la chaîne en bonus.");
    qc.invalidateQueries({ queryKey: ["admin"] });
  };

  const derniere = data?.syntheses.find((s) => s.statut === "envoyee");
  const lues = (s?: { nb_sources: number | null; nb_sources_echec: number | null }) =>
    s && s.nb_sources != null ? `${s.nb_sources - (s.nb_sources_echec ?? 0)} / ${s.nb_sources}` : "Non renseigné";

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Admin</h1>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSfXm_fq5V8gyo35l-rn-6AsE8wa4LGSR7WADUjRV0DR4TDZ1w/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="link-accent text-sm"
          >
            Gérer les sources ↗<span className="sr-only"> (nouvel onglet)</span>
          </a>
          <Button onClick={lancer}>Lancer une veille</Button>
        </div>
      </div>
      {note && <p role="status" className="text-sm text-primary">{note}</p>}

      <section aria-label="Compteurs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Abonnés" value={String(data?.profils.length ?? "…")} />
        <Stat label="Dernière synthèse" value={derniere ? formatDate(derniere.date_veille) : "Aucune"} />
        <Stat label="Sources lues" value={lues(derniere)} />
        <Stat label="Sujets du jour" value={String(data?.sujetsJour ?? "…")} />
      </section>

      <section aria-labelledby="journal">
        <h2 id="journal" className="mb-3 text-lg font-semibold text-foreground">Journal des synthèses</h2>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Sources lues</TableHead>
                <TableHead>Articles analysés</TableHead>
                <TableHead>Sujets retenus</TableHead>
                <TableHead>Résumés</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.syntheses.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.date_veille}{s.exemple && " (exemple)"}</TableCell>
                  <TableCell>{STATUTS[s.statut] ?? s.statut}</TableCell>
                  <TableCell>{lues(s)}</TableCell>
                  <TableCell>{s.nb_articles ?? "Non renseigné"}</TableCell>
                  <TableCell>{s.nb_sujets ?? "Non renseigné"}</TableCell>
                  <TableCell>{s.degrade ? "Partiels" : "Complets"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section aria-labelledby="demandes">
        <h2 id="demandes" className="mb-3 text-lg font-semibold text-foreground">Demandes</h2>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Créée le</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.demandes.length === 0 && (
                <TableRow><TableCell colSpan={2} className="text-muted-foreground">Aucune demande.</TableCell></TableRow>
              )}
              {data?.demandes.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{formatDateTime(d.created_at)}</TableCell>
                  <TableCell>{STATUTS[d.statut] ?? d.statut}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section aria-labelledby="abonnes">
        <h2 id="abonnes" className="mb-3 text-lg font-semibold text-foreground">Abonnés</h2>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Rubriques</TableHead>
                <TableHead>Inscription</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.profils.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{maskEmail(p.email)}</TableCell>
                  <TableCell>{p.canal === "discord" ? "Discord" : "Email"}</TableCell>
                  <TableCell>{p.rubriques.length}</TableCell>
                  <TableCell>{formatDateTime(p.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
