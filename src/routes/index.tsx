import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { formatDate, rubriqueIndex, todayParis, type Sujet } from "@/lib/rubriques";
import { Apparition, Compteur } from "@/components/Anime";
import { Segments } from "@/components/Segments";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Le Fil IA | Synthèse quotidienne de l'actualité de l'IA" },
      { name: "description", content: "Chaque matin, une synthèse courte et sourcée de l'actualité de l'IA, par email ou sur Discord." },
      { property: "og:title", content: "Le Fil IA" },
      { property: "og:description", content: "Une synthèse courte et sourcée de l'actualité de l'IA, chaque matin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Apercu = {
  date_veille: string;
  exemple: boolean;
  nb_sujets?: number;
  nb_rubriques?: number;
  nb_sources_citees?: number;
  nb_sources?: number | null;
  nb_sources_echec?: number | null;
  sujets: (Omit<Sujet, "lien"> & { lien?: string | null; rang?: number })[];
} | null;

function Index() {
  const { user, ready, openLogin } = useAuth();
  const navigate = useNavigate();
  const [onglet, setOnglet] = useState<string | null>(null);
  // Une fois connecté, l'abonné arrive directement sur sa synthèse.
  useEffect(() => {
    if (ready && user) navigate({ to: "/compte", replace: true });
  }, [ready, user, navigate]);
  const { data, isLoading } = useQuery({
    queryKey: ["apercu"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("apercu_public");
      if (error) throw error;
      return data as unknown as Apercu;
    },
  });

  const sujetsApercu = data?.sujets ?? [];
  const rubriquesApercu = [...new Set(sujetsApercu.map((s) => s.rubrique))].sort((a, b) => rubriqueIndex(a) - rubriqueIndex(b));
  const cartes = onglet
    ? sujetsApercu.filter((s) => s.rubrique === onglet).slice(0, 3)
    : rubriquesApercu.map((r) => sujetsApercu.find((s) => s.rubrique === r)!).slice(0, 3);
  if (onglet === null && cartes.length < 3) {
    for (const s of sujetsApercu) if (cartes.length < 3 && !cartes.includes(s)) cartes.push(s);
  }

  return (
    <div className="space-y-14">
      {/* Ligne 1 : accroche à gauche, chiffres du jour à droite */}
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
      <section className="pt-4">
        <div className="trait-fil">
          <p className="label-section">Veille IA quotidienne</p>
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Le Fil <span className="font-mono text-primary">IA</span>
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Chaque matin, une synthèse courte et sourcée de l'actualité de l'IA, sur le canal que vous utilisez déjà : votre boîte mail ou Discord.
        </p>
        {data && (
          <p className="mt-5 inline-flex items-center gap-2 border border-border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {data.date_veille === todayParis() ? "Synthèse du jour publiée ce matin" : `Dernière synthèse : ${formatDate(data.date_veille)}`}
          </p>
        )}
      </section>

      {data && data.nb_sujets != null && (
        <section aria-label="La synthèse du jour en chiffres" className="grille-filets grid-cols-2">
          {[
            [data.nb_sujets, "sujets retenus"],
            [data.nb_rubriques ?? 0, "rubriques couvertes"],
            [data.nb_sources_citees ?? 0, "sources citées"],
            [(data.nb_sources ?? 0) - (data.nb_sources_echec ?? 0), "flux surveillés"],
          ].map(([v, l], i) => (
            <div key={l as string} className="bg-card px-5 py-5">
              <Apparition delai={i * 90}>
                <p className="font-mono text-3xl font-semibold text-foreground tabular-nums">
                  <Compteur valeur={v as number} />
                </p>
                <p className="label-section mt-1">{l}</p>
              </Apparition>
            </div>
          ))}
        </section>
      )}
      </div>

      {/* Ligne 2 : argument à gauche, quatre bénéfices à droite */}
      <section aria-labelledby="pourquoi-titre" className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] lg:gap-12">
        <div className="lg:sticky lg:top-24">
        <div className="trait-fil">
          <p className="label-section">Pourquoi s'abonner</p>
          <h2 id="pourquoi-titre" className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Votre veille IA, sans le bruit</h2>
        </div>
        <p className="mt-3 text-muted-foreground">
          Des dizaines d'annonces paraissent chaque jour. Le Fil IA les lit pour vous et ne garde que l'essentiel, prêt à lire avant votre premier café.
        </p>
        {!user && (
          <div className="mt-6">
            <Button onClick={() => openLogin("signup")}>Recevoir la synthèse demain matin</Button>
          </div>
        )}
        </div>
        <div className="grille-filets sm:grid-cols-2">
          {[
            ["01", "Deux minutes au lieu d'une heure", "Quinze à trente sujets par jour, chacun résumé en deux phrases. Vous savez ce qui compte, sans parcourir vingt sites."],
            ["02", "Des sources qui font autorité", "OpenAI, Google DeepMind, Mistral AI, Hugging Face, la CNIL, la lettre de l'AI Act et des médias tech de référence, en français et en anglais."],
            ["03", "Tout est vérifiable", "Chaque sujet cite sa source et mène à l'article original. Les liens viennent de la collecte, jamais de l'IA : rien n'est inventé."],
            ["04", "Seulement ce qui vous concerne", "Six rubriques, de la réglementation à la recherche. Choisissez les vôtres : votre synthèse et vos emails s'y limitent."],
          ].map(([n, t, d], i) => (
            <div key={n} className="bg-card transition-shadow duration-200 hover:filet-actif">
              <Apparition delai={i * 100} className="flex h-full gap-4 p-5">
                <span aria-hidden="true" className="font-mono text-sm font-semibold text-primary">{n}</span>
                <div>
                  <h3 className="font-semibold text-foreground">{t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</p>
                </div>
              </Apparition>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="apercu-titre">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div className="trait-fil">
            <p className="label-section">Extrait</p>
            <h2 id="apercu-titre" className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Aperçu de la dernière synthèse</h2>
          </div>
          {data && <p className="font-mono text-xs text-muted-foreground">{formatDate(data.date_veille)}</p>}
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : !data || data.sujets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune synthèse envoyée pour le moment.</p>
        ) : (
          <>
            {rubriquesApercu.length > 1 && (
              <div className="mb-4">
                <Segments
                  label="Choisir une rubrique"
                  valeur={onglet}
                  onChange={setOnglet}
                  options={[{ v: null, texte: "À la une" }, ...rubriquesApercu.map((r) => ({ v: r as string | null, texte: r }))]}
                />
              </div>
            )}
            {/* Même présentation que l'espace abonné (liste éditoriale), sans lien : réservé aux abonnés */}
            <ul key={onglet ?? "une"} className="max-w-[48rem] divide-y divide-border border-y border-border" aria-live="polite">
              {cartes.map((s, i) => (
                <li
                  key={`${s.rubrique}-${s.ordre}`}
                  style={{ animationDelay: `${i * 80}ms` }}
                  className="animate-in fade-in-0 slide-in-from-bottom-2 fill-both py-4 duration-500 motion-reduce:animate-none"
                >
                  <h3 className="text-[15.5px] font-semibold leading-snug text-foreground">{s.titre}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{s.redige && s.resume ? s.resume : s.extrait}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 font-mono text-[0.7rem] text-ink3">
                    <span>{s.source} | {s.rubrique}</span>
                    {data.exemple && <span className="border border-border px-1 uppercase tracking-wide">exemple</span>}
                    <span aria-hidden="true">|</span>
                    <button type="button" onClick={() => openLogin("signup")} className="link-accent">
                      Lien réservé aux abonnés
                    </button>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Résumés générés par IA d'après l'extrait de chaque article. Les liens vers les articles d'origine et la synthèse complète sont réservés aux abonnés.
        </p>
      </section>
    </div>
  );
}
