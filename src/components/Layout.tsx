import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const navBase = "relative px-2 py-1.5 text-sm transition-colors after:absolute after:inset-x-2 after:-bottom-[13px] after:h-0.5 after:transition-colors";
const navCls = `${navBase} text-muted-foreground hover:text-foreground after:bg-transparent hover:after:bg-border`;
const activeCls = { className: `${navBase} font-semibold text-foreground after:bg-primary` };

/** Marque Le Fil IA : un cadre d'encre traversé par le fil vermillon. */
export function Marque({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="4" />
      <rect x="0" y="40" width="64" height="6" className="fill-primary" />
    </svg>
  );
}

/** Sélecteur Jour | Nuit : le choix est mémorisé dans le navigateur (préférence demandée, sans cookie). */
function ThemeSwitch() {
  const [theme, setTheme] = useState<"jour" | "nuit">("jour");
  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") === "nuit" ? "nuit" : "jour");
  }, []);
  const choisir = (t: "jour" | "nuit") => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem("theme", t);
    } catch {
      /* stockage indisponible : le choix vaut pour la page en cours */
    }
  };
  return (
    <div role="group" aria-label="Thème d'affichage" className="flex border border-border bg-card">
      {(["jour", "nuit"] as const).map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={theme === t}
          onClick={() => choisir(t)}
          className={`min-h-8 px-3 text-xs tracking-wide transition-colors ${theme === t ? "bg-foreground font-semibold text-background" : "text-ink3 hover:text-foreground"}`}
        >
          {t === "jour" ? "Jour" : "Nuit"}
        </button>
      ))}
    </div>
  );
}

export function Header() {
  const { user, isAdmin, openLogin } = useAuth();
  const navigate = useNavigate();
  const loc = useRouterState({ select: (s) => s.location });
  const vue = loc.pathname === "/compte" ? ((loc.search as { vue?: string }).vue ?? "synthese") : null;
  const item = (v: string) => ({
    className: vue === v ? activeCls.className : navCls,
    "aria-current": vue === v ? ("page" as const) : undefined,
  });
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <Link to={user ? "/compte" : "/"} className="flex items-center gap-2.5 text-foreground">
          <Marque />
          <span className="text-[15px] font-semibold tracking-tight">
            Le Fil <span className="font-mono text-primary">IA</span>
          </span>
        </Link>
        {/* Visiteur : pas de liens, le logo ramène à l'accueil */}
        {user ? (
          <nav
            aria-label="Navigation principale"
            className="order-last -mx-2 flex flex-1 items-center gap-1 sm:order-none sm:mx-0"
          >
              <>
                <Link to="/compte" search={{}} {...item("synthese")}>
                  Synthèse
                </Link>
                <Link to="/compte" search={{ vue: "historique" }} {...item("historique")}>
                  Historique
                </Link>
                <Link to="/compte" search={{ vue: "donnees" }} {...item("donnees")}>
                  Mes données
                </Link>
              </>
            {isAdmin && (
              <Link to="/admin" className={navCls} activeProps={activeCls}>
                Admin
              </Link>
            )}
          </nav>
        ) : (
          <div className="flex-1" />
        )}
        {/* Sur téléphone, le sélecteur de thème passe sur la ligne des liens */}
        <div className="order-last ml-auto sm:order-none sm:ml-0">
          <ThemeSwitch />
        </div>
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
        {user ? (
          <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Menu du compte">
                {user.email?.split("@")[0] ?? "Compte"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate({ to: "/compte", search: { vue: "donnees" } })}>Mes données</DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/" });
                }}
              >
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => openLogin("signin")}>
              Se connecter
            </Button>
            <Button size="sm" onClick={() => openLogin("signup")}>
              Créer un compte
            </Button>
          </div>
        )}
        </div>
      </div>
    </header>
  );
}

type Doc = "mentions" | "confidentialite" | "cookies" | null;

const DOCS: Record<Exclude<Doc, null>, { title: string; body: ReactNode }> = {
  mentions: {
    title: "Mentions légales",
    body: (
      <>
        <p><strong>Éditeur :</strong> Le Fil IA, projet de démonstration.</p>
        <p><strong>Contact :</strong> via le{" "}<a href="https://github.com/gab-rln-eni/intel-wire-daily" target="_blank" rel="noopener noreferrer" className="link-accent">dépôt GitHub du projet<span className="sr-only"> (nouvel onglet)</span></a>.</p>
        <p><strong>Hébergement :</strong> plateforme Lovable (lovable.dev). Société désignée par sa politique de confidentialité : Lovable Labs Sweden AB, Regeringsgatan 25, 111 53 Stockholm, Suède.</p>
      </>
    ),
  },
  confidentialite: {
    title: "Confidentialité",
    body: (
      <>
        <p><strong>Données traitées :</strong> adresse email, identité du compte Google (si vous l'utilisez pour vous connecter), canal de réception choisi, rubriques suivies. Si vous choisissez Discord, vous rejoignez le salon public #synthese-du-jour : Discord traite alors votre compte selon ses propres conditions.</p>
        <p><strong>Finalité :</strong> envoi et consultation de la synthèse de veille.</p>
        <p><strong>Conservation :</strong> jusqu'à la suppression de votre compte.</p>
        <p><strong>Vos droits :</strong> accès, rectification et suppression. Vous pouvez supprimer votre compte à tout moment depuis la page Mon compte.</p>
      </>
    ),
  },
  cookies: {
    title: "Cookies",
    body: (
      <>
        <p>Le Fil IA utilise uniquement ce qui est strictement nécessaire à la connexion à votre compte. Aucun bandeau n'est donc requis.</p>
        <p>Aucune publicité ni aucun traceur publicitaire n'est utilisé. La plateforme d'hébergement (Lovable) mesure la fréquentation du site de façon globale, depuis le même domaine.</p>
        <p>Aucune police ni ressource n'est chargée depuis un service tiers. Votre choix de thème jour ou nuit est conservé dans votre navigateur (stockage local), sans cookie et sans transmission.</p>
      </>
    ),
  },
};

export function Footer() {
  const [doc, setDoc] = useState<Doc>(null);
  const { user, openLogin } = useAuth();
  const lien = "w-fit text-sm text-muted-foreground transition-colors hover:text-foreground";
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:grid-cols-2 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="sm:col-span-2 md:col-span-1">
          <p className="flex items-center gap-2.5 font-semibold text-foreground">
            <Marque className="h-5 w-5" />
            <span>Le Fil <span className="font-mono text-primary">IA</span></span>
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            La veille IA triée et sourcée, chaque matin, par e-mail ou sur Discord.
          </p>
        </div>
        <nav aria-label="Le service" className="flex flex-col gap-2.5">
          <p className="label-section mb-1">Le service</p>
          {user ? (
            <>
              <Link to="/compte" search={{}} className={lien}>Synthèse du jour</Link>
              <Link to="/compte" search={{ vue: "historique" }} className={lien}>Historique</Link>
              <Link to="/compte" search={{ vue: "donnees" }} className={lien}>Mes données</Link>
            </>
          ) : (
            <>
              <button type="button" className={`${lien} text-left`} onClick={() => openLogin("signup")}>Créer un compte</button>
              <button type="button" className={`${lien} text-left`} onClick={() => openLogin("signin")}>Se connecter</button>
            </>
          )}
        </nav>
        <nav aria-label="Informations légales" className="flex flex-col gap-2.5">
          <p className="label-section mb-1">Informations</p>
          <button type="button" className={`${lien} text-left`} onClick={() => setDoc("mentions")}>Mentions légales</button>
          <button type="button" className={`${lien} text-left`} onClick={() => setDoc("confidentialite")}>Confidentialité</button>
          <button type="button" className={`${lien} text-left`} onClick={() => setDoc("cookies")}>Cookies</button>
          <a href="https://github.com/gab-rln-eni/intel-wire-daily" target="_blank" rel="noopener noreferrer" className={lien}>
            Code source ↗<span className="sr-only"> (nouvel onglet)</span>
          </a>
        </nav>
      </div>
      <div className="border-t border-line2">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-4 font-mono text-xs text-ink3">
          <span>© 2026 Le Fil IA</span>
          <span>Projet de démonstration | Sans publicité</span>
        </div>
      </div>
      <Dialog open={doc !== null} onOpenChange={(o) => !o && setDoc(null)}>
        <DialogContent>
          {doc && (
            <>
              <DialogHeader>
                <DialogTitle>{DOCS[doc].title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{DOCS[doc].body}</div>
              <p className="text-xs text-muted-foreground">Cadre indicatif, non validé juridiquement.</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </footer>
  );
}
