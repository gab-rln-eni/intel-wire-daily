import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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

const navCls = "rounded px-2 py-1 text-sm text-muted-foreground hover:text-foreground";
const activeCls = { className: "rounded px-2 py-1 text-sm text-foreground font-medium" };

export function Header() {
  const { user, isAdmin, openLogin } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link to="/" className="font-mono text-base font-semibold text-foreground">
          Le Fil <span className="text-primary">IA</span>
        </Link>
        <nav aria-label="Navigation principale" className="flex flex-1 items-center gap-1">
          <Link to="/" className={navCls} activeProps={activeCls} activeOptions={{ exact: true }}>
            Accueil
          </Link>
          {user && (
            <Link to="/compte" className={navCls} activeProps={activeCls}>
              Mon compte
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin" className={navCls} activeProps={activeCls}>
              Admin
            </Link>
          )}
        </nav>
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Menu du compte">
                {user.email?.split("@")[0] ?? "Compte"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate({ to: "/compte" })}>Mon compte</DropdownMenuItem>
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
        ) : (
          <Button size="sm" onClick={() => openLogin("signin")}>
            Se connecter
          </Button>
        )}
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
        <p>Aucune mesure d'audience ni aucun traceur tiers n'est utilisé.</p>
        <p>Les polices de caractères sont chargées depuis Google Fonts : votre navigateur transmet alors votre adresse IP à Google, sans cookie.</p>
      </>
    ),
  },
};

export function Footer() {
  const [doc, setDoc] = useState<Doc>(null);
  const btn = "rounded text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  return (
    <footer className="mt-16 border-t border-border bg-card/40">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 text-sm sm:grid-cols-3">
        <div>
          <p className="font-mono font-semibold text-foreground">Le Fil <span className="text-primary">IA</span></p>
          <p className="mt-2 text-muted-foreground">La veille IA triée et sourcée, chaque matin, par e-mail ou sur Discord.</p>
        </div>
        <nav aria-label="Informations légales" className="flex flex-col items-start gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Informations</p>
          <button type="button" className={btn} onClick={() => setDoc("mentions")}>Mentions légales</button>
          <button type="button" className={btn} onClick={() => setDoc("confidentialite")}>Confidentialité</button>
          <button type="button" className={btn} onClick={() => setDoc("cookies")}>Cookies</button>
        </nav>
        <div className="text-muted-foreground sm:text-right">
          <p>© 2026 Le Fil IA</p>
          <p className="mt-1">Projet de démonstration</p>
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
