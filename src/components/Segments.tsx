/** Sélecteur segmenté à angles droits (filtres). */
export function Segments<T extends string | null>({
  label,
  options,
  valeur,
  onChange,
}: {
  label: string;
  options: { v: T; texte: string; n?: number }[];
  valeur: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap border-l border-t border-border"
    >
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          aria-pressed={valeur === o.v}
          onClick={() => onChange(o.v)}
          className={`flex min-h-9 items-center gap-2 border-b border-r border-border px-3.5 text-xs transition-colors ${valeur === o.v ? "bg-foreground font-semibold text-background" : "bg-card text-muted-foreground hover:text-foreground"}`}
        >
          {o.texte}
          {o.n != null && (
            <span className={`font-mono ${valeur === o.v ? "text-background/70" : "text-ink3"}`}>
              {o.n}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
