import type { Sujet } from "@/lib/rubriques";
import { useAuth } from "@/lib/auth";

type SujetAffiche = Omit<Sujet, "lien"> & { lien?: string | null };

/**
 * Carte de sujet, compacte et à angles droits. À poser dans une grille à filets :
 * <div className="grille-filets">…</div>.
 */
export function SujetCard({ sujet, exemple, sansRubrique }: { sujet: SujetAffiche; exemple?: boolean; sansRubrique?: boolean }) {
  const { openLogin } = useAuth();
  return (
    <article className="flex h-full flex-col bg-card p-4 transition-shadow duration-200 hover:filet-actif">
      <div className="mb-2 flex items-center justify-between gap-3">
        {sansRubrique ? (
          <span className="truncate font-mono text-[0.7rem] text-ink3">{sujet.source}</span>
        ) : (
          <span className="tag-rubrique truncate">{sujet.rubrique}</span>
        )}
        {exemple && (
          <span className="shrink-0 border border-border px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wide text-ink3">
            Exemple
          </span>
        )}
      </div>
      <h3 className="text-[15px] font-semibold leading-snug text-foreground">{sujet.titre}</h3>
      {sujet.redige && sujet.resume ? (
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{sujet.resume}</p>
      ) : (
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Extrait : </span>
          {sujet.extrait}
        </p>
      )}
      <p className="mt-auto flex items-center justify-between gap-3 pt-3 text-xs">
        {!sansRubrique && <span className="truncate font-mono text-ink3">{sujet.source}</span>}
        {sujet.lien ? (
          <a href={sujet.lien} target="_blank" rel="noopener noreferrer" className="link-accent shrink-0 font-medium">
            Lire l'article ↗<span className="sr-only"> (nouvel onglet)</span>
          </a>
        ) : (
          <button type="button" onClick={() => openLogin("signup")} className="link-accent shrink-0 font-medium">
            Lien réservé aux abonnés
          </button>
        )}
      </p>
    </article>
  );
}
