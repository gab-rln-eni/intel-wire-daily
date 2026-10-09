import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime, todayParis } from "@/lib/rubriques";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Segments } from "@/components/Segments";
import {
  listerUtilisateurs,
  reactiverUtilisateur,
  supprimerUtilisateur,
  suspendreUtilisateur,
  type UtilisateurAdmin,
} from "@/lib/admin.functions";

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
      const [syn, dem] = await Promise.all([
        supabase.from("syntheses").select("*").order("date_veille", { ascending: false }),
        supabase.from("demandes").select("*").order("created_at", { ascending: false }),
      ]);
      const today = (syn.data ?? []).find((s) => s.date_veille === todayParis());
      let sujetsJour = 0;
      if (today) {
        const { count } = await supabase.from("sujets").select("id", { count: "exact", head: true }).eq("synthese_id", today.id);
        sujetsJour = count ?? 0;
      }
      return { syntheses: syn.data ?? [], demandes: dem.data ?? [], sujetsJour };
    },
  });

  const lancer = async () => {
    const { error } = await supabase.from("demandes").insert({ demandeur: userId, statut: "en_attente" });
    setNote(error ? "La demande n'a pas pu être enregistrée." : "Demande enregistrée ; prise en charge par la chaîne en bonus.");
    qc.invalidateQueries({ queryKey: ["admin"] });
  };

  const lister = useServerFn(listerUtilisateurs);
  const { data: utilisateurs } = useQuery({ queryKey: ["admin-utilisateurs"], queryFn: () => lister() });
  const actifs = utilisateurs?.filter((u) => !u.suspendu).length;

  const derniere = data?.syntheses.find((s) => s.statut === "envoyee");
  const lues = (s?: { nb_sources: number | null; nb_sources_echec: number | null }) =>
    s && s.nb_sources != null ? `${s.nb_sources - (s.nb_sources_echec ?? 0)} / ${s.nb_sources}` : "Non renseigné";

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="trait-fil">
          <p className="label-section">Administration</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.7rem]">Tableau de bord</h1>
        </div>
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
      {note && <p role="status" className="text-sm text-foreground">{note}</p>}

      <section aria-label="Compteurs" className="grille-filets sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Abonnés actifs" value={actifs != null ? `${actifs} / ${utilisateurs!.length}` : "..."} />
        <Stat label="Dernière synthèse" value={derniere ? formatDate(derniere.date_veille) : "Aucune"} />
        <Stat label="Sources lues" value={lues(derniere)} />
        <Stat label="Sujets du jour" value={String(data?.sujetsJour ?? "...")} />
      </section>

      <section aria-labelledby="journal">
        <h2 id="journal" className="label-section mb-3">Journal des synthèses</h2>
        <div className="border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Sources lues</TableHead>
                <TableHead>Entrées de flux lues</TableHead>
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
        <h2 id="demandes" className="label-section mb-3">Demandes</h2>
        <div className="border border-border bg-card">
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

      <GestionAbonnes utilisateurs={utilisateurs} moi={userId} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="label-section">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

type Filtre = "tous" | "actifs" | "suspendus";
type Action = { type: "suspendre" | "supprimer"; u: UtilisateurAdmin } | null;

/** Gestion des abonnés : recherche, filtre, suspension réversible et suppression définitive. */
function GestionAbonnes({ utilisateurs, moi }: { utilisateurs: UtilisateurAdmin[] | undefined; moi: string }) {
  const qc = useQueryClient();
  const suspendre = useServerFn(suspendreUtilisateur);
  const reactiver = useServerFn(reactiverUtilisateur);
  const supprimer = useServerFn(supprimerUtilisateur);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [action, setAction] = useState<Action>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (utilisateurs ?? []).filter(
      (u) =>
        (!q || u.email.toLowerCase().includes(q)) &&
        (filtre === "tous" || (filtre === "actifs" ? !u.suspendu : u.suspendu)),
    );
  }, [utilisateurs, recherche, filtre]);

  const executer = async (fn: () => Promise<unknown>, u: UtilisateurAdmin, ok: string) => {
    setOccupe(u.id);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, texte: ok });
      await qc.invalidateQueries({ queryKey: ["admin-utilisateurs"] });
    } catch (e) {
      setMsg({ ok: false, texte: e instanceof Error ? e.message : "Action impossible." });
    } finally {
      setOccupe(null);
      setAction(null);
    }
  };

  const nb = (f: Filtre) => (utilisateurs ?? []).filter((u) => f === "tous" || (f === "actifs" ? !u.suspendu : u.suspendu)).length;

  return (
    <section aria-labelledby="abonnes" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="abonnes" className="label-section">Abonnés et utilisateurs</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="search"
            aria-label="Rechercher par adresse email"
            placeholder="Rechercher un email"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="h-9 w-56"
          />
          <Segments<Filtre>
            label="Filtrer par statut"
            valeur={filtre}
            onChange={setFiltre}
            options={[
              { v: "tous", texte: "Tous", n: nb("tous") },
              { v: "actifs", texte: "Actifs", n: nb("actifs") },
              { v: "suspendus", texte: "Suspendus", n: nb("suspendus") },
            ]}
          />
        </div>
      </div>
      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? "text-foreground" : "text-destructive"}`}>
          {msg.texte}
        </p>
      )}
      <div className="overflow-x-auto border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Inscription</TableHead>
              <TableHead>Dernière connexion</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!utilisateurs && (
              <TableRow><TableCell colSpan={5} className="text-muted-foreground">Chargement...</TableCell></TableRow>
            )}
            {utilisateurs && liste.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-muted-foreground">Aucun utilisateur.</TableCell></TableRow>
            )}
            {liste.map((u) => (
              <TableRow key={u.id} className={u.suspendu ? "opacity-70" : undefined}>
                <TableCell>
                  <p className="font-mono text-xs text-foreground">
                    {u.email}
                    {u.admin && <span className="ml-2 border border-border px-1 py-0.5 text-[0.65rem] uppercase tracking-wide text-primary">admin</span>}
                    {u.id === moi && <span className="ml-1 text-ink3">(vous)</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-ink3">
                    Connexion {u.fournisseur === "google" ? "Google" : "email"} | reçoit par {u.canal === "discord" ? "Discord" : "email"} | {u.nb_rubriques} rubrique{u.nb_rubriques > 1 ? "s" : ""}
                  </p>
                </TableCell>
                <TableCell className="whitespace-nowrap">{formatDateTime(u.inscrit_le)}</TableCell>
                <TableCell className="whitespace-nowrap">{u.derniere_connexion ? formatDateTime(u.derniere_connexion) : "Jamais"}</TableCell>
                <TableCell>
                  <Statut u={u} />
                </TableCell>
                <TableCell className="text-right">
                  {u.admin || u.id === moi ? (
                    <span className="text-xs text-ink3">Protégé</span>
                  ) : (
                    <div className="flex justify-end gap-2">
                      {u.suspendu ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2.5 text-xs"
                          disabled={occupe === u.id}
                          onClick={() => executer(() => reactiver({ data: { id: u.id } }), u, `${u.email} est réactivé.`)}
                        >
                          Réactiver
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" disabled={occupe === u.id} onClick={() => setAction({ type: "suspendre", u })}>
                          Suspendre
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" className="h-8 px-2.5 text-xs" disabled={occupe === u.id} onClick={() => setAction({ type: "supprimer", u })}>
                        Supprimer
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Suspendre bloque toute nouvelle connexion et retire l'abonné de la diffusion ; c'est réversible. Supprimer efface le compte et ses préférences, définitivement.
      </p>

      <AlertDialog open={action !== null} onOpenChange={(o) => !o && setAction(null)}>
        <AlertDialogContent>
          {action && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {action.type === "suspendre" ? "Suspendre cet utilisateur ?" : "Supprimer définitivement ce compte ?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="font-mono">{action.u.email}</span>
                  {action.type === "suspendre"
                    ? " ne pourra plus se connecter et ne recevra plus la synthèse. Vous pourrez le réactiver à tout moment. Une session déjà ouverte peut rester active jusqu'à une heure."
                    : " sera supprimé avec son profil et ses préférences. Cette action est irréversible."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className={action.type === "supprimer" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    const u = action.u;
                    if (action.type === "suspendre") executer(() => suspendre({ data: { id: u.id } }), u, `${u.email} est suspendu.`);
                    else executer(() => supprimer({ data: { id: u.id } }), u, `${u.email} est supprimé.`);
                  }}
                >
                  {action.type === "suspendre" ? "Suspendre" : "Supprimer définitivement"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function Statut({ u }: { u: UtilisateurAdmin }) {
  const [texte, point] = u.suspendu
    ? ["Suspendu", "bg-primary border-primary"]
    : !u.confirme
      ? ["Non confirmé", "border-dashed border-ink3"]
      : ["Actif", "bg-ink3 border-ink3"];
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap text-sm ${u.suspendu ? "text-primary" : "text-foreground"}`}>
      <span aria-hidden="true" className={`h-2 w-2 rounded-full border-[1.5px] ${point}`} />
      {texte}
    </span>
  );
}
