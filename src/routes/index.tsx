import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SujetCard } from "@/components/SujetCard";
import { useAuth } from "@/lib/auth";
import { formatDate, type Sujet } from "@/lib/rubriques";

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

type Apercu = { date_veille: string; exemple: boolean; sujets: Sujet[] } | null;

function Index() {
  const { user, openLogin } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["apercu"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("apercu_public");
      if (error) throw error;
      return data as unknown as Apercu;
    },
  });

  return (
    <div className="space-y-12">
      <section className="max-w-2xl pt-6">
        <p className="tag-rubrique mb-3">Veille IA quotidienne</p>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Le Fil IA</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Chaque matin, une synthèse courte et sourcée de l'actualité de l'IA, sur le canal que vous utilisez déjà : votre boîte mail ou Discord.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {user ? (
            <Button asChild>
              <Link to="/compte">Voir ma synthèse</Link>
            </Button>
          ) : (
            <>
              <Button onClick={() => openLogin("signup")}>Créer un compte</Button>
              <Button variant="outline" onClick={() => openLogin("signin")}>Se connecter</Button>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="pourquoi-titre">
        <h2 id="pourquoi-titre" className="mb-4 text-xl font-semibold text-foreground">Pourquoi Le Fil IA</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Des sources reconnues", "Une vingtaine de sources suivies chaque jour : éditeurs (OpenAI, Google DeepMind, Mistral AI, Hugging Face), régulation (CNIL, AI Act) et médias spécialisés français et anglais."],
            ["Des liens vérifiables", "Chaque sujet renvoie à l'article d'origine. Les liens sont posés par la chaîne de collecte, jamais par l'IA."],
            ["Un tri pertinent", "Six rubriques, articles déjà vus écartés, priorité à l'actualité récente. Vous filtrez ce qui vous concerne."],
            ["Une IA encadrée", "Le résumé est rédigé d'après l'extrait de l'article, sans rien ajouter. Sans résumé fiable, l'extrait est affiché tel quel."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
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
          <div className="grid gap-4 md:grid-cols-3">
            {data.sujets.map((s, i) => (
              <SujetCard key={i} sujet={s} exemple={data.exemple} />
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Résumés générés par IA d'après l'extrait de chaque article ; chaque sujet renvoie à l'article d'origine.
        </p>
      </section>
    </div>
  );
}
