import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  basculerModeTest,
  CATEGORIES,
  definirVeilleur,
  demanderNettoyage,
  lancerMaintenance,
  purgerJournal,
  proposerActionSource,
  validerActionSource,
  type ProposeSource,
  lancerVeille,
  listerUtilisateurs,
  reactiverUtilisateur,
  supprimerUtilisateur,
  suspendreUtilisateur,
  type UtilisateurAdmin,
} from "@/lib/admin.functions";

// Console réduite au strict nécessaire (consigne G_R) : Synthèses fondu dans la Vue d'ensemble ; Journal d'audit ajouté (D-WEB-12)
type Section = "apercu" | "sources" | "abonnes" | "demandes" | "journal";
const SECTIONS: Section[] = ["apercu", "sources", "abonnes", "demandes", "journal"];
const FORMULAIRE_SOURCES =
  "https://docs.google.com/forms/d/e/1FAIpQLSfXm_fq5V8gyo35l-rn-6AsE8wa4LGSR7WADUjRV0DR4TDZ1w/viewform";

export const Route = createFileRoute("/admin")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { section?: Section } => {
    const v = s["section"];
    return SECTIONS.includes(v as Section) && v !== "apercu" ? { section: v as Section } : {};
  },
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/" });
    // Console ouverte à l'admin et au veilleur ; chaque action est revérifiée côté serveur
    const [{ data: a }, { data: v }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: data.user.id, _role: "veilleur" as "admin" }),
    ]);
    if (!a && !v) throw redirect({ to: "/" });
    return { userId: data.user.id, role: (a ? "admin" : "veilleur") as "admin" | "veilleur" };
  },
  head: () => ({
    meta: [
      { title: "Administration | Le Fil IA" },
      {
        name: "description",
        content: "Console d'administration : chaîne de veille, synthèses, abonnés et demandes.",
      },
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
  prise: "En cours",
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
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 shrink-0 rounded-full border-[1.5px] ${cls}`}
    />
  );
}

const heure = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleTimeString("fr-FR", {
        timeZone: "Europe/Paris",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
const court = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

function Admin() {
  const { userId, role } = Route.useRouteContext();
  const { section = "apercu" } = Route.useSearch();
  const estAdmin = role === "admin";
  const qc = useQueryClient();
  const basculer = useServerFn(basculerModeTest);

  const { data } = useQuery({
    queryKey: ["admin"],
    refetchInterval: 30000,
    queryFn: async () => {
      const [syn, dem, ch, mt] = await Promise.all([
        supabase.from("syntheses").select("*").order("date_veille", { ascending: false }),
        supabase.from("demandes").select("*").order("created_at", { ascending: false }).limit(30),
        // Table ajoutée hors des types générés (signe de vie de n8n)
        (
          supabase.from as unknown as (t: string) => {
            select: (c: string) => {
              maybeSingle: () => Promise<{ data: { dernier_appel: string | null } | null }>;
            };
          }
        )
          .bind(supabase)("chaine_etat")
          .select("dernier_appel")
          .maybeSingle(),
        (
          supabase.from as unknown as (t: string) => {
            select: (c: string) => {
              eq: (
                k: string,
                v: string,
              ) => {
                maybeSingle: () => Promise<{
                  data: { valeur: unknown; maj_le: string; maj_par: string | null } | null;
                }>;
              };
            };
          }
        )
          .bind(supabase)("parametres")
          .select("valeur, maj_le, maj_par")
          .eq("cle", "mode_test")
          .maybeSingle(),
      ]);
      return {
        syntheses: syn.data ?? [],
        demandes: (dem.data ?? []) as unknown as Demande[],
        dernierAppel: ch.data?.dernier_appel ?? null,
        modeTest: mt.data?.valeur === true,
        modeTestMaj: mt.data
          ? `${formatDateTime(mt.data.maj_le)}${mt.data.maj_par ? ` par ${mt.data.maj_par}` : ""}`
          : "",
      };
    },
  });
  const lister = useServerFn(listerUtilisateurs);
  const { data: liste } = useQuery({ queryKey: ["admin-utilisateurs"], queryFn: () => lister() });
  const utilisateurs = liste?.utilisateurs;
  const modeTest = data?.modeTest ?? false;
  const [bascule, setBascule] = useState<string | null>(null);
  const [basculeEnCours, setBasculeEnCours] = useState(false);
  const basculerMode = async () => {
    if (basculeEnCours) return; // un seul envoi à la fois (double clic)
    setBasculeEnCours(true);
    setBascule(null);
    try {
      await basculer({ data: { actif: !modeTest } });
      await qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) {
      setBascule(e instanceof Error ? e.message : "Bascule impossible");
    } finally {
      setBasculeEnCours(false);
    }
  };

  const syntheses = data?.syntheses ?? [];
  const demandes = data?.demandes ?? [];
  const publiees = syntheses.filter((s) => s.statut === "envoyee" && !s.exemple);
  const derniere = publiees[0];
  const duJour = derniere?.date_veille === todayParis();
  const enAttente = demandes.filter(
    (d) => d.statut === "en_attente" || d.statut === "prise",
  ).length;
  const n8n = etatN8n(data?.dernierAppel ?? null);
  const suspendus = utilisateurs?.filter((u) => u.suspendu).length ?? 0;
  const { data: src } = useQuery({
    queryKey: ["admin-sources"],
    queryFn: lireSources,
    // Suivi en direct : toutes les 10 s tant qu'une action est ouverte, sinon toutes les 30 s
    refetchInterval: (q) => (q.state.data?.actions.some((a) => ouverte(a.statut)) ? 10000 : 30000),
  });
  const aValider = estAdmin
    ? (src?.actions.filter((a) => a.statut === "a_valider").length ?? 0)
    : 0;

  const menu: { s: Section; texte: string; n?: number | undefined }[] = [
    { s: "apercu", texte: "Vue d'ensemble" },
    { s: "sources", texte: "Sources", n: aValider || undefined },
    { s: "abonnes", texte: "Abonnés", n: utilisateurs?.length },
    { s: "demandes", texte: "Demandes", n: enAttente || undefined },
    { s: "journal", texte: "Journal" },
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
            <span className="font-mono text-ink3">
              /admin{section !== "apercu" ? `/${section}` : ""}
            </span>
            {!estAdmin && (
              <span className="border border-border px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wide text-ink3">
                veilleur
              </span>
            )}
          </span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-2">
              <Point etat={duJour ? "ok" : "alerte"} />
              {duJour
                ? `Chaîne à jour : synthèse du jour publiée à ${heure(derniere?.envoye_le)}`
                : "Pas de synthèse publiée aujourd'hui"}
            </span>
            {/* Mode test (D-WEB-16) : bascule réservée au propriétaire, état visible par toute l'équipe */}
            {estAdmin ? (
              <button
                type="button"
                role="switch"
                aria-checked={modeTest}
                aria-busy={basculeEnCours}
                disabled={basculeEnCours}
                onClick={basculerMode}
                className={`flex items-center gap-2 border px-2 py-1 font-medium transition-colors ${modeTest ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-ink3"}`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-2 w-2 rounded-full ${modeTest ? "bg-primary-foreground" : "border border-ink3"}`}
                />
                Mode test : {basculeEnCours ? "..." : modeTest ? "activé" : "désactivé"}
              </button>
            ) : (
              <span className={modeTest ? "font-semibold text-primary" : ""}>
                Mode test : {modeTest ? "activé" : "désactivé"}
              </span>
            )}
          </span>
        </div>
        {modeTest && (
          <div
            role="status"
            className="border-b border-primary bg-accent-soft px-5 py-2 text-[13px] text-foreground"
          >
            <b className="font-semibold">Mode test actif</b> ({data?.modeTestMaj}) : pas de
            diffusion Discord, et les emails de la synthèse ne partent qu'à l'équipe ; aucun abonné
            n'est servi.
          </div>
        )}
        {bascule && (
          <p role="alert" className="border-b border-border px-5 py-2 text-[13px] text-destructive">
            {bascule}
          </p>
        )}

        <div className="flex flex-col md:flex-row">
          {/* Menu latéral */}
          <nav
            aria-label="Sections d'administration"
            className="border-b border-border md:w-52 md:shrink-0 md:border-b-0 md:border-r md:py-4"
          >
            <ul className="flex overflow-x-auto md:block">
              {menu.map((m) => (
                <li key={m.s}>
                  <Link
                    to="/admin"
                    search={m.s === "apercu" ? {} : { section: m.s }}
                    aria-current={section === m.s ? "page" : undefined}
                    className={`flex items-center justify-between gap-3 whitespace-nowrap px-5 py-2 text-[13px] transition-colors ${
                      section === m.s
                        ? "font-semibold text-foreground filet-actif md:bg-transparent"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.texte}
                    {m.n != null && (
                      <span
                        className={`font-mono text-xs ${m.s === "demandes" || m.s === "sources" ? "text-primary" : "text-ink3"}`}
                      >
                        {m.n}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
              <p className="label-section mt-6 px-5">Outils</p>
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="block px-5 py-2 text-[13px] text-muted-foreground hover:text-foreground"
              >
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
                n8n={n8n}
                estAdmin={estAdmin}
              />
            )}
            {section === "sources" && <Sources donnees={src} estAdmin={estAdmin} />}
            {section === "abonnes" && (
              <GestionAbonnes utilisateurs={utilisateurs} moi={userId} estAdmin={estAdmin} />
            )}
            {section === "journal" && <JournalAudit estAdmin={estAdmin} />}
            {section === "demandes" && <Demandes demandes={demandes} n8n={n8n} />}
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

function Apercu({
  syntheses,
  derniere,
  duJour,
  utilisateurs,
  enAttente,
  suspendus,
  n8n,
  estAdmin,
}: {
  syntheses: Synthese[];
  derniere: Synthese | undefined;
  duJour: boolean;
  utilisateurs: UtilisateurAdmin[] | undefined;
  enAttente: number;
  suspendus: number;
  n8n: EtatN8n;
  estAdmin: boolean;
}) {
  const lus =
    derniere?.nb_sources != null ? derniere.nb_sources - (derniere.nb_sources_echec ?? 0) : null;
  const recents = (utilisateurs ?? []).slice(0, 5);
  return (
    <>
      <Titre label="Vue d'ensemble" titre="État du service" />
      <div className="grille-filets grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Abonnés actifs"
          value={utilisateurs ? `${utilisateurs.length - suspendus}` : "..."}
          detail={utilisateurs ? `${suspendus} suspendu${suspendus > 1 ? "s" : ""}` : ""}
        />
        <Stat
          label="Dernière publication"
          value={derniere ? court(derniere.date_veille) : "Aucune"}
          detail={derniere?.envoye_le ? `à ${heure(derniere.envoye_le)}` : ""}
        />
        <Stat
          label="Flux lus"
          value={lus != null ? `${lus} / ${derniere!.nb_sources}` : "..."}
          detail={
            derniere?.nb_sources_echec ? `${derniere.nb_sources_echec} en échec` : "aucun échec"
          }
        />
        <Stat
          label="Sujets du jour"
          value={duJour ? String(derniere!.nb_sujets ?? 0) : "0"}
          detail={derniere?.degrade ? "résumés partiels" : "résumés complets"}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <section aria-labelledby="chaine" className="min-w-0">
          <h2 id="chaine" className="label-section mb-3">
            Chaîne de veille
          </h2>
          <dl className="divide-y divide-line2 border border-border text-[13px]">
            {[
              {
                e: (duJour ? "ok" : "alerte") as Etat,
                k: "Collecte n8n",
                v: duJour ? "Synthèse du jour reçue" : "Rien reçu aujourd'hui",
              },
              {
                e: (derniere?.envoye_le ? "ok" : "neutre") as Etat,
                k: "Publication vers l'app",
                v: derniere?.envoye_le ? formatDateTime(derniere.envoye_le) : "Jamais",
              },
              {
                e: (derniere?.degrade ? "attente" : "ok") as Etat,
                k: "Résumés par le modèle",
                v: derniere?.degrade ? "Partiels (quota ou panne)" : "Complets",
              },
              {
                e: (derniere?.nb_sources_echec ? "attente" : "ok") as Etat,
                k: "Flux RSS",
                v: derniere?.nb_sources_echec
                  ? `${derniere.nb_sources_echec} source en échec`
                  : "Tous lus",
              },
              { e: n8n.etat, k: "n8n (file des demandes)", v: n8n.texte },
              {
                e: (enAttente ? "attente" : "neutre") as Etat,
                k: "Demandes de veille",
                v: enAttente ? `${enAttente} en cours` : "Aucune",
              },
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
          <h2 id="console" className="label-section mb-3">
            Journal des 7 derniers jours
          </h2>
          <pre className="overflow-x-auto bg-[#14171B] px-4 py-3.5 font-mono text-[11.5px] leading-[1.95] text-[#D6D2C6] dark:bg-[#090B0E]">
            <span className="text-[#7C838C]">
              {"date   statut    flux    entrées  sujets  résumés\n"}
            </span>
            {syntheses.slice(0, 7).map((s) => (
              <span key={s.id}>
                {court(s.date_veille).padEnd(7)}
                <span className={s.statut === "envoyee" ? "text-[#F2F0EA]" : "text-[#D9603F]"}>
                  {(STATUTS[s.statut] ?? s.statut).padEnd(10)}
                </span>
                {`${s.nb_sources != null ? `${s.nb_sources - (s.nb_sources_echec ?? 0)}/${s.nb_sources}` : "-"}`.padEnd(
                  8,
                )}
                {String(s.nb_articles ?? "-").padEnd(9)}
                {String(s.nb_sujets ?? "-").padEnd(8)}
                {s.degrade ? <span className="text-[#D9603F]">partiels</span> : "complets"}
                {"\n"}
              </span>
            ))}
            {syntheses.length === 0 && (
              <span className="text-[#7C838C]">aucune synthèse publiée</span>
            )}
          </pre>
        </section>
      </div>

      <section aria-labelledby="inscriptions" className="mt-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="inscriptions" className="label-section">
            Dernières inscriptions
          </h2>
          <Link to="/admin" search={{ section: "abonnes" }} className="link-accent text-xs">
            Gérer les abonnés →
          </Link>
        </div>
        <ul className="divide-y divide-line2 border border-border text-[13px]">
          {!utilisateurs && <li className="px-4 py-2.5 text-muted-foreground">Chargement...</li>}
          {recents.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className="truncate font-mono text-xs text-foreground">{u.email}</span>
              <span className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                <span className="hidden sm:inline">
                  {u.canal === "discord"
                    ? "Discord"
                    : u.canal === "aucun"
                      ? "Aucun envoi"
                      : "Email"}
                </span>
                <span>{formatDateTime(u.inscrit_le)}</span>
                <Statut u={u} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      {estAdmin && <Maintenance />}
    </>
  );
}

/* ---------- Maintenance des données (M-1 à M-6) : admin seul, chaque action confirmée ---------- */

type EtatMaintenance = {
  le?: string;
  par?: string;
  erreur?: string;
  resultat?: Record<string, number>;
} | null;
type Nettoyage = {
  id: string;
  cree_le: string;
  salon: string;
  portee: string;
  mode: string;
  statut: string;
  supprimes: number;
  detail: string | null;
  termine_le: string | null;
};

const LIBELLES_PURGE: Record<string, string> = {
  demandes: "demande",
  journal: "ligne de journal",
  actions_sources: "action sur source",
  lectures: "lecture",
  syntheses: "synthèse",
  comptes_non_confirmes: "compte non confirmé",
  nettoyages: "nettoyage",
};

function resumePurge(r: Record<string, number> | undefined) {
  const l = Object.entries(r ?? {})
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${LIBELLES_PURGE[k] ?? k}${n > 1 ? "s" : ""}`);
  return l.length ? `Purge : ${l.join(", ")}` : "Rien à purger";
}

type Dialogue =
  | { type: "maintenance" }
  | { type: "journal"; jours: number; saisie: string }
  | { type: "salon"; salon: "alertes" | "assistant"; portee: "30j" | "tout" }
  | null;

function Maintenance() {
  const qc = useQueryClient();
  const maintenir = useServerFn(lancerMaintenance);
  const purger = useServerFn(purgerJournal);
  const nettoyer = useServerFn(demanderNettoyage);
  const [dlg, setDlg] = useState<Dialogue>(null);
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);
  const { data } = useQuery({
    queryKey: ["admin-maintenance"],
    refetchInterval: (q) =>
      q.state.data?.nettoyages.some((n) => n.statut === "en_attente" || n.statut === "prise")
        ? 10000
        : 60000,
    queryFn: async () => {
      // Tables ajoutées hors des types générés : accès non typé, lié à son client
      const lire = (
        supabase.from as unknown as (t: string) => {
          select: (c: string) => {
            eq: (
              k: string,
              v: string,
            ) => { maybeSingle: () => Promise<{ data: { valeur: unknown } | null }> };
            order: (
              k: string,
              o: object,
            ) => { limit: (n: number) => Promise<{ data: unknown[] | null }> };
          };
        }
      ).bind(supabase);
      const [p, n] = await Promise.all([
        lire("parametres").select("valeur").eq("cle", "maintenance").maybeSingle(),
        lire("nettoyages_salons")
          .select("id, cree_le, salon, portee, mode, statut, supprimes, detail, termine_le")
          .order("cree_le", { ascending: false })
          .limit(4),
      ]);
      return {
        etat: (p.data?.valeur ?? null) as EtatMaintenance,
        nettoyages: (n.data ?? []) as Nettoyage[],
      };
    },
  });
  const etat = data?.etat;

  const confirmer = async () => {
    if (!dlg || occupe) return;
    setOccupe(true);
    setMsg(null);
    try {
      if (dlg.type === "maintenance") {
        const r = await maintenir();
        setMsg({ ok: true, texte: `Maintenance faite. ${resumePurge(r.resultat)}.` });
      } else if (dlg.type === "journal") {
        const r = await purger({ data: { jours: dlg.jours } });
        setMsg({
          ok: true,
          texte: `Journal purgé : ${r.supprimees} ligne${r.supprimees > 1 ? "s" : ""} de plus de ${dlg.jours} jours effacée${r.supprimees > 1 ? "s" : ""}. La purge est inscrite au journal.`,
        });
        await qc.invalidateQueries({ queryKey: ["admin-journal"] });
      } else {
        await nettoyer({ data: { salon: dlg.salon, portee: dlg.portee } });
        setMsg({
          ok: true,
          texte: `Nettoyage de #${dlg.salon} transmis : n8n l'applique sous 2 minutes environ (PC allumé).`,
        });
      }
      setDlg(null);
      await qc.invalidateQueries({ queryKey: ["admin-maintenance"] });
    } catch (e) {
      setMsg({ ok: false, texte: e instanceof Error ? e.message : "Action impossible." });
      setDlg(null);
    } finally {
      setOccupe(false);
    }
  };
  const peutConfirmer =
    !occupe && !(dlg?.type === "journal" && dlg.saisie.trim().toUpperCase() !== "PURGER");

  return (
    <section aria-labelledby="maintenance" className="mt-6">
      <h2 id="maintenance" className="label-section mb-3">
        Maintenance des données
      </h2>
      <div className="border border-border text-[13px]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="flex min-w-0 items-start gap-2.5">
            <span className="mt-1.5">
              <Point etat={etat?.erreur ? "alerte" : etat?.le ? "ok" : "neutre"} />
            </span>
            <span>
              {etat?.le ? (
                <>
                  <b className="font-semibold text-foreground">
                    Dernier passage : {formatDateTime(etat.le)}
                  </b>
                  <span className="text-muted-foreground">
                    {" "}
                    ({etat.par === "automatique" || !etat.par ? "automatique" : etat.par})
                  </span>
                  <span
                    className={`block text-xs ${etat.erreur ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {etat.erreur ? `Erreur : ${etat.erreur}` : resumePurge(etat.resultat)}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  Pas encore de passage : la maintenance tourne d'elle même une fois par jour, au
                  relevé de n8n.
                </span>
              )}
            </span>
          </p>
          <span className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-xs"
              onClick={() => setDlg({ type: "maintenance" })}
            >
              Lancer la maintenance
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-xs"
              onClick={() => setDlg({ type: "salon", salon: "assistant", portee: "30j" })}
            >
              Nettoyer un salon
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-xs"
              onClick={() => setDlg({ type: "journal", jours: 90, saisie: "" })}
            >
              Purger le journal
            </Button>
          </span>
        </div>
        {(data?.nettoyages.length ?? 0) > 0 && (
          <ul className="divide-y divide-line2 border-t border-border">
            {data!.nettoyages.map((n) => (
              <li
                key={n.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-xs"
              >
                <span className="inline-flex items-center gap-2 text-foreground">
                  <Point
                    etat={
                      n.statut === "terminee" ? "ok" : n.statut === "echec" ? "alerte" : "attente"
                    }
                  />
                  #{n.salon} | {n.portee === "tout" ? "tous les messages" : "plus de 30 jours"} |{" "}
                  {n.mode === "auto" ? "automatique" : "manuel"}
                </span>
                <span className={n.statut === "echec" ? "text-primary" : "text-muted-foreground"}>
                  {n.statut === "en_attente"
                    ? `en file${n.supprimes ? `, ${n.supprimes} supprimés` : ""}`
                    : n.statut === "prise"
                      ? "en cours dans n8n"
                      : n.statut === "terminee"
                        ? `${n.supprimes} message${n.supprimes > 1 ? "s" : ""} supprimé${n.supprimes > 1 ? "s" : ""}`
                        : `échec${n.detail ? ` : ${n.detail}` : ""}`}
                  {" | "}
                  {formatDateTime(n.termine_le ?? n.cree_le)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {msg && (
        <p
          role="status"
          className={`mt-2 text-sm ${msg.ok ? "text-foreground" : "text-destructive"}`}
        >
          {msg.texte}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Durées : demandes 90 jours, lectures 90 jours, synthèses 12 mois, journal 12 mois, comptes
        non confirmés 30 jours. Salons : #alertes et #assistant nettoyés chaque jour au delà de 30
        jours ; #synthese-du-jour conservé.
      </p>

      <AlertDialog open={dlg !== null} onOpenChange={(o) => !o && !occupe && setDlg(null)}>
        <AlertDialogContent>
          {dlg && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (peutConfirmer) confirmer();
              }}
              className="space-y-4"
            >
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {dlg.type === "maintenance"
                    ? "Lancer la maintenance maintenant ?"
                    : dlg.type === "journal"
                      ? "Purger le journal d'audit ?"
                      : "Nettoyer un salon Discord ?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {dlg.type === "maintenance"
                    ? "Les données arrivées au bout de leur durée de conservation sont effacées définitivement (voir les durées sous la carte)."
                    : dlg.type === "journal"
                      ? "Les lignes plus anciennes que la durée choisie sont effacées définitivement. La purge elle même reste inscrite au journal, sans pouvoir être effacée."
                      : "Les messages du salon sont supprimés définitivement par le bot n8n. Les messages épinglés sont conservés."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {dlg.type === "journal" && (
                <div className="grid gap-3">
                  <label className="grid gap-1 text-[13px]">
                    Effacer les lignes de plus de
                    <select
                      value={dlg.jours}
                      onChange={(e) => setDlg({ ...dlg, jours: Number(e.target.value) })}
                      className="h-9 border border-input bg-background px-2 text-[13px]"
                    >
                      <option value={90}>90 jours</option>
                      <option value={180}>180 jours</option>
                      <option value={365}>365 jours</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-[13px]">
                    Pour confirmer, tapez PURGER
                    <Input
                      value={dlg.saisie}
                      onChange={(e) => setDlg({ ...dlg, saisie: e.target.value })}
                      autoComplete="off"
                      className="font-mono"
                    />
                  </label>
                </div>
              )}
              {dlg.type === "salon" && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-[13px]">
                    Salon
                    <select
                      value={dlg.salon}
                      onChange={(e) =>
                        setDlg({ ...dlg, salon: e.target.value as "alertes" | "assistant" })
                      }
                      className="h-9 border border-input bg-background px-2 text-[13px]"
                    >
                      <option value="assistant">#assistant</option>
                      <option value="alertes">#alertes</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-[13px]">
                    Messages
                    <select
                      value={dlg.portee}
                      onChange={(e) => setDlg({ ...dlg, portee: e.target.value as "30j" | "tout" })}
                      className="h-9 border border-input bg-background px-2 text-[13px]"
                    >
                      <option value="30j">de plus de 30 jours</option>
                      <option value="tout">tous</option>
                    </select>
                  </label>
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel type="button" disabled={occupe}>
                  Annuler
                </AlertDialogCancel>
                <Button
                  type="submit"
                  variant={dlg.type === "maintenance" ? "default" : "destructive"}
                  disabled={!peutConfirmer}
                >
                  {occupe
                    ? "Envoi..."
                    : dlg.type === "maintenance"
                      ? "Lancer"
                      : dlg.type === "journal"
                        ? "Purger"
                        : "Nettoyer"}
                </Button>
              </AlertDialogFooter>
            </form>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

type Demande = {
  id: string;
  created_at: string;
  statut: string;
  pris_le: string | null;
  termine_le: string | null;
  detail: string | null;
};
type EtatN8n = { etat: Etat; texte: string };

/** Signe de vie : n8n interroge l'app toutes les 2 minutes de 6 h à 22 h, quand le PC est allumé. */
function etatN8n(dernier: string | null): EtatN8n {
  if (!dernier) return { etat: "neutre", texte: "Jamais vu" };
  const min = Math.round((Date.now() - Date.parse(dernier)) / 60000);
  if (min <= 5)
    return { etat: "ok", texte: min <= 1 ? "En ligne" : `En ligne (vu il y a ${min} min)` };
  return {
    etat: "alerte",
    texte: `Hors ligne depuis ${min < 120 ? `${min} min` : formatDateTime(dernier)}`,
  };
}

function Demandes({ demandes, n8n }: { demandes: Demande[]; n8n: EtatN8n }) {
  const qc = useQueryClient();
  const lancer = useServerFn(lancerVeille);
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);
  const [occupe, setOccupe] = useState(false);
  const enCours = demandes.find((d) => d.statut === "en_attente" || d.statut === "prise");
  const go = async () => {
    setOccupe(true);
    setMsg(null);
    try {
      await lancer();
      setMsg({
        ok: true,
        texte: "Demande enregistrée : n8n la prendra en charge sous 2 minutes environ.",
      });
    } catch (e) {
      setMsg({ ok: false, texte: e instanceof Error ? e.message : "Demande impossible." });
    } finally {
      setOccupe(false);
      qc.invalidateQueries({ queryKey: ["admin"] });
    }
  };
  return (
    <>
      <Titre label="Demandes" titre="Veilles à la demande">
        <Button onClick={go} disabled={!!enCours || occupe}>
          {enCours
            ? enCours.statut === "prise"
              ? "Veille en cours..."
              : "Demande en attente..."
            : "Lancer une veille"}
        </Button>
      </Titre>
      <div className="mb-5 grid gap-px border border-border bg-border text-[13px] sm:grid-cols-2">
        <div className="flex items-start gap-3 bg-card px-4 py-3">
          <span className="mt-1.5">
            <Point etat={n8n.etat} />
          </span>
          <p className="leading-relaxed">
            <b className="font-semibold text-foreground">n8n : {n8n.texte}.</b>{" "}
            <span className="text-muted-foreground">
              La file est relevée toutes les 2 minutes, de 6 h à 22 h, quand le PC est allumé.
            </span>
          </p>
        </div>
        <div className="bg-card px-4 py-3 leading-relaxed text-muted-foreground">
          Une veille à la demande <b className="font-semibold text-foreground">ajoute</b> les
          articles parus depuis la dernière veille à la synthèse du jour, sans nouvelle diffusion
          Discord. Limites : une à la fois, 15 min d'écart, 5 par jour.
        </div>
      </div>
      {msg && (
        <p
          role="status"
          className={`mb-3 text-sm ${msg.ok ? "text-foreground" : "text-destructive"}`}
        >
          {msg.texte}
        </p>
      )}
      <div className="overflow-x-auto border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Demandée le</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Prise à</TableHead>
              <TableHead>Terminée à</TableHead>
              <TableHead>Résultat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {demandes.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Aucune demande.
                </TableCell>
              </TableRow>
            )}
            {demandes.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="whitespace-nowrap">{formatDateTime(d.created_at)}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <Point
                      etat={
                        d.statut === "terminee" ? "ok" : d.statut === "echec" ? "alerte" : "attente"
                      }
                    />
                    {STATUTS[d.statut] ?? d.statut}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">{heure(d.pris_le) || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{heure(d.termine_le) || "-"}</TableCell>
                <TableCell
                  className={`text-[13px] ${d.statut === "echec" ? "text-primary" : "text-muted-foreground"}`}
                >
                  {d.detail ?? "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

type LigneJournal = {
  id: string;
  cree_le: string;
  auteur_email: string | null;
  role: string | null;
  action: string;
  cible: string | null;
  detail: string | null;
  resultat: string;
};

/** Journal d'audit (D-WEB-12) : tout pour l'admin, ses propres actions pour le veilleur (filtré par la base). */
function JournalAudit({ estAdmin }: { estAdmin: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-journal"],
    queryFn: async () => {
      // Table ajoutée hors des types générés : accès non typé, lié à son client
      const lire = (
        supabase.from as unknown as (t: string) => {
          select: (c: string) => {
            order: (
              k: string,
              o: object,
            ) => { limit: (n: number) => Promise<{ data: LigneJournal[] | null }> };
          };
        }
      ).bind(supabase);
      const { data } = await lire("admin_journal")
        .select("id, cree_le, auteur_email, role, action, cible, detail, resultat")
        .order("cree_le", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });
  const lignes = data ?? [];
  const col = estAdmin ? 5 : 4;
  return (
    <>
      <Titre label="Journal" titre={estAdmin ? "Actions de l'équipe" : "Mes actions"}>
        <p className="text-xs text-ink3">200 dernières actions | conservées 12 mois</p>
      </Titre>
      <div className="overflow-x-auto border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              {estAdmin && <TableHead>Auteur</TableHead>}
              <TableHead>Action</TableHead>
              <TableHead>Cible</TableHead>
              <TableHead>Résultat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={col} className="text-muted-foreground">
                  Chargement...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && lignes.length === 0 && (
              <TableRow>
                <TableCell colSpan={col} className="text-muted-foreground">
                  Aucune action enregistrée.
                </TableCell>
              </TableRow>
            )}
            {lignes.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-nowrap font-mono text-xs">
                  {formatDateTime(l.cree_le)}
                </TableCell>
                {estAdmin && (
                  <TableCell className="font-mono text-xs">
                    {l.auteur_email}
                    {l.role === "veilleur" && <span className="ml-1 text-ink3">(veilleur)</span>}
                  </TableCell>
                )}
                <TableCell className="text-[13px]">{l.action}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{l.cible}</TableCell>
                <TableCell className="text-[13px]">
                  <span className="inline-flex items-center gap-2">
                    <Point etat={l.resultat === "ok" ? "ok" : "alerte"} />
                    {l.resultat === "ok" ? "Fait" : `Refusé${l.detail ? ` : ${l.detail}` : ""}`}
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
function GestionAbonnes({
  utilisateurs,
  moi,
  estAdmin,
}: {
  utilisateurs: UtilisateurAdmin[] | undefined;
  moi: string;
  estAdmin: boolean;
}) {
  const qc = useQueryClient();
  const veilleur = useServerFn(definirVeilleur);
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

  const nb = (f: Filtre) =>
    (utilisateurs ?? []).filter((u) => f === "tous" || (f === "actifs" ? !u.suspendu : u.suspendu))
      .length;

  return (
    <section aria-labelledby="abonnes" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-section">Abonnés</p>
          <h1 id="abonnes" className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">
            Utilisateurs et abonnés
          </h1>
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
              {estAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!utilisateurs && (
              <TableRow>
                <TableCell colSpan={estAdmin ? 5 : 4} className="text-muted-foreground">
                  Chargement...
                </TableCell>
              </TableRow>
            )}
            {utilisateurs && liste.length === 0 && (
              <TableRow>
                <TableCell colSpan={estAdmin ? 5 : 4} className="text-muted-foreground">
                  Aucun utilisateur.
                </TableCell>
              </TableRow>
            )}
            {liste.map((u) => (
              <TableRow key={u.id} className={u.suspendu ? "opacity-70" : undefined}>
                <TableCell>
                  <p className="font-mono text-xs text-foreground">
                    {u.email}
                    {u.role !== "abonne" && (
                      <span
                        className={`ml-2 border border-border px-1 py-0.5 text-[0.65rem] uppercase tracking-wide ${u.role === "admin" ? "text-primary" : "text-foreground"}`}
                      >
                        {u.role}
                      </span>
                    )}
                    {u.id === moi && <span className="ml-1 text-ink3">(vous)</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-ink3">
                    Connexion {u.fournisseur === "google" ? "Google" : "email"} |{" "}
                    {u.canal === "aucun"
                      ? "ne reçoit rien"
                      : `reçoit par ${u.canal === "discord" ? "Discord" : "email"}`}{" "}
                    | {u.nb_rubriques} rubrique{u.nb_rubriques > 1 ? "s" : ""}
                  </p>
                </TableCell>
                <TableCell className="whitespace-nowrap">{formatDateTime(u.inscrit_le)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {u.derniere_connexion ? formatDateTime(u.derniere_connexion) : "Jamais"}
                </TableCell>
                <TableCell>
                  <Statut u={u} />
                </TableCell>
                {estAdmin && (
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
                            onClick={() =>
                              executer(
                                () => reactiver({ data: { id: u.id } }),
                                u,
                                `${u.email} est réactivé.`,
                              )
                            }
                          >
                            Réactiver
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs"
                            disabled={occupe === u.id}
                            onClick={() => setAction({ type: "suspendre", u })}
                          >
                            Suspendre
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 px-2.5 text-xs"
                          disabled={occupe === u.id}
                          onClick={() => setAction({ type: "supprimer", u })}
                        >
                          Supprimer
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          disabled={occupe === u.id || u.suspendu}
                          title={
                            u.role === "veilleur"
                              ? "Retirer le rôle de veilleur"
                              : "Donner le rôle restreint de veilleur"
                          }
                          onClick={() =>
                            executer(
                              () =>
                                veilleur({ data: { id: u.id, veilleur: u.role !== "veilleur" } }),
                              u,
                              u.role === "veilleur"
                                ? `${u.email} n'est plus veilleur.`
                                : `${u.email} est maintenant veilleur.`,
                            )
                          }
                        >
                          {u.role === "veilleur" ? "Retirer veilleur" : "Nommer veilleur"}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {estAdmin
          ? "Suspendre bloque toute nouvelle connexion et retire l'abonné de la diffusion ; c'est réversible. Supprimer efface le compte et ses préférences, définitivement. Le veilleur voit la console avec les emails masqués et peut lancer une veille, sans agir sur les comptes. Chaque action est inscrite au journal."
          : "Rôle veilleur : emails masqués, aucune action sur les comptes."}
      </p>

      <AlertDialog open={action !== null} onOpenChange={(o) => !o && setAction(null)}>
        <AlertDialogContent>
          {action && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {action.type === "suspendre"
                    ? "Suspendre cet utilisateur ?"
                    : "Supprimer définitivement ce compte ?"}
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
                  className={
                    action.type === "supprimer"
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : undefined
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    const u = action.u;
                    if (action.type === "suspendre")
                      executer(
                        () => suspendre({ data: { id: u.id } }),
                        u,
                        `${u.email} est suspendu.`,
                      );
                    else
                      executer(
                        () => supprimer({ data: { id: u.id } }),
                        u,
                        `${u.email} est supprimé.`,
                      );
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
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap text-sm ${u.suspendu ? "text-primary" : "text-foreground"}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full border-[1.5px] ${point}`} />
      {texte}
    </span>
  );
}

/* ---------- Sources (D-WEB-9, D-WEB-17 b) ---------- */

type SourceMiroir = {
  nom: string;
  url: string | null;
  categorie: string | null;
  priorite: number | null;
  active: boolean;
  statut_sante: string | null;
  jours_echec: number | null;
  nb_articles: number | null;
  sante_le: string | null;
};
type ActionSrc = {
  id: string;
  cree_le: string;
  auteur_email: string | null;
  role: string | null;
  action: string;
  nom: string;
  url: string | null;
  motif: string;
  statut: string;
  detail: string | null;
  traite_le: string | null;
};
type DonneesSources = { sources: SourceMiroir[]; actions: ActionSrc[]; majLe: string | null };

async function lireSources(): Promise<DonneesSources> {
  // Tables ajoutées hors des types générés : accès non typé, lié à son client
  const lire = (
    supabase.from as unknown as (t: string) => {
      select: (c: string) => {
        order: (
          k: string,
          o: object,
        ) => { limit: (n: number) => Promise<{ data: unknown[] | null }> };
        eq: (
          k: string,
          v: string,
        ) => { maybeSingle: () => Promise<{ data: { valeur: unknown } | null }> };
      };
    }
  ).bind(supabase);
  const [s, a, m] = await Promise.all([
    lire("sources_miroir")
      .select(
        "nom, url, categorie, priorite, active, statut_sante, jours_echec, nb_articles, sante_le",
      )
      .order("nom", { ascending: true })
      .limit(500),
    lire("actions_sources")
      .select("id, cree_le, auteur_email, role, action, nom, url, motif, statut, detail, traite_le")
      .order("cree_le", { ascending: false })
      .limit(20),
    lire("parametres").select("valeur").eq("cle", "sources_maj").maybeSingle(),
  ]);
  return {
    sources: (s.data ?? []) as SourceMiroir[],
    actions: (a.data ?? []) as ActionSrc[],
    majLe: typeof m.data?.valeur === "string" ? m.data.valeur : null,
  };
}

const STATUTS_ACTION: Record<string, string> = {
  a_valider: "À valider",
  en_attente: "Transmise",
  prise: "En cours",
  appliquee: "Appliquée",
  refusee: "Refusée",
  annulee: "Rejetée",
};
const ouverte = (st: string) => st === "a_valider" || st === "en_attente" || st === "prise";
/** Action close depuis moins de 15 minutes : son résultat reste affiché sur la ligne. */
const recent = (a: ActionSrc) =>
  !ouverte(a.statut) && Date.now() - Date.parse(a.traite_le ?? a.cree_le) < 15 * 60000;

/** Suivi d'une action sur la ligne de sa source : où elle en est, ou son résultat récent. */
function SuiviAction({ a }: { a: ActionSrc }) {
  const etat: Etat =
    a.statut === "appliquee"
      ? "ok"
      : a.statut === "refusee"
        ? "alerte"
        : ouverte(a.statut)
          ? "attente"
          : "neutre";
  const geste =
    { Ajouter: "Ajout", Activer: "Activation", Désactiver: "Désactivation" }[a.action] ?? a.action;
  const texte =
    a.statut === "en_attente"
      ? `${geste} | en file depuis ${heure(a.cree_le)}, n8n sous 2 min`
      : a.statut === "prise"
        ? `${geste} | en cours dans n8n`
        : a.statut === "a_valider"
          ? `${geste} | à valider par l'admin`
          : a.statut === "appliquee"
            ? `${geste} | faite à ${heure(a.traite_le)}`
            : a.statut === "refusee"
              ? `${geste} | refus à ${heure(a.traite_le)}${a.detail ? ` : ${a.detail}` : ""}`
              : `${geste} | rejet à ${heure(a.traite_le)}`;
  return (
    <span
      role="status"
      className={`inline-flex items-start gap-1.5 text-left text-xs ${etat === "alerte" ? "text-primary" : "text-muted-foreground"}`}
    >
      <span className="mt-1">
        <Point etat={etat} />
      </span>
      <span>{texte}</span>
    </span>
  );
}

function santeDe(s: SourceMiroir): { etat: Etat; texte: string } {
  if (!s.active) return { etat: "neutre", texte: "Inactive" };
  if (!s.statut_sante) return { etat: "neutre", texte: "Pas encore relevée" };
  if (s.statut_sante.toUpperCase() === "OK") return { etat: "ok", texte: "OK" };
  const j = s.jours_echec ?? 0;
  return { etat: j >= 3 ? "alerte" : "attente", texte: `En échec${j ? ` (${j} j)` : ""}` };
}

type FiltreSrc = "toutes" | "actives" | "inactives" | "alerte";
type Saisie = {
  action: ProposeSource["action"];
  nom: string;
  url: string;
  categorie: string;
  priorite: string;
  motif: string;
};

/** Sources : miroir du classeur (lecture), gestes simples (Désactiver, Activer, Ajouter) appliqués par n8n avec les contrôles du formulaire. */
function Sources({
  donnees,
  estAdmin,
}: {
  donnees: DonneesSources | undefined;
  estAdmin: boolean;
}) {
  const qc = useQueryClient();
  const proposer = useServerFn(proposerActionSource);
  const valider = useServerFn(validerActionSource);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<FiltreSrc>("toutes");
  const [saisie, setSaisie] = useState<Saisie | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);

  const sources = useMemo(() => donnees?.sources ?? [], [donnees]);
  const actions = donnees?.actions ?? [];
  // Dernière action par source (liste triée de la plus récente à la plus ancienne) : le suivi s'affiche sur la ligne même
  const derniere = new Map<string, ActionSrc>();
  for (const a of actions) if (!derniere.has(a.nom)) derniere.set(a.nom, a);
  const aValider = actions.filter((a) => a.statut === "a_valider");
  const connues = new Set(sources.map((s) => s.nom.toLowerCase()));
  // Ajouts pas encore dans le miroir : affichés en tête du tableau, pour suivre l'ajout sans chercher
  const ajouts = actions.filter(
    (a) =>
      a.action === "Ajouter" &&
      !connues.has(a.nom.toLowerCase()) &&
      (ouverte(a.statut) || recent(a)),
  );
  const historique = actions.filter((a) => a.statut !== "a_valider");
  const compte = (f: FiltreSrc) =>
    sources.filter(
      (s) =>
        f === "toutes" ||
        (f === "actives" ? s.active : f === "inactives" ? !s.active : santeDe(s).etat === "alerte"),
    ).length;
  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return sources.filter(
      (s) =>
        (!q || s.nom.toLowerCase().includes(q) || (s.url ?? "").toLowerCase().includes(q)) &&
        (filtre === "toutes" ||
          (filtre === "actives"
            ? s.active
            : filtre === "inactives"
              ? !s.active
              : santeDe(s).etat === "alerte")),
    );
  }, [sources, recherche, filtre]);

  const ouvrir = (action: Saisie["action"], nom = "") => {
    setErreur("");
    setSaisie({ action, nom, url: "", categorie: "Autre", priorite: "1", motif: "" });
  };
  const envoyer = async () => {
    if (!saisie || occupe) return;
    setOccupe(true);
    setErreur("");
    try {
      const r = await proposer({ data: saisie });
      setSaisie(null);
      setMsg({
        ok: true,
        texte: r.a_valider
          ? `${saisie.action} « ${saisie.nom} » : soumise à la validation de l'administrateur.`
          : `${saisie.action} « ${saisie.nom} » : transmise ; le suivi s'affiche sur la ligne de la source.`,
      });
      await qc.invalidateQueries({ queryKey: ["admin-sources"] });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setOccupe(false);
    }
  };
  const [decision, setDecision] = useState<string | null>(null);
  const decider = async (a: ActionSrc, accepter: boolean) => {
    if (decision) return;
    setDecision(a.id);
    setMsg(null);
    try {
      await valider({ data: { id: a.id, accepter } });
      setMsg({
        ok: true,
        texte: `${a.action} « ${a.nom} » : ${accepter ? "validée et transmise à n8n" : "rejetée"}.`,
      });
      await qc.invalidateQueries({ queryKey: ["admin-sources"] });
    } catch (e) {
      setMsg({ ok: false, texte: e instanceof Error ? e.message : "Action impossible." });
    } finally {
      setDecision(null);
    }
  };
  const champ = (k: keyof Saisie) => (e: { target: { value: string } }) =>
    saisie && setSaisie({ ...saisie, [k]: e.target.value });

  return (
    <section aria-labelledby="sources" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-section">Sources</p>
          <h1 id="sources" className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">
            Sources de la veille
          </h1>
          <p className="mt-1 text-xs text-ink3">
            {donnees?.majLe
              ? `Classeur relu le ${formatDateTime(donnees.majLe)}`
              : "Classeur pas encore relu par n8n"}{" "}
            | {compte("actives")} actives sur {sources.length}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="search"
            aria-label="Rechercher une source"
            placeholder="Rechercher une source"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="h-9 w-52"
          />
          <Segments<FiltreSrc>
            label="Filtrer les sources"
            valeur={filtre}
            onChange={setFiltre}
            options={[
              { v: "toutes", texte: "Toutes", n: compte("toutes") },
              { v: "actives", texte: "Actives", n: compte("actives") },
              { v: "inactives", texte: "Inactives", n: compte("inactives") },
              { v: "alerte", texte: "En alerte", n: compte("alerte") },
            ]}
          />
          <Button onClick={() => ouvrir("Ajouter")}>Ajouter une source</Button>
        </div>
      </div>
      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? "text-foreground" : "text-destructive"}`}>
          {msg.texte}
        </p>
      )}

      {estAdmin && aValider.length > 0 && (
        <div className="border border-primary">
          <p className="border-b border-primary bg-accent-soft px-4 py-2 text-[13px] font-semibold text-foreground">
            {aValider.length} proposition{aValider.length > 1 ? "s" : ""} du veilleur à valider
          </p>
          <ul className="divide-y divide-border">
            {aValider.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-[13px]"
              >
                <span className="min-w-0">
                  <b className="font-semibold text-foreground">
                    {a.action} « {a.nom} »
                  </b>
                  {a.url && (
                    <span className="ml-2 break-all font-mono text-xs text-ink3">{a.url}</span>
                  )}
                  <span className="block text-xs text-muted-foreground">
                    Motif : {a.motif} | {a.auteur_email} | {formatDateTime(a.cree_le)}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-8 px-2.5 text-xs"
                    disabled={!!decision}
                    onClick={() => decider(a, true)}
                  >
                    Valider
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 text-xs"
                    disabled={!!decision}
                    onClick={() => decider(a, false)}
                  >
                    Rejeter
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-center">Priorité</TableHead>
              <TableHead>Santé</TableHead>
              <TableHead className="text-right">Articles</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!donnees && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Chargement...
                </TableCell>
              </TableRow>
            )}
            {donnees && liste.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  {sources.length
                    ? "Aucune source pour ce filtre."
                    : "Le miroir des sources est vide : le workflow Miroir sources de n8n ne l'a pas encore publié."}
                </TableCell>
              </TableRow>
            )}
            {ajouts.map((a) => (
              <TableRow key={a.id} className="bg-muted/40">
                <TableCell className="max-w-[22rem]">
                  <p className="text-[13px] font-medium text-foreground">
                    {a.nom}{" "}
                    <span className="ml-1 border border-border px-1 text-[0.65rem] uppercase tracking-wide text-ink3">
                      nouvelle
                    </span>
                  </p>
                  {a.url && (
                    <p className="truncate font-mono text-xs text-ink3" title={a.url}>
                      {a.url}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-[13px] text-ink3" colSpan={4}>
                  Pas encore dans le classeur
                </TableCell>
                <TableCell className="text-right">
                  <SuiviAction a={a} />
                </TableCell>
              </TableRow>
            ))}
            {liste.map((s) => {
              const sante = santeDe(s);
              const suivi = derniere.get(s.nom);
              return (
                <TableRow key={s.nom} className={s.active ? undefined : "opacity-70"}>
                  <TableCell className="max-w-[22rem]">
                    <p className="text-[13px] font-medium text-foreground">{s.nom}</p>
                    {s.url && (
                      <p className="truncate font-mono text-xs text-ink3" title={s.url}>
                        {s.url}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[13px]">
                    {s.categorie || "-"}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {s.priorite ?? "-"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-2 whitespace-nowrap text-[13px] ${sante.etat === "alerte" ? "text-primary" : ""}`}
                    >
                      <Point etat={sante.etat} />
                      {sante.texte}
                    </span>
                    {s.sante_le && s.active && (
                      <span className="block whitespace-nowrap text-xs text-ink3">
                        relevé du {court(s.sante_le)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {s.nb_articles ?? "-"}
                  </TableCell>
                  <TableCell className="w-56 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      {suivi && (ouverte(suivi.statut) || recent(suivi)) && (
                        <SuiviAction a={suivi} />
                      )}
                      {!(suivi && ouverte(suivi.statut)) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2.5 text-xs"
                          onClick={() => ouvrir(s.active ? "Désactiver" : "Activer", s.nom)}
                        >
                          {s.active ? "Désactiver" : "Activer"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {historique.length > 0 && (
        <details className="group border border-border">
          <summary className="cursor-pointer select-none px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground">
            Historique des actions sur les sources ({historique.length})
          </summary>
          <ul className="divide-y divide-border border-t border-border text-[13px]">
            {historique.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Point
                    etat={
                      a.statut === "appliquee"
                        ? "ok"
                        : a.statut === "refusee"
                          ? "alerte"
                          : ouverte(a.statut)
                            ? "attente"
                            : "neutre"
                    }
                  />
                  <span className="text-foreground">
                    {a.action} « {a.nom} »
                  </span>
                </span>
                <span
                  className={`text-xs ${a.statut === "refusee" ? "text-primary" : "text-muted-foreground"}`}
                >
                  {STATUTS_ACTION[a.statut] ?? a.statut}
                  {a.detail ? ` : ${a.detail}` : ""} | {formatDateTime(a.traite_le ?? a.cree_le)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-xs text-muted-foreground">
        Le classeur SOURCES reste la référence : n8n y applique chaque action avec les contrôles du
        formulaire (URL valide, pas de doublon, source connue), l'inscrit dans l'HISTORIQUE, puis la
        liste ci-dessus est relue.{" "}
        {estAdmin
          ? "Les ajouts et réactivations proposés par le veilleur attendent votre validation. "
          : "Rôle veilleur : désactiver une source est immédiat ; ajouter ou réactiver attend la validation de l'administrateur. "}
        {estAdmin && (
          <a
            href={FORMULAIRE_SOURCES}
            target="_blank"
            rel="noopener noreferrer"
            className="link-accent"
          >
            Formulaire des sources (secours)<span className="sr-only"> (nouvel onglet)</span>
          </a>
        )}
      </p>

      <AlertDialog open={saisie !== null} onOpenChange={(o) => !o && !occupe && setSaisie(null)}>
        <AlertDialogContent>
          {saisie && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                envoyer();
              }}
              className="space-y-4"
            >
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {saisie.action === "Ajouter"
                    ? "Ajouter une source"
                    : `${saisie.action} « ${saisie.nom} »`}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {saisie.action === "Ajouter"
                    ? "La source est ajoutée au classeur, active, et lue dès la prochaine veille."
                    : saisie.action === "Désactiver"
                      ? "La source n'est plus lue à partir de la prochaine veille. Réversible."
                      : "La source est de nouveau lue à partir de la prochaine veille."}
                  {!estAdmin &&
                    saisie.action !== "Désactiver" &&
                    " Votre proposition attend la validation de l'administrateur."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {saisie.action === "Ajouter" && (
                <div className="grid gap-3">
                  <label className="grid gap-1 text-[13px]">
                    Nom de la source
                    <Input
                      required
                      maxLength={200}
                      value={saisie.nom}
                      onChange={champ("nom")}
                      placeholder="Ex. : Hugging Face Blog"
                    />
                  </label>
                  <label className="grid gap-1 text-[13px]">
                    Adresse du flux RSS
                    <Input
                      required
                      type="url"
                      maxLength={500}
                      pattern="https?://\S+"
                      value={saisie.url}
                      onChange={champ("url")}
                      placeholder="https://..."
                      className="font-mono text-xs"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1 text-[13px]">
                      Catégorie
                      <select
                        value={saisie.categorie}
                        onChange={champ("categorie")}
                        className="h-9 border border-input bg-background px-2 text-[13px]"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-[13px]">
                      Priorité
                      <select
                        value={saisie.priorite}
                        onChange={champ("priorite")}
                        className="h-9 border border-input bg-background px-2 text-[13px]"
                      >
                        <option value="1">1 (haute)</option>
                        <option value="2">2</option>
                        <option value="3">3 (basse)</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}
              <label className="grid gap-1 text-[13px]">
                Motif
                <Input
                  required
                  maxLength={300}
                  value={saisie.motif}
                  onChange={champ("motif")}
                  placeholder={
                    saisie.action === "Désactiver"
                      ? "Ex. : flux mort depuis 8 jours"
                      : "Ex. : source de référence"
                  }
                />
              </label>
              {erreur && (
                <p role="alert" className="text-sm text-destructive">
                  {erreur}
                </p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel type="button" disabled={occupe}>
                  Annuler
                </AlertDialogCancel>
                <Button type="submit" disabled={occupe}>
                  {occupe
                    ? "Envoi..."
                    : !estAdmin && saisie.action !== "Désactiver"
                      ? "Proposer"
                      : saisie.action}
                </Button>
              </AlertDialogFooter>
            </form>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
