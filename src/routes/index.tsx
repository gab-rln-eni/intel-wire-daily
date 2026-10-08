import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SujetCard } from "@/components/SujetCard";
import { useAuth } from "@/lib/auth";
import { formatDate, rubriqueIndex, todayParis, type Sujet } from "@/lib/rubriques";
import { Apparition, Compteur } from "@/components/Anime";

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
    <div className="space-y-12">
      <section className="max-w-2xl pt-6">
        <p className="tag-rubrique mb-3">Veille IA quotidienne</p>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Le Fil IA</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Chaque matin, une synthèse courte et sourcée de l'actualité de l'IA, sur le canal que vous utilisez déjà : votre boîte mail ou Discord.
        </p>
        {data && (
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {data.date_veille === todayParis() ? "Synthèse du jour publiée ce matin" : `Dernière synthèse : ${formatDate(data.date_veille)}`}
          </p>
        )}
      </section>

      {data && data.nb_sujets != null && (
        <section aria-label="La synthèse du jour en chiffres" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          {[
            [data.nb_sujets, "sujets retenus"],
            [data.nb_rubriques ?? 0, "rubriques couvertes"],
            [data.nb_sources_citees ?? 0, "sources citées"],
            [(data.nb_sources ?? 0) - (data.nb_sources_echec ?? 0), "flux surveillés"],
          ].map(([v, l], i) => (
            <Apparition key={l as string} delai={i * 90} className="bg-card px-5 py-4">
              <p className="font-mono text-3xl font-semibold text-foreground">
                <Compteur valeur={v as number} />
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{l}</p>
            </Apparition>
          ))}
        </section>
      )}

      <section aria-labelledby="pourquoi-titre" className="rounded-xl border border-border bg-card/40 p-6 sm:p-8">
        <p className="tag-rubrique mb-2">Pourquoi s'abonner</p>
        <h2 id="pourquoi-titre" className="text-2xl font-bold tracking-tight text-foreground">Votre veille IA, sans le bruit</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Des dizaines d'annonces paraissent chaque jour. Le Fil IA les lit pour vous et ne garde que l'essentiel, prêt à lire avant votre premier café.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            ["01", "Deux minutes au lieu d'une heure", "Une quinzaine de sujets par jour au plus, chacun résumé en deux phrases. Vous savez ce qui compte, sans parcourir vingt sites."],
            ["02", "Des sources qui font autorité", "OpenAI, Google DeepMind, Mistral AI, Hugging Face, la CNIL, la lettre de l'AI Act et des médias tech de référence, en français et en anglais."],
            ["03", "Tout est vérifiable", "Chaque sujet cite sa source et mène à l'article original. Les liens viennent de la collecte, jamais de l'IA : rien n'est inventé."],
            ["04", "Seulement ce qui vous concerne", "Six rubriques, de la réglementation à la recherche. Choisissez les vôtres et filtrez la synthèse en un clic."],
          ].map(([n, t, d], i) => (
            <Apparition key={n} delai={i * 100}>
            <div className="flex h-full gap-4 rounded-lg border border-border bg-card p-5 transition-colors duration-200 hover:border-primary/60">
              <span aria-hidden="true" className="font-mono text-sm font-semibold text-primary">{n}</span>
              <div>
                <h3 className="font-semibold text-foreground">{t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </div>
            </div>
            </Apparition>
          ))}
        </div>
        {!user && (
          <div className="mt-6">
            <Button onClick={() => openLogin("signup")}>Recevoir la synthèse demain matin</Button>
          </div>
        )}
      </section>

      <section aria-labelledby="apercu-titre">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="apercu-titre" className="text-xl font-semibold text-foreground">Aperçu de la dernière synthèse</h2>
          {data && <p className="text-sm text-muted-foreground">{formatDate(data.date_veille)}</p>}
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : !data || data.sujets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune synthèse envoyée pour le moment.</p>
        ) : (
          <>
            {rubriquesApercu.length > 1 && (
              <div role="group" aria-label="Choisir une rubrique" className="mb-4 flex flex-wrap gap-2">
                {[null, ...rubriquesApercu].map((r) => (
                  <button
                    key={r ?? "une"}
                    type="button"
                    aria-pressed={onglet === r}
                    onClick={() => setOnglet(r)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${onglet === r ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"}`}
                  >
                    {r ?? "À la une"}
                  </button>
                ))}
              </div>
            )}
            <div key={onglet ?? "une"} className="grid gap-4 md:grid-cols-3" aria-live="polite">
              {cartes.map((s, i) => (
                <div
                  key={`${s.rubrique}-${s.ordre}`}
                  style={{ animationDelay: `${i * 80}ms` }}
                  className="animate-in fade-in-0 slide-in-from-bottom-2 fill-both duration-500 transition-transform hover:-translate-y-1 motion-reduce:animate-none motion-reduce:hover:translate-y-0"
                >
                  <SujetCard sujet={s} exemple={data.exemple} />
                </div>
              ))}
            </div>
          </>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Résumés générés par IA d'après l'extrait de chaque article. Les liens vers les articles d'origine et la synthèse complète sont réservés aux abonnés.
        </p>
      </section>
    </div>
  );
}
