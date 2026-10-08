import type { Sujet } from "@/lib/rubriques";
import { useAuth } from "@/lib/auth";

export function SujetCard({ sujet, exemple }: { sujet: Omit<Sujet, "lien"> & { lien?: string | null }; exemple?: boolean }) {
  const { openLogin } = useAuth();
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="tag-rubrique">{sujet.rubrique}</span>
        {exemple && (
          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[0.68rem] text-muted-foreground">
            Exemple
          </span>
        )}
      </div>
      <h3 className="text-base font-semibold leading-snug text-foreground">{sujet.titre}</h3>
      {sujet.redige && sujet.resume ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{sujet.resume}</p>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Résumé indisponible. Extrait : </span>
          {sujet.extrait}
        </p>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        {sujet.source} |{" "}
        {sujet.lien ? (
          <a href={sujet.lien} target="_blank" rel="noopener noreferrer" className="link-accent">
            Lire l'article ↗<span className="sr-only"> (nouvel onglet)</span>
          </a>
        ) : (
          <button type="button" onClick={() => openLogin("signup")} className="link-accent">
            <span aria-hidden="true">🔒 </span>Lien réservé aux abonnés
          </button>
        )}
      </p>
    </article>
  );
}
