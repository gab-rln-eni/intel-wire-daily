import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
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
import { SujetCard } from "@/components/SujetCard";
import { Apparition, Compteur } from "@/components/Anime";
import { Segments } from "@/components/Segments";
import { supprimerCompte } from "@/lib/compte.functions";
import { INVITATION_DISCORD, RUBRIQUES, formatDate, rubriqueIndex, todayParis, type Sujet } from "@/lib/rubriques";

type Vue = "historique" | "donnees";

export const Route = createFileRoute("/compte")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { vue?: Vue; id?: string } => {
    const vue = s["vue"];
    const id = s["id"];
    return {
      ...(vue === "historique" || vue === "donnees" ? { vue } : {}),
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
      { name: "description", content: "Votre synthèse IA, votre historique et vos préférences de réception." },
      { property: "og:title", content: "Mon compte | Le Fil IA" },
      { property: "og:description", content: "Synthèse, historique et préférences de réception." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Compte,
});

const card = "border border-border bg-card p-5";
const titreBloc = "label-section";

/** En-tête de page : trait vermillon, petit intitulé, titre. */
function EnTete({ label, titre, id, children }: { label: string; titre: string; id?: string; children?: React.ReactNode }) {
  return (
    <div className="trait-fil">
      <p className="label-section">{label}</p>
      <h1 id={id} className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.7rem]">{titre}</h1>
      {children}
    </div>
  );
}


function Compte() {
  const { userId } = Route.useRouteContext();
  const { vue, id: selected } = Route.useSearch();
  const navigate = useNavigate({ from: "/compte" });
  const [filtre, setFiltre] = useState<string | null>(null);

  const { data: syntheses = [] } = useQuery({
    queryKey: ["syntheses-envoyees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("syntheses")
        .select("id, date_veille, exemple, nb_sources, nb_sources_echec, nb_articles, nb_sujets")
        .eq("statut", "envoyee")
        .order("date_veille", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const current = syntheses.find((s) => s.id === selected) ?? syntheses[0];
  useEffect(() => setFiltre(null), [current?.id]);

  const { data: sujets = [] } = useQuery({
    queryKey: ["sujets", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sujets")
        .select("*")
        .eq("synthese_id", current!.id)
        .order("ordre_rubrique")
        .order("ordre");
      if (error) throw error;
      return data as Sujet[];
    },
  });

  const presentes = [...new Set(sujets.map((s) => s.rubrique))].sort((a, b) => rubriqueIndex(a) - rubriqueIndex(b));
  const visibles = filtre ? sujets.filter((s) => s.rubrique === filtre) : sujets;
  const groupes = presentes.filter((r) => !filtre || r === filtre);
  const isLatest = current && current.id === syntheses[0]?.id;
  const titre = current
    ? isLatest && current.date_veille === todayParis()
      ? "Synthèse du jour"
      : `Synthèse du ${formatDate(current.date_veille)}`
    : "Synthèse";

  if (vue === "donnees") {
    return (
      <div className="space-y-8">
        <EnTete label="Mon compte" titre="Mes données">
          <p className="mt-2 text-sm text-muted-foreground">Ce que vous recevez, sur quel canal, et la gestion de votre compte.</p>
        </EnTete>
        <div className="grid items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Preferences userId={userId} />
          <MesDonnees />
        </div>
      </div>
    );
  }

  if (vue === "historique") {
    return (
      <section aria-labelledby="historique-titre" className="space-y-8">
        <EnTete id="historique-titre" label="Archives" titre="Historique">
          <p className="mt-2 text-sm text-muted-foreground">
            {syntheses.length} synthèse{syntheses.length > 1 ? "s" : ""} publiée{syntheses.length > 1 ? "s" : ""}, de la plus récente à la plus ancienne.
          </p>
        </EnTete>
        {syntheses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune synthèse envoyée pour le moment.</p>
        ) : (
          <div className="border border-border bg-card">
            <div aria-hidden="true" className="hidden grid-cols-[1fr_7rem_9rem_2rem] gap-4 border-b border-border px-5 py-2.5 label-section sm:grid">
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
                        {i === 0 && <span className="ml-2 font-mono text-[0.68rem] uppercase tracking-wide text-primary">dernière</span>}
                        {s.exemple && <span className="ml-2 font-mono text-[0.68rem] uppercase tracking-wide text-ink3">exemple</span>}
                      </span>
                      <span className="text-right font-mono text-muted-foreground tabular-nums">
                        {s.nb_sujets ?? "-"}<span className="sm:hidden"> sujets</span>
                      </span>
                      <span className="hidden text-right font-mono text-muted-foreground tabular-nums sm:block">
                        {s.nb_sources != null ? `${s.nb_sources - (s.nb_sources_echec ?? 0)} / ${s.nb_sources}` : "-"}
                      </span>
                      <span aria-hidden="true" className="hidden text-right text-ink3 transition-transform group-hover:translate-x-1 group-hover:text-primary sm:block">→</span>
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

  const sourcesCitees = new Set(sujets.map((s) => s.source)).size;
  const fluxLus = current?.nb_sources != null ? current.nb_sources - (current.nb_sources_echec ?? 0) : null;

  return (
    <section aria-labelledby="synthese-titre" className="space-y-8">
      <EnTete id="synthese-titre" label={current ? formatDate(current.date_veille) : "Votre veille"} titre={titre}>
        {current?.nb_articles != null && (
          <p className="mt-2 text-sm text-muted-foreground">
            Tirée de {current.nb_articles.toLocaleString("fr-FR")} entrées de flux parcourues ce matin.
          </p>
        )}
      </EnTete>
      {current ? (
        <>
          <div className="grille-filets grid-cols-2 sm:grid-cols-4" role="list" aria-label="La synthèse en chiffres">
            {[
              [sujets.length, "sujets"],
              [presentes.length, "rubriques"],
              [sourcesCitees, "sources citées"],
              [fluxLus ?? 0, fluxLus != null && current.nb_sources ? `flux lus sur ${current.nb_sources}` : "flux lus"],
            ].map(([v, l], i) => (
              <div key={String(l)} role="listitem" className="bg-card px-4 py-3">
                <Apparition delai={i * 70}>
                  <p className="font-mono text-2xl font-semibold text-foreground tabular-nums"><Compteur valeur={v as number} /></p>
                  <p className="label-section mt-0.5">{l}</p>
                </Apparition>
              </div>
            ))}
          </div>

          {presentes.length > 1 && (
            <Segments
              label="Filtrer par rubrique"
              valeur={filtre}
              onChange={setFiltre}
              options={[
                { v: null, texte: "Toutes", n: sujets.length },
                ...presentes.map((r) => ({ v: r as string | null, texte: r, n: sujets.filter((s) => s.rubrique === r).length })),
              ]}
            />
          )}

          <div key={filtre ?? "toutes"} className="space-y-8 animate-in fade-in-0 slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
            {groupes.map((r) => {
              const liste = visibles.filter((s) => s.rubrique === r);
              return (
                <div key={r}>
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h2 className="tag-rubrique text-[0.75rem]">{r}</h2>
                    <span className="font-mono text-xs text-ink3">{liste.length}</span>
                  </div>
                  <div className="grille-filets md:grid-cols-2 lg:grid-cols-3">
                    {liste.map((s) => (
                      <SujetCard key={s.id} sujet={s} exemple={current.exemple} sansRubrique />
                    ))}
                  </div>
                </div>
              );
            })}
            {sujets.length === 0 && <p className="text-sm text-muted-foreground">Aucun sujet.</p>}
          </div>
          {!isLatest && (
            <button type="button" className="link-accent text-sm" onClick={() => navigate({ search: {} })}>
              ← Revenir à la dernière synthèse
            </button>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Aucune synthèse envoyée pour le moment.</p>
      )}
    </section>
  );
}

function Preferences({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [canal, setCanal] = useState<"email" | "discord">("email");
  const [rubriques, setRubriques] = useState<string[]>([...RUBRIQUES]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [msgR, setMsgR] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setCanal(profile.canal === "discord" ? "discord" : "email");
      setRubriques(profile.rubriques);
    }
  }, [profile]);

  const saveReception = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from("profiles")
      .update({ canal, discord_webhook_url: null })
      .eq("id", userId);
    setMsg(error ? { ok: false, text: "Enregistrement impossible." } : { ok: true, text: "Préférence enregistrée." });
    qc.invalidateQueries({ queryKey: ["profile", userId] });
  };

  const saveRubriques = async (e: React.FormEvent) => {
    e.preventDefault();
    const ordered = RUBRIQUES.filter((r) => rubriques.includes(r));
    const { error } = await supabase.from("profiles").update({ rubriques: ordered }).eq("id", userId);
    setMsgR(error ? { ok: false, text: "Enregistrement impossible." } : { ok: true, text: "Rubriques enregistrées." });
  };

  return (
    <>
      <section aria-labelledby="rubriques-titre" className={card}>
        <h2 id="rubriques-titre" className={titreBloc}>Rubriques suivies</h2>
        <form onSubmit={saveRubriques} className="mt-3 space-y-3">
          {RUBRIQUES.map((r, i) => (
            <div key={r} className="flex items-center gap-2">
              <Checkbox
                id={`rub-${i}`}
                checked={rubriques.includes(r)}
                onCheckedChange={(c) => setRubriques((prev) => (c ? [...prev, r] : prev.filter((x) => x !== r)))}
              />
              <Label htmlFor={`rub-${i}`} className="font-normal">{r}</Label>
            </div>
          ))}
          {msgR && <p role="status" className={`text-sm ${msgR.ok ? "text-foreground" : "text-destructive"}`}>{msgR.text}</p>}
          <Button type="submit" size="sm">Enregistrer</Button>
        </form>
      </section>

      <section aria-labelledby="reception-titre" className={card}>
        <h2 id="reception-titre" className={titreBloc}>Réception</h2>
        <form onSubmit={saveReception} className="mt-3 space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm text-muted-foreground">Canal</legend>
            <RadioGroup value={canal} onValueChange={(v) => setCanal(v as "email" | "discord")}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="email" id="canal-email" />
                <Label htmlFor="canal-email">Email</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="discord" id="canal-discord" />
                <Label htmlFor="canal-discord">Discord</Label>
              </div>
            </RadioGroup>
          </fieldset>
          {canal === "discord" && (
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <p>Chaque matin, la synthèse est publiée dans le salon #synthese-du-jour du serveur Discord Le Fil IA (lecture seule).</p>
              {INVITATION_DISCORD && (
                <a href={INVITATION_DISCORD} target="_blank" rel="noopener noreferrer" className="link-accent">
                  Rejoindre le salon #synthese-du-jour ↗<span className="sr-only"> (nouvel onglet)</span>
                </a>
              )}
            </div>
          )}
          {msg && <p role="status" className={`text-sm ${msg.ok ? "text-foreground" : "text-destructive"}`}>{msg.text}</p>}
          <Button type="submit" size="sm">Enregistrer</Button>
        </form>
      </section>
    </>
  );
}

function MesDonnees() {
  const del = useServerFn(supprimerCompte);
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  return (
    <section aria-labelledby="donnees-titre" className={card}>
      <h2 id="donnees-titre" className={titreBloc}>Compte</h2>
      <p className="mt-2 text-sm text-muted-foreground">La suppression efface définitivement votre compte et vos préférences.</p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="mt-3">Supprimer mon compte</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer votre compte ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est définitive : votre compte et votre profil seront supprimés.</AlertDialogDescription>
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
      {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
    </section>
  );
}
