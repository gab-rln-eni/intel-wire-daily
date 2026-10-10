import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";

/** ACC-08 : messages d'inscription en français (les messages bruts du service sont en anglais). */
function erreurInscription(m: string) {
  if (/at least|password/i.test(m)) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (/already registered|already exists/i.test(m))
    return "Un compte existe déjà avec cette adresse : connectez-vous.";
  if (/rate limit|too many/i.test(m))
    return "Trop de tentatives : réessayez dans quelques minutes.";
  if (/invalid|validate email/i.test(m)) return "Adresse email invalide.";
  return "Création du compte impossible. Réessayez.";
}

export function LoginDialog() {
  const { loginOpen, setLoginOpen, loginMode } = useAuth();
  const [mode, setMode] = useState(loginMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loginOpen) {
      setMode(loginMode);
      setMsg(null);
      setErr(null);
    }
  }, [loginOpen, loginMode]);

  const google = async () => {
    setErr(null);
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (r.error) setErr("La connexion Google a échoué. Réessayez.");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/compte" },
      });
      if (error) setErr(erreurInscription(error.message));
      else
        setMsg(
          "Compte créé. Confirmez votre adresse via le lien reçu par email, puis connectez-vous.",
        );
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error)
        setErr(
          error.message.includes("not confirmed")
            ? "Adresse email non confirmée. Cliquez sur le lien reçu par email."
            : "Email ou mot de passe incorrect.",
        );
    }
    setBusy(false);
  };

  // FON-03 (D-AUD-02, option c) : lien de connexion envoyé par email, sans révéler si le compte existe
  const lienConnexion = async () => {
    setErr(null);
    setMsg(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setErr("Saisissez d'abord votre adresse email ci-dessus.");
      return;
    }
    setBusy(true);
    await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + "/compte" },
    });
    setBusy(false);
    setMsg(
      "Si un compte existe pour cette adresse, un lien de connexion vient de lui être envoyé. Pensez à vérifier les indésirables.",
    );
  };

  return (
    <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "signup" ? "Créer un compte" : "Se connecter"}</DialogTitle>
          <DialogDescription>Recevez la synthèse IA par email ou sur Discord.</DialogDescription>
        </DialogHeader>
        <Button variant="outline" onClick={google} type="button">
          Continuer avec Google
        </Button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ou
          <span className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password">Mot de passe</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={8}
              aria-describedby={mode === "signup" ? "login-password-aide" : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === "signup" && (
              <p id="login-password-aide" className="text-xs text-muted-foreground">
                8 caractères au moins.
              </p>
            )}
          </div>
          {err && (
            <p role="alert" className="text-sm text-destructive">
              {err}
            </p>
          )}
          {msg && (
            <p role="status" className="text-sm text-primary">
              {msg}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "signup" ? "Créer mon compte" : "Se connecter"}
          </Button>
          {mode === "signin" && (
            <button
              type="button"
              className="link-accent text-sm"
              onClick={lienConnexion}
              disabled={busy}
            >
              Mot de passe oublié ? Recevoir un lien de connexion
            </button>
          )}
          {mode === "signup" && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Votre adresse sert à votre compte et, si vous le choisissez, à l'envoi quotidien de la
              synthèse. Vous pouvez changer de canal, exporter ou supprimer vos données à tout
              moment depuis Mon compte. Détail : page Confidentialité, en bas de chaque page.
            </p>
          )}
        </form>
        <p className="text-center text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>
              Pas encore de compte ?{" "}
              <button type="button" className="link-accent" onClick={() => setMode("signup")}>
                Créer un compte
              </button>
            </>
          ) : (
            <>
              Déjà inscrit ?{" "}
              <button type="button" className="link-accent" onClick={() => setMode("signin")}>
                Se connecter
              </button>
            </>
          )}
        </p>
      </DialogContent>
    </Dialog>
  );
}
