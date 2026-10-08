import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";

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
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
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
      if (error) setErr(error.message);
      else setMsg("Compte créé. Confirmez votre adresse via le lien reçu par email, puis connectez-vous.");
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
            <Input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password">Mot de passe</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          {msg && <p role="status" className="text-sm text-primary">{msg}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "signup" ? "Créer mon compte" : "Se connecter"}
          </Button>
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
