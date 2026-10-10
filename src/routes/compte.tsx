import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Apparition } from "@/components/Anime";
import { Segments } from "@/components/Segments";
import { supprimerCompte } from "@/lib/compte.functions";
import { verifierFavoris } from "@/lib/favoris.functions";
import {
  useActionsLecture,
  useFavoris,
  useLus,
  useRubriquesSuivies,
  useSujets,
  useSyntheses,
  type Favori,
  type SujetLu,
} from "@/lib/lecture";
import {
  INVITATION_DISCORD,
  RUBRIQUES,
  formatDate,
  rubriqueIndex,
  todayParis,
} from "@/lib/rubriques";

type Vue = "historique" | "donnees" | "articles";

export const Route = createFileRoute("/compte")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { vue?: Vue; id?: string } => {
    const vue = s["vue"];
    const id = s["id"];
    return {
      ...(vue === "historique" || vue === "donnees" || vue === "articles" ? { vue } : {}),
      ...(typeof id === "string" ? { id } : {}),
    };
  },
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/" });
    return { userId: data.user.id };
  },
  head: () => ({
    meta: [
      { title: "Mon compte | Le Fil IA" },
      {
        name: "description",
        content:
          "Votre synthèse IA, vos articles sauvegardés, votre historique et vos préférences de réception.",
      },
      { property: "og:title", content: "Mon compte | Le Fil IA" },
      { property: "og:description", content: "Synthèse, historique et préférences de réception." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Compte,
});

/** Ligne de réglage : intitulé et explication à gauche, réglage à droite (filets entre les lignes). */
function LigneReglage({
  id,
  titre,
  aide,
  children,
}: {
  id: string;
  titre: string;
  aide: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-4 p-5 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10"
    >
      <div>
        <h2 id={id} className="text-[14px] font-semibold text-foreground">
          {titre}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{aide}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** En-tête de page : trait vermillon, petit intitulé, titre. */
function EnTete({
  label,
  titre,
  id,
  children,
}: {
  label: string;
  titre: string;
  id?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="trait-fil">
      <p className="label-section">{label}</p>
      <h1
        id={id}
        className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.7rem]"
      >
        {titre}
      </h1>
      {children}
    </div>
  );
}

function Compte() {
  const { userId } = Route.useRouteContext();
  const { vue, id: selected } = Route.useSearch();
  const navigate = useNavigate({ from: "/compte" });
  const { data: syntheses = [] } = useSyntheses();
  const current = syntheses.find((s) => s.id === selected) ?? syntheses[0];

  if (vue === "donnees") {
    return (
      <div className="space-y-8">
        <EnTete label="Mon compte" titre="Mes données">
          <p className="mt-2 text-sm text-muted-foreground">
            Ce que vous recevez, sur quel canal, et la gestion de votre compte.
          </p>
        </EnTete>
        <div className="divide-y divide-border border border-border bg-card">
          <Preferences userId={userId} />
          <MesDonnees />
        </div>
      </div>
    );
  }

  if (vue === "articles") return <MesArticles userId={userId} />;

  if (vue === "historique") {
    return (
      <section aria-labelledby="historique-titre" className="space-y-8">
        <EnTete id="historique-titre" label="Archives" titre="Historique">
          <p className="mt-2 text-sm text-muted-foreground">
            {syntheses.length} synthèse{syntheses.length > 1 ? "s" : ""} publiée
            {syntheses.length > 1 ? "s" : ""}, de la plus récente à la plus ancienne.
          </p>
        </EnTete>
        {syntheses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune synthèse envoyée pour le moment.</p>
        ) : (
          <div className="border border-border bg-card">
            <div
              aria-hidden="true"
              className="hidden grid-cols-[1fr_7rem_9rem_2rem] gap-4 border-b border-border px-5 py-2.5 label-section sm:grid"
            >
              <span>Date</span>
              <span className="text-right">Sujets</span>
              <span className="text-right">Flux lus</span>
              <span />
            </div>
            <ul>
              {syntheses.map((s, i) => (
                <li key={s.id} className="border-b border-line2 last:border-b-0">
                  <Apparition delai={Math.min(i, 8) * 40}>
                    <button
                      type="button"
                      onClick={() => navigate({ search: i === 0 ? {} : { id: s.id } })}
                      className="group grid w-full grid-cols-[1fr_auto] items-baseline gap-4 px-5 py-3 text-left text-sm transition-colors hover:bg-accent-soft hover:filet-actif sm:grid-cols-[1fr_7rem_9rem_2rem]"
                    >
                      <span className="font-medium text-foreground">
                        {formatDate(s.date_veille)}
                        {i === 0 && (
                          <span className="ml-2 font-mono text-[0.68rem] uppercase tracking-wide text-primary">
                            dernière
                          </span>
                        )}
                        {s.exemple && (
                          <span className="ml-2 font-mono text-[0.68rem] uppercase tracking-wide text-ink3">
                            exemple
                          </span>
                        )}
                      </span>
                      <span className="text-right font-mono text-muted-foreground tabular-nums">
                        {s.nb_sujets ?? "-"}
                        <span className="sm:hidden"> sujets</span>
                      </span>
                      <span className="hidden text-right font-mono text-muted-foreground tabular-nums sm:block">
                        {s.nb_sources != null
                          ? `${s.nb_sources - (s.nb_sources_echec ?? 0)} / ${s.nb_sources}`
                          : "-"}
                      </span>
                      <span
                        aria-hidden="true"
                        className="hidden text-right text-ink3 transition-transform group-hover:translate-x-1 group-hover:text-primary sm:block"
                      >
                        →
                      </span>
                    </button>
                  </Apparition>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  const isLatest = !!current && current.id === syntheses[0]?.id;
  return (
    <Synthese
      userId={userId}
      synthese={current}
      isLatest={isLatest}
      onRetour={() => navigate({ search: {} })}
    />
  );
}

const AUTRES = "__autres__";

type SyntheseInfo = {
  id: string;
  date_veille: string;
  exemple: boolean;
  nb_sources: number | null;
  nb_sources_echec: number | null;
  nb_articles: number | null;
};

const heureP = (d?: string | null) =>
  d
    ? new Date(d).toLocaleTimeString("fr-FR", {
        timeZone: "Europe/Paris",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

/** Synthèse en boîte de réception : un onglet par rubrique avec ses non lus ; les lus se rangent, repliés, en bas de l'onglet. */
function Synthese({
  userId,
  synthese,
  isLatest,
  onRetour,
}: {
  userId: string;
  synthese: SyntheseInfo | undefined;
  isLatest: boolean;
  onRetour: () => void;
}) {
  const { data: sujets = [], isLoading } = useSujets(synthese?.id);
  const liens = useMemo(() => sujets.map((s) => s.lien), [sujets]);
  const { data: lus = new Set<string>() } = useLus(userId, liens);
  const { data: favoris = [] } = useFavoris(userId);
  const actions = useActionsLecture(userId);
  const etoiles = useMemo(() => new Set(favoris.map((f) => f.lien)), [favoris]);
  const [onglet, setOnglet] = useState<string | null | undefined>(undefined);
  const [erreur, setErreur] = useState("");

  // FON-02 : la synthèse s'ouvre sur les rubriques suivies ; les autres restent accessibles dans « Autres rubriques »
  const { data: suivies } = useRubriquesSuivies(userId);
  const suit = (r: string) => !suivies || suivies.has(r);
  const toutes = useMemo(
    () =>
      [...new Set(sujets.map((s) => s.rubrique))].sort(
        (a, b) => rubriqueIndex(a) - rubriqueIndex(b),
      ),
    [sujets],
  );
  const presentes = toutes.filter(suit);
  const autres = toutes.filter((r) => !suit(r));
  const dans = (r: string | null, s: SujetLu) =>
    r === null ? suit(s.rubrique) : r === AUTRES ? !suit(s.rubrique) : s.rubrique === r;
  const nonLus = (r: string | null) => sujets.filter((s) => dans(r, s) && !lus.has(s.lien)).length;
  // Onglet ouvert par défaut : la première rubrique qui a des non lus (sinon toutes)
  useEffect(() => setOnglet(undefined), [synthese?.id]);
  const actif = onglet !== undefined ? onglet : (presentes.find((r) => nonLus(r) > 0) ?? null);
  const dansOnglet = sujets.filter((s) => dans(actif, s));
  const aLire = dansOnglet.filter((s) => !lus.has(s.lien));
  const dejaLus = dansOnglet.filter((s) => lus.has(s.lien));
  const suivante = [...presentes, ...(autres.length ? [AUTRES] : [])].find(
    (r) => r !== actif && nonLus(r) > 0,
  );
  const nbSuivis = sujets.filter((s) => suit(s.rubrique)).length;
  const sourcesCitees = new Set(sujets.map((s) => s.source)).size;
  const fluxLus =
    synthese?.nb_sources != null ? synthese.nb_sources - (synthese.nb_sources_echec ?? 0) : null;
  const titre = synthese
    ? isLatest && synthese.date_veille === todayParis()
      ? "Synthèse du jour"
      : `Synthèse du ${formatDate(synthese.date_veille)}`
    : "Synthèse";

  const garde = async (fn: () => Promise<unknown>) => {
    setErreur("");
    try {
      await fn();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Action impossible.");
    }
  };

  const ligne = (s: SujetLu) => (
    <LigneSujet
      key={s.id}
      sujet={s}
      lu={lus.has(s.lien)}
      favori={etoiles.has(s.lien)}
      afficherRubrique={actif === null || actif === AUTRES}
      onOuvrir={() => garde(() => actions.marquerLus([s.lien]))}
      onLu={() =>
        garde(() => (lus.has(s.lien) ? actions.marquerNonLu(s.lien) : actions.marquerLus([s.lien])))
      }
      onFavori={() => garde(() => actions.basculerFavori(s.lien, etoiles.has(s.lien)))}
    />
  );

  return (
    <section aria-labelledby="synthese-titre">
      <EnTete
        id="synthese-titre"
        label={synthese ? formatDate(synthese.date_veille) : "Votre veille"}
        titre={titre}
      >
        {synthese && (
          <p className="mt-2 font-mono text-xs text-ink3">
            {nbSuivis < sujets.length
              ? `${nbSuivis} sujets dans vos rubriques sur ${sujets.length}`
              : `${sujets.length} sujets`}{" "}
            | {nonLus(null)} non lus | {sourcesCitees} sources citées
            {synthese.nb_articles != null
              ? ` | ${synthese.nb_articles.toLocaleString("fr-FR")} entrées de flux lues`
              : ""}
            {fluxLus != null && synthese.nb_sources
              ? ` | ${fluxLus} flux sur ${synthese.nb_sources}`
              : ""}
          </p>
        )}
      </EnTete>

      {!synthese ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Aucune synthèse envoyée pour le moment.
        </p>
      ) : (
        <>
          {/* Filtres par rubrique, avec le compteur de non lus (ACC-04 : boutons à état, la touche Tab suffit) */}
          <div
            role="group"
            aria-label="Rubriques de la synthèse"
            className="-mx-4 mt-6 flex overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0"
          >
            {[
              { v: null as string | null, t: autres.length ? "Mes rubriques" : "Toutes" },
              ...presentes.map((r) => ({ v: r as string | null, t: r })),
              ...(autres.length ? [{ v: AUTRES as string | null, t: "Autres rubriques" }] : []),
            ].map((o) => {
              const n = nonLus(o.v);
              const sel = actif === o.v;
              return (
                <button
                  key={o.t}
                  type="button"
                  aria-pressed={sel}
                  aria-label={`${o.t}, ${n} non lu${n > 1 ? "s" : ""}`}
                  onClick={() => setOnglet(o.v)}
                  className={`-mb-px flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-[13px] transition-colors ${sel ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {o.t}
                  <span
                    aria-hidden="true"
                    className={`min-w-5 px-1 text-center font-mono text-[0.68rem] tabular-nums ${n > 0 ? "bg-primary text-primary-foreground" : "text-ink3"}`}
                  >
                    {n}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="max-w-[48rem]">
            <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs text-muted-foreground">
              <span>
                {aLire.length
                  ? `${aLire.length} à lire${dejaLus.length ? `, ${dejaLus.length} déjà lu${dejaLus.length > 1 ? "s" : ""}` : ""}`
                  : isLoading
                    ? "Chargement..."
                    : "Tout est lu ici."}
              </span>
              {aLire.length > 1 && (
                <button
                  type="button"
                  className="link-accent font-medium"
                  onClick={() => garde(() => actions.marquerLus(aLire.map((s) => s.lien)))}
                >
                  Tout marquer comme lu
                </button>
              )}
            </div>
            {erreur && (
              <p role="alert" className="mb-2 text-sm text-destructive">
                {erreur}
              </p>
            )}

            {aLire.length > 0 && (
              <ul className="divide-y divide-border border-y border-border">{aLire.map(ligne)}</ul>
            )}
            {aLire.length === 0 && !isLoading && (
              <div className="border-y border-border py-6 text-sm text-muted-foreground">
                Rien de nouveau dans {actif ? "cette rubrique" : "vos rubriques"}.
                {suivante && (
                  <button
                    type="button"
                    className="link-accent ml-2 font-medium"
                    onClick={() => setOnglet(suivante)}
                  >
                    {suivante === AUTRES ? "Autres rubriques" : suivante} : {nonLus(suivante)} à
                    lire →
                  </button>
                )}
              </div>
            )}

            {dejaLus.length > 0 && (
              <details className="group mt-4">
                <summary className="cursor-pointer select-none py-2 text-xs text-muted-foreground hover:text-foreground">
                  Déjà lus ({dejaLus.length})
                </summary>
                {dejaLus.length > 0 && (
                  <div className="flex justify-end pb-2">
                    <button
                      type="button"
                      className="link-accent text-xs font-medium"
                      onClick={() => garde(() => actions.marquerNonLus(dejaLus.map((s) => s.lien)))}
                    >
                      Tout marquer comme non lu
                    </button>
                  </div>
                )}
                <ul className="divide-y divide-border border-y border-border">
                  {dejaLus.map(ligne)}
                </ul>
              </details>
            )}

            {!isLatest && (
              <button type="button" className="link-accent mt-6 text-sm" onClick={onRetour}>
                ← Revenir à la dernière synthèse
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Un sujet : le titre est le lien (l'ouvrir le marque comme lu) ; à droite, l'œil (lu, non lu) et l'étoile (sauvegarder). */
function LigneSujet({
  sujet,
  lu,
  favori,
  afficherRubrique,
  onOuvrir,
  onLu,
  onFavori,
}: {
  sujet: SujetLu;
  lu: boolean;
  favori: boolean;
  afficherRubrique: boolean;
  onOuvrir: () => void;
  onLu: () => void;
  onFavori: () => void;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 py-4">
      <article className="min-w-0">
        <h2
          className={`text-[15.5px] leading-snug ${lu ? "font-medium text-muted-foreground" : "font-semibold text-foreground"}`}
        >
          <a
            href={sujet.lien}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onOuvrir}
            className="decoration-primary decoration-1 underline-offset-4 hover:underline focus-visible:underline"
          >
            {sujet.titre}
            <span className="sr-only"> (nouvel onglet)</span>
          </a>
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
          {sujet.redige && sujet.resume ? sujet.resume : sujet.extrait}
        </p>
        <p className="mt-2 font-mono text-[0.7rem] text-ink3">
          {sujet.source}
          {afficherRubrique ? ` | ${sujet.rubrique}` : ""}
          {sujet.publie_le ? ` | publié à ${heureP(sujet.publie_le)}` : ""}
        </p>
      </article>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onLu}
          aria-pressed={lu}
          title={lu ? "Marquer comme non lu" : "Marquer comme lu"}
          className="grid h-9 w-9 place-items-center text-ink3 transition-colors hover:bg-accent-soft hover:text-foreground"
        >
          {lu ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="sr-only">
            {lu ? "Marquer comme non lu" : "Marquer comme lu"} : {sujet.titre}
          </span>
        </button>
        <button
          type="button"
          onClick={onFavori}
          aria-pressed={favori}
          title={favori ? "Retirer de Mes articles" : "Sauvegarder dans Mes articles"}
          className={`grid h-9 w-9 place-items-center transition-colors hover:bg-accent-soft ${favori ? "text-primary" : "text-ink3 hover:text-foreground"}`}
        >
          <Star className="h-4 w-4" fill={favori ? "currentColor" : "none"} aria-hidden="true" />
          <span className="sr-only">
            {favori ? "Retirer de Mes articles" : "Sauvegarder dans Mes articles"} : {sujet.titre}
          </span>
        </button>
      </div>
    </li>
  );
}

const ETAT_LIEN: Record<Favori["lien_etat"], string> = {
  inconnu: "lien pas encore vérifié",
  ok: "lien vérifié",
  rompu: "lien rompu",
  incertain: "lien à revérifier",
};

/** Mes articles : les sujets sauvegardés, avec l'état de leur lien (vérifié par l'app au plus une fois par jour). */
function MesArticles({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const verifier = useServerFn(verifierFavoris);
  const { data: favoris = [], isLoading } = useFavoris(userId);
  const actions = useActionsLecture(userId);
  const [filtre, setFiltre] = useState<"tous" | "rompus">("tous");
  const [erreur, setErreur] = useState("");
  // Vérification des liens à l'ouverture : 15 au plus par passage, chacun au plus une fois par 24 h (côté serveur)
  useQuery({
    queryKey: ["verif-favoris", userId],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const r = await verifier();
      if (r.verifies) await qc.invalidateQueries({ queryKey: ["favoris", userId] });
      return r;
    },
  });
  const rompus = favoris.filter((f) => f.lien_etat === "rompu");
  const liste = filtre === "rompus" ? rompus : favoris;

  return (
    <section aria-labelledby="articles-titre" className="space-y-6">
      <EnTete id="articles-titre" label="Mon compte" titre="Mes articles">
        <p className="mt-2 text-sm text-muted-foreground">
          Les sujets marqués d'une étoile, 30 au plus ({favoris.length} / 30). Leurs liens sont
          vérifiés une fois par jour : un lien rompu est signalé.
        </p>
      </EnTete>
      {favoris.length > 0 && (
        <Segments
          label="Filtrer les articles"
          valeur={filtre}
          onChange={setFiltre}
          options={[
            { v: "tous", texte: "Tous", n: favoris.length },
            { v: "rompus", texte: "Liens rompus", n: rompus.length },
          ]}
        />
      )}
      {erreur && (
        <p role="alert" className="text-sm text-destructive">
          {erreur}
        </p>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : favoris.length === 0 ? (
        <p className="border-y border-border py-6 text-sm text-muted-foreground">
          Aucun article sauvegardé. Dans la synthèse, cliquez sur l'étoile d'un sujet pour le
          retrouver ici.
        </p>
      ) : (
        <ul className="max-w-[48rem] divide-y divide-border border-y border-border">
          {liste.map((f) => (
            <li key={f.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 py-4">
              <article className="min-w-0">
                <h2 className="text-[15.5px] font-semibold leading-snug text-foreground">
                  <a
                    href={f.lien}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="decoration-primary decoration-1 underline-offset-4 hover:underline focus-visible:underline"
                  >
                    {f.titre}
                    <span className="sr-only"> (nouvel onglet)</span>
                  </a>
                </h2>
                {f.resume && (
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                    {f.resume}
                  </p>
                )}
                <p className="mt-2 font-mono text-[0.7rem] text-ink3">
                  {[
                    f.source,
                    f.rubrique,
                    f.date_veille
                      ? `synthèse du ${f.date_veille.split("-").reverse().join("/")}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" | ")}
                  {" | "}
                  <span className={f.lien_etat === "rompu" ? "font-semibold text-primary" : ""}>
                    {ETAT_LIEN[f.lien_etat]}
                  </span>
                </p>
              </article>
              <button
                type="button"
                aria-pressed="true"
                title="Retirer de Mes articles"
                onClick={async () => {
                  setErreur("");
                  try {
                    await actions.basculerFavori(f.lien, true);
                  } catch {
                    setErreur("Retrait impossible.");
                  }
                }}
                className="grid h-9 w-9 place-items-center text-primary transition-colors hover:bg-accent-soft"
              >
                <Star className="h-4 w-4" fill="currentColor" aria-hidden="true" />
                <span className="sr-only">Retirer de Mes articles : {f.titre}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Canal = "email" | "discord" | "aucun";

function Preferences({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: adresse } = useQuery({
    queryKey: ["adresse", userId],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.email ?? null,
  });
  const [canal, setCanal] = useState<Canal>("email");
  const [rubriques, setRubriques] = useState<string[]>([...RUBRIQUES]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [msgR, setMsgR] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setCanal(profile.canal === "discord" || profile.canal === "aucun" ? profile.canal : "email");
      setRubriques(profile.rubriques);
    }
  }, [profile]);

  const saveReception = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("profiles").update({ canal }).eq("id", userId);
    setMsg(
      error
        ? { ok: false, text: "Enregistrement impossible." }
        : { ok: true, text: "Préférence enregistrée." },
    );
    qc.invalidateQueries({ queryKey: ["profile", userId] });
  };

  const saveRubriques = async (e: React.FormEvent) => {
    e.preventDefault();
    const ordered = RUBRIQUES.filter((r) => rubriques.includes(r));
    const { error } = await supabase
      .from("profiles")
      .update({ rubriques: ordered })
      .eq("id", userId);
    setMsgR(
      error
        ? { ok: false, text: "Enregistrement impossible." }
        : { ok: true, text: "Rubriques enregistrées." },
    );
    qc.invalidateQueries({ queryKey: ["rubriques", userId] });
  };

  return (
    <>
      <LigneReglage
        id="rubriques-titre"
        titre="Rubriques suivies"
        aide="Votre synthèse et vos emails ne montrent que ces rubriques ; les autres restent consultables dans « Autres rubriques »."
      >
        <form onSubmit={saveRubriques} className="space-y-4">
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {RUBRIQUES.map((r, i) => (
              <div key={r} className="flex items-center gap-2">
                <Checkbox
                  id={`rub-${i}`}
                  checked={rubriques.includes(r)}
                  onCheckedChange={(c) =>
                    setRubriques((prev) => (c ? [...prev, r] : prev.filter((x) => x !== r)))
                  }
                />
                <Label htmlFor={`rub-${i}`} className="font-normal">
                  {r}
                </Label>
              </div>
            ))}
          </div>
          {msgR && (
            <p
              role="status"
              className={`text-sm ${msgR.ok ? "text-foreground" : "text-destructive"}`}
            >
              {msgR.text}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" size="sm">
              Enregistrer
            </Button>
          </div>
        </form>
      </LigneReglage>

      <LigneReglage
        id="reception-titre"
        titre="Réception"
        aide="Le canal sur lequel la synthèse vous parvient."
      >
        <form onSubmit={saveReception} className="space-y-4">
          <fieldset>
            <legend className="sr-only">Canal</legend>
            <RadioGroup value={canal} onValueChange={(v) => setCanal(v as Canal)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="email" id="canal-email" />
                <Label htmlFor="canal-email">Email</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="discord" id="canal-discord" />
                <Label htmlFor="canal-discord">Discord</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="aucun" id="canal-aucun" />
                <Label htmlFor="canal-aucun">Ne rien recevoir (consulter sur le site)</Label>
              </div>
            </RadioGroup>
          </fieldset>
          {canal === "email" && (
            <p className="text-sm text-muted-foreground">
              Chaque matin, une fois la veille publiée, vous recevez un email avec les sujets de vos
              rubriques
              {adresse ? (
                <>
                  {" "}
                  à l'adresse <strong className="text-foreground">{adresse}</strong>
                </>
              ) : null}
              . Expéditeur : Le Fil IA.
            </p>
          )}
          {canal === "aucun" && (
            <p className="text-sm text-muted-foreground">
              Aucun envoi : la synthèse reste consultable chaque jour dans cet espace.
            </p>
          )}
          {canal === "discord" && (
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <p>
                Chaque matin, la synthèse est publiée dans le salon #synthese-du-jour du serveur
                Discord Le Fil IA (lecture seule), toutes rubriques confondues.
              </p>
              {INVITATION_DISCORD && (
                <a
                  href={INVITATION_DISCORD}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-accent"
                >
                  Rejoindre le salon #synthese-du-jour ↗
                  <span className="sr-only"> (nouvel onglet)</span>
                </a>
              )}
            </div>
          )}
          {msg && (
            <p
              role="status"
              className={`text-sm ${msg.ok ? "text-foreground" : "text-destructive"}`}
            >
              {msg.text}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" size="sm">
              Enregistrer
            </Button>
          </div>
        </form>
      </LigneReglage>
    </>
  );
}

function MesDonnees() {
  const del = useServerFn(supprimerCompte);
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  // Droit d'accès et de portabilité (RGPD, D-WEB-14) : toutes les données du compte, en JSON, sans passer par l'équipe
  const exporter = async () => {
    setErr(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error();
      // Tables ajoutées hors des types générés : accès non typé, lié à son client
      const lire = (
        supabase.from as unknown as (t: string) => {
          select: (c: string) => Promise<{ data: unknown[] | null }>;
        }
      ).bind(supabase);
      const [{ data: profil }, { data: roles }, { data: lectures }, { data: favoris }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", u.user.id),
          lire("lectures").select("lien, lu_le"),
          lire("favoris").select(
            "lien, titre, source, rubrique, date_veille, sauve_le, lien_etat, verifie_le",
          ),
        ]);
      const contenu = {
        export_le: new Date().toISOString(),
        compte: {
          id: u.user.id,
          email: u.user.email,
          connexion: u.user.app_metadata?.["provider"] ?? "email",
          cree_le: u.user.created_at,
          derniere_connexion: u.user.last_sign_in_at ?? null,
          email_confirme_le: u.user.email_confirmed_at ?? null,
        },
        preferences: profil,
        roles: (roles ?? []).map((r) => r.role),
        articles_lus: lectures ?? [],
        articles_sauvegardes: favoris ?? [],
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(contenu, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `le-fil-ia_mes-donnees_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErr("Export impossible. Réessayez.");
    }
  };
  return (
    <>
      <LigneReglage
        id="export-titre"
        titre="Copie de mes données"
        aide="Compte, préférences, articles lus et sauvegardés, dans un fichier JSON."
      >
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={exporter}>
            Télécharger mes données
          </Button>
        </div>
      </LigneReglage>
      <LigneReglage
        id="suppression-titre"
        titre="Supprimer mon compte"
        aide="Efface définitivement votre compte, vos préférences et vos articles."
      >
        <AlertDialog>
          <div className="flex justify-end">
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                Supprimer mon compte
              </Button>
            </AlertDialogTrigger>
          </div>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer votre compte ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est définitive : votre compte, votre profil et vos articles sauvegardés
                seront supprimés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await del();
                    await supabase.auth.signOut();
                    navigate({ to: "/" });
                  } catch {
                    setErr("La suppression a échoué. Réessayez.");
                  }
                }}
              >
                Supprimer définitivement
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {err && (
          <p role="alert" className="mt-2 text-right text-sm text-destructive">
            {err}
          </p>
        )}
      </LigneReglage>
    </>
  );
}
