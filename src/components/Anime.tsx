import { useEffect, useRef, useState, type ReactNode } from "react";

// Animations de l'accueil : désactivées si le système demande de réduire les animations (RGAA, WCAG 2.3.3).
const reduit = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Fait apparaître son contenu en fondu quand il entre à l'écran. Sans JavaScript, le contenu reste visible. */
export function Apparition({ children, delai = 0, className = "" }: { children: ReactNode; delai?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [etat, setEtat] = useState<"statique" | "cache" | "visible">("statique");
  useEffect(() => {
    const el = ref.current;
    if (!el || reduit() || !("IntersectionObserver" in window)) return;
    setEtat("cache");
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setEtat("visible");
          obs.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    // Sécurité : le contenu s'affiche quoi qu'il arrive au bout de 1,2 s
    const t = window.setTimeout(() => setEtat("visible"), 1200);
    return () => {
      obs.disconnect();
      window.clearTimeout(t);
    };
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: etat === "visible" ? `${delai}ms` : undefined }}
      className={`${className} ${etat === "statique" ? "" : "transition-all duration-700 ease-out"} ${etat === "cache" ? "translate-y-4 opacity-0" : ""}`}
    >
      {children}
    </div>
  );
}

/** Compteur qui monte jusqu'à sa valeur ; le lecteur d'écran lit directement la valeur finale. */
export function Compteur({ valeur }: { valeur: number }) {
  const [v, setV] = useState(valeur);
  useEffect(() => {
    if (reduit()) return setV(valeur);
    let raf = 0;
    const debut = performance.now();
    const duree = 900;
    const pas = (t: number) => {
      const p = Math.min(1, (t - debut) / duree);
      setV(Math.round(valeur * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(pas);
    };
    setV(0);
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [valeur]);
  return (
    <>
      <span aria-hidden="true">{v.toLocaleString("fr-FR")}</span>
      <span className="sr-only">{valeur.toLocaleString("fr-FR")}</span>
    </>
  );
}
