import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
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
import { Marque } from "@/components/Layout";
import {
  listerUtilisateurs,
  reactiverUtilisateur,
  supprimerUtilisateur,
  suspendreUtilisateur,
  type UtilisateurAdmin,
} from "@/lib/admin.functions";

type Section = "apercu" | "syntheses" | "abonnes" | "demandes";
const SECTIONS: Section[] = ["apercu", "syntheses", "abonnes", "demandes"];
const FORMULAIRE_SOURCES = "https://docs.google.com/forms/d/e/1FAIpQLSfXm_fq5V8gyo35l-rn-6AsE8wa4LGSR7WADUjRV0DR4TDZ1w/viewform";

export const Route = createFileRoute("/admin")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { section?: Section } => {
    const v = s["section"];
    return SECTIONS.includes(v as Section) && v !== "apercu" ? { section: v as Section } : {};
  },
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/" });
    const { data: ok } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    if (!ok) throw redirect({ to: "/" });
    return { userId: data.user.id };
  },
  head: () => ({
    meta: [
      { title: "Administration | Le Fil IA" },
      { name: "description", content: "Console d'administration : chaîne de veille, synthèses, abonnés et demandes." },
      { property: "og:title", content: "Administration | Le Fil IA" },
      { property: "og:description", content: "Console d'administration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

const STATUTS: Record<string, string> = {
  envoyee: "Publiée",
  en_cours: "En cours",
  echec: "Échec",
  en_attente: "En attente",
  prise: "Prise en charge",
  terminee: "Terminée",
};

type Etat = "ok" | "alerte" | "attente" | "neutre";

/** Point d'état du thème : une seule couleur d'alerte, le vermillon. */
function Point({ etat }: { etat: Etat }) {
  const cls =
    etat === "ok"
      ? "bg-ink3 border-ink3"
      : etat === "alerte"
        ? "bg-primary border-primary"
        : etat === "attente"
          ? "border-primary border-2"
          : "border-dashed border-ink3";
  return <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 rounded-full border-[1.5px] ${cls}`} />;
}

const heure = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }) : "";
const court = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

function Admin() {
  const { userId } = Route.useRouteContext();
  const { section = "apercu" } = Route.useSearch();

  const { data } = useQuery({
    queryKey: ["admin"],
    queryFn: async () => {
      const [syn, dem] = await Promise.all([
        supabase.from("syntheses").select("*").order("date_veille", { ascending: false }),
        supabase.from("demandes").select("*").order("created_at", { ascending: false }),
      ]);
      return { syntheses: syn.data ?? [], demandes: dem.data ?? [] };
    },
  });
  const lister = useServerFn(listerUtilisateurs);
  const { data: utilisateurs } = useQuery({ queryKey: ["admin-utilisateurs"], queryFn: () => lister() });

  const syntheses = data?.syntheses ?? [];
  const demandes = data?.demandes ?? [];
  const publiees = syntheses.filter((s) => s.statut === "envoyee" && !s.exemple);
  const derniere = publiees[0];
  const duJour = derniere?.date_veille === todayParis();
  const enAttente = demandes.filter((d) => d.statut === "en_attente").length;
  const suspendus = utilisateurs?.filter((u) => u.suspendu).length ?? 0;

  const menu: { s: Section; texte: string; n?: number | undefined }[] = [
    { s: "apercu", texte: "Vue d'ensemble" },
    { s: "syntheses", texte: "Synthèses", n: publiees.length },
    { s: "abonnes", texte: "Abonnés", n: utilisateurs?.length },
    { s: "demandes", texte: "Demandes", n: enAttente || undefined },
  ];

  return (
    // La console occupe une largeur plus grande que les pages de lecture
    <div className="relative left-1/2 w-[min(calc(100vw-2rem),1240px)] -translate-x-1/2">
      <div className="border border-border bg-card">
        {/* Barre de console */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted px-5 py-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <Marque className="h-3.5 w-3.5 text-foreground" />
            <b className="font-semibold text-foreground">Administration</b>
            <span className="font-mono text-ink3">/admin{section !== "apercu" ? `/${section}` : ""}</span>
          </span>
          <span className="flex items-center gap-2">
            <Point etat={duJour ? "ok" : "alerte"} />
            {duJour ? `Chaîne à jour : synthèse du jour publiée à ${heure(derniere?.envoye_le)}` : "Pas de synthèse publiée aujourd'hui"}
          </span>
        </div>

        <div className="flex flex-col md:flex-row">
          {/* Menu latéral */}
          <nav aria-label="Sections d'administration" className="border-b border-border md:w-52 md:shrink-0 md:border-b-0 md:border-r md:py-4">
            <ul className="flex overflow-x-auto md:block">
              {menu.map((m) => (
                <li key={m.s}>
                  <Link
                    to="/admin"
                    search={m.s === "apercu" ? {} : { section: m.s }}
                    aria-current={section === m.s ? "page" : undefined}
                    className={`flex items-center justify-between gap-3 whitespace-nowrap px-5 py-2 text-[13px] transition-colors ${
                      section === m.s ? "font-semibold text-foreground filet-actif md:bg-transparent" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.texte}
                    {m.n != null && <span className={`font-mono text-xs ${m.s === "demandes" ? "text-primary" : "text-ink3"}`}>{m.n}</span>}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
              <p className="label-section mt-6 px-5">Outils</p>
              <a href={FORMULAIRE_SOURCES} target="_blank" rel="noopener noreferrer" className="block px-5 py-2 text-[13px] text-muted-foreground hover:text-foreground">
                Gérer les sources ↗<span className="sr-only"> (nouvel onglet)</span>
              </a>
              <a href="/" target="_blank" rel="noopener noreferrer" className="block px-5 py-2 text-[13px] text-muted-foreground hover:text-foreground">
                Voir le site public ↗<span className="sr-only"> (nouvel onglet)</span>
              </a>
            </div>
          </nav>

          {/* Contenu */}
          <div className="min-w-0 flex-1 p-5 md:p-6">
            {section === "apercu" && (
              <Apercu
                syntheses={publiees}
                derniere={derniere}
                duJour={duJour}
                utilisateurs={utilisateurs}
                enAttente={enAttente}
                suspendus={suspendus}
              />
            )}
            {section === "syntheses" && <Journal syntheses={syntheses} />}
            {section === "abonnes" && <GestionAbonnes utilisateurs={utilisateurs} moi={userId} />}
            {section === "demandes" && <Demandes demandes={demandes} userId={userId} />}
          </div>
        </div>
      </div>
    </div>
  );
}

type Synthese = {
  id: string;
  date_veille: string;
  statut: string;
  nb_sources: number | null;
  nb_sources_echec: number | null;
  nb_articles: number | null;
  nb_sujets: number | null;
  degrade: boolean;
  exemple: boolean;
  envoye_le: string | null;
};

function Titre({ label, titre, children }: { label: string; titre: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="label-section">{label}</p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">{titre}</h1>
      </div>
      {children}
    </div>
  );
}

function Apercu({ syntheses, derniere, duJour, utilisateurs, enAttente, suspendus }: {
  syntheses: Synthese[];
  derniere: Synthese | undefined;
  duJour: boolean;
  utilisateurs: UtilisateurAdmin[] | undefined;
  enAttente: number;
  suspendus: number;
}) {
  const lus = derniere?.nb_sources != null ? derniere.nb_sources - (derniere.nb_sources_echec ?? 0) : null;
  const recents = (utilisateurs ?? []).slice(0, 5);
  return (
    <>
      <Titre label="Vue d'ensemble" titre="État du service" />
      <div className="grille-filets grid-cols-2 lg:grid-cols-4">
        <Stat label="Abonnés actifs" value={utilisateurs ? `${utilisateurs.length - suspendus}` : "..."} detail={utilisateurs ? `${suspendus} suspendu${suspendus > 1 ? "s" : ""}` : ""} />
        <Stat label="Dernière publication" value={derniere ? court(derniere.date_veille) : "Aucune"} detail={derniere?.envoye_le ? `à ${heure(derniere.envoye_le)}` : ""} />
        <Stat label="Flux lus" value={lus != null ? `${lus} / ${derniere!.nb_sources}` : "..."} detail={derniere?.nb_sources_echec ? `${derniere.nb_sources_echec} en échec` : "aucun échec"} />
        <Stat label="Sujets du jour" value={duJour ? String(derniere!.nb_sujets ?? 0) : "0"} detail={derniere?.degrade ? "résumés partiels" : "résumés complets"} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <section aria-labelledby="chaine" className="min-w-0">
          <h2 id="chaine" className="label-section mb-3">Chaîne de veille</h2>
          <dl className="divide-y divide-line2 border border-border text-[13px]">
            {[
              { e: (duJour ? "ok" : "alerte") as Etat, k: "Collecte n8n", v: duJour ? "Synthèse du jour reçue" : "Rien reçu aujourd'hui" },
              { e: (derniere?.envoye_le ? "ok" : "neutre") as Etat, k: "Publication vers l'app", v: derniere?.envoye_le ? formatDateTime(derniere.envoye_le) : "Jamais" },
              { e: (derniere?.degrade ? "attente" : "ok") as Etat, k: "Résumés par le modèle", v: derniere?.degrade ? "Partiels (quota ou panne)" : "Complets" },
              { e: (derniere?.nb_sources_echec ? "attente" : "ok") as Etat, k: "Flux RSS", v: derniere?.nb_sources_echec ? `${derniere.nb_sources_echec} source en échec` : "Tous lus" },
              { e: (enAttente ? "attente" : "neutre") as Etat, k: "Demandes de veille", v: enAttente ? `${enAttente} en attente` : "Aucune" },
            ].map((l) => (
              <div key={l.k} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="flex shrink-0 items-center gap-2.5 text-muted-foreground">
                  <Point etat={l.e} />
                  {l.k}
                </dt>
                <dd className="min-w-0 text-right font-medium text-foreground">{l.v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="console" className="min-w-0">
          <h2 id="console" className="label-section mb-3">Journal des 7 derniers jours</h2>
          <pre className="overflow-x-auto bg-[#14171B] px-4 py-3.5 font-mono text-[11.5px] leading-[1.95] text-[#D6D2C6] dark:bg-[#090B0E]">
            <span className="text-[#7C838C]">{"date   statut    flux    entrées  sujets  résumés\n"}</span>
            {syntheses.slice(0, 7).map((s) => (
              <span key={s.id}>
                {court(s.date_veille).padEnd(7)}
                <span className={s.statut === "envoyee" ? "text-[#F2F0EA]" : "text-[#D9603F]"}>{(STATUTS[s.statut] ?? s.statut).padEnd(10)}</span>
                {`${s.nb_sources != null ? `${s.nb_sources - (s.nb_sources_echec ?? 0)}/${s.nb_sources}` : "-"}`.padEnd(8)}
                {String(s.nb_articles ?? "-").padEnd(9)}
                {String(s.nb_sujets ?? "-").padEnd(8)}
                {s.degrade ? <span className="text-[#D9603F]">partiels</span> : "complets"}
                {"\n"}
              </span>
            ))}
            {syntheses.length === 0 && <span className="text-[#7C838C]">aucune synthèse publiée</span>}
          </pre>
        </section>
      </div>

      <section aria-labelledby="inscriptions" className="mt-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="inscriptions" className="label-section">Dernières inscriptions</h2>
          <Link to="/admin" search={{ section: "abonnes" }} className="link-accent text-xs">Gérer les abonnés →</Link>
        </div>
        <ul className="divide-y divide-line2 border border-border text-[13px]">
          {!utilisateurs && <li className="px-4 py-2.5 text-muted-foreground">Chargement...</li>}
          {recents.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className="truncate font-mono text-xs text-foreground">{u.email}</span>
              <span className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                <span className="hidden sm:inline">{u.canal === "discord" ? "Discord" : "Email"}</span>
                <span>{formatDateTime(u.inscrit_le)}</span>
                <Statut u={u} />
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Journal({ syntheses }: { syntheses: Synthese[] }) {
  return (
    <>
      <Titre label="Synthèses" titre="Journal des publications" />
      <div className="overflow-x-auto border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Publiée à</TableHead>
              <TableHead className="text-right">Flux lus</TableHead>
              <TableHead className="text-right">Entrées</TableHead>
              <TableHead className="text-right">Sujets</TableHead>
              <TableHead>Résumés</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {syntheses.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDate(s.date_veille)}
                  {s.exemple && <span className="ml-2 font-mono text-[0.65rem] uppercase text-ink3">exemple</span>}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <Point etat={s.statut === "envoyee" ? "ok" : s.statut === "echec" ? "alerte" : "attente"} />
                    {STATUTS[s.statut] ?? s.statut}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">{s.envoye_le ? heure(s.envoye_le) : "-"}</TableCell>
                <TableCell className="text-right font-mono text-xs">{s.nb_sources != null ? `${s.nb_sources - (s.nb_sources_echec ?? 0)} / ${s.nb_sources}` : "-"}</TableCell>
                <TableCell className="text-right font-mono text-xs">{s.nb_articles?.toLocaleString("fr-FR") ?? "-"}</TableCell>
                <TableCell className="text-right font-mono text-xs">{s.nb_sujets ?? "-"}</TableCell>
                <TableCell>{s.degrade ? <span className="text-primary">Partiels</span> : "Complets"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

type Demande = { id: string; created_at: string; statut: string };

function Demandes({ demandes, userId }: { demandes: Demande[]; userId: string }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);
  const enAttente = demandes.some((d) => d.statut === "en_attente");
  const lancer = async () => {
    const { error } = await supabase.from("demandes").insert({ demandeur: userId, statut: "en_attente" });
    setMsg(error ? { ok: false, texte: "La demande n'a pas pu être enregistrée." } : { ok: true, texte: "Demande enregistrée." });
    qc.invalidateQueries({ queryKey: ["admin"] });
  };
  return (
    <>
      <Titre label="Demandes" titre="Veilles à la demande">
        <Button onClick={lancer} disabled={enAttente}>
          {enAttente ? "Demande déjà en attente" : "Lancer une veille"}
        </Button>
      </Titre>
      <div className="mb-5 flex gap-3 border border-border bg-accent-soft px-4 py-3 text-[13px] text-foreground">
        <Point etat="attente" />
        <p className="-mt-1 leading-relaxed">
          <b className="font-semibold">Traitement non branché.</b> Une demande est enregistrée ici, mais la chaîne n8n ne lit pas encore cette file :
          la veille tourne seule chaque matin. Le branchement est en attente de décision (D-WEB-7).
        </p>
      </div>
      {msg && <p role="status" className={`mb-3 text-sm ${msg.ok ? "text-foreground" : "text-destructive"}`}>{msg.texte}</p>}
      <div className="overflow-x-auto border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Créée le</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {demandes.length === 0 && (
              <TableRow><TableCell colSpan={2} className="text-muted-foreground">Aucune demande.</TableCell></TableRow>
            )}
            {demandes.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{formatDateTime(d.created_at)}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <Point etat={d.statut === "terminee" ? "ok" : d.statut === "echec" ? "alerte" : "attente"} />
                    {STATUTS[d.statut] ?? d.statut}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="bg-card px-4 py-3.5">
      <p className="label-section">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-foreground tabular-nums">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-ink3">{detail}</p>}
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
        <div>
          <p className="label-section">Abonnés</p>
          <h1 id="abonnes" className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">Utilisateurs et abonnés</h1>
        </div>
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
      <div className="overflow-x-auto border border-border">
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
