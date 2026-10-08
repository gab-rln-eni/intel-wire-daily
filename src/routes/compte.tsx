import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SujetCard } from "@/components/SujetCard";
import { supprimerCompte } from "@/lib/compte.functions";
import { INVITATION_DISCORD, RUBRIQUES, formatDate, rubriqueIndex, todayParis, type Sujet } from "@/lib/rubriques";

export const Route = createFileRoute("/compte")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/" });
    return { userId: data.user.id };
  },
  head: () => ({
    meta: [
      { title: "Mon compte | Le Fil IA" },
      { name: "description", content: "Votre synthèse IA, votre historique et vos préférences de réception." },
      { property: "og:title", content: "Mon compte | Le Fil IA" },
      { property: "og:description", content: "Synthèse, historique et préférences de réception." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Compte,
});

const card = "rounded-lg border border-border bg-card p-5";

function Compte() {
  const { userId } = Route.useRouteContext();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: syntheses = [] } = useQuery({
    queryKey: ["syntheses-envoyees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("syntheses")
        .select("id, date_veille, exemple, nb_sources, nb_sources_echec, nb_articles")
        .eq("statut", "envoyee")
        .order("date_veille", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const current = syntheses.find((s) => s.id === selected) ?? syntheses[0];

  const { data: sujets = [] } = useQuery({
    queryKey: ["sujets", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sujets")
        .select("*")
        .eq("synthese_id", current!.id)
        .order("ordre_rubrique")
        .order("ordre");
      if (error) throw error;
      return data as Sujet[];
    },
  });

  const groupes = [...new Set(sujets.map((s) => s.rubrique))].sort((a, b) => rubriqueIndex(a) - rubriqueIndex(b));
  const isLatest = current && current.id === syntheses[0]?.id;
  const titre = current
    ? isLatest && current.date_veille === todayParis()
      ? "Synthèse du jour"
      : `Synthèse du ${formatDate(current.date_veille)}`
    : "Synthèse";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="space-y-8">
        <section aria-labelledby="synthese-titre">
          <h1 id="synthese-titre" className="text-2xl font-bold text-foreground">{titre}</h1>
          {current ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDate(current.date_veille)}
                {current.nb_sources != null &&
                  ` | ${current.nb_sources - (current.nb_sources_echec ?? 0)} sources lues sur ${current.nb_sources}`}
                {current.nb_articles != null && ` | ${current.nb_articles} articles analysés`}
              </p>
              <div className="mt-6 space-y-6">
                {groupes.map((r) => (
                  <div key={r}>
                    <h2 className="mb-3 text-sm font-semibold text-foreground">{r}</h2>
                    <div className="grid gap-3">
                      {sujets.filter((s) => s.rubrique === r).map((s) => (
                        <SujetCard key={s.id} sujet={s} exemple={current.exemple} />
                      ))}
                    </div>
                  </div>
                ))}
                {sujets.length === 0 && <p className="text-sm text-muted-foreground">Aucun sujet.</p>}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Aucune synthèse envoyée pour le moment.</p>
          )}
        </section>

        <section aria-labelledby="historique-titre" className={card}>
          <h2 id="historique-titre" className="text-lg font-semibold text-foreground">Historique</h2>
          <ul className="mt-3 divide-y divide-border">
            {syntheses.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelected(s.id)}
                  aria-current={s.id === current?.id ? "true" : undefined}
                  className={`w-full py-2 text-left text-sm ${s.id === current?.id ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {formatDate(s.date_veille)}
                  {s.exemple && " (exemple)"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="space-y-6">
        <Preferences userId={userId} />
        <MesDonnees />
      </aside>
    </div>
  );
}

function Preferences({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [canal, setCanal] = useState<"email" | "discord">("email");
  const [rubriques, setRubriques] = useState<string[]>([...RUBRIQUES]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [msgR, setMsgR] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setCanal(profile.canal === "discord" ? "discord" : "email");
      setRubriques(profile.rubriques);
    }
  }, [profile]);

  const saveReception = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from("profiles")
      .update({ canal, discord_webhook_url: null })
      .eq("id", userId);
    setMsg(error ? { ok: false, text: "Enregistrement impossible." } : { ok: true, text: "Préférence enregistrée." });
    qc.invalidateQueries({ queryKey: ["profile", userId] });
  };

  const saveRubriques = async (e: React.FormEvent) => {
    e.preventDefault();
    const ordered = RUBRIQUES.filter((r) => rubriques.includes(r));
    const { error } = await supabase.from("profiles").update({ rubriques: ordered }).eq("id", userId);
    setMsgR(error ? { ok: false, text: "Enregistrement impossible." } : { ok: true, text: "Rubriques enregistrées." });
  };

  return (
    <>
      <section aria-labelledby="reception-titre" className={card}>
        <h2 id="reception-titre" className="text-lg font-semibold text-foreground">Réception</h2>
        <form onSubmit={saveReception} className="mt-3 space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm text-muted-foreground">Canal</legend>
            <RadioGroup value={canal} onValueChange={(v) => setCanal(v as "email" | "discord")}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="email" id="canal-email" />
                <Label htmlFor="canal-email">Email</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="discord" id="canal-discord" />
                <Label htmlFor="canal-discord">Discord</Label>
              </div>
            </RadioGroup>
          </fieldset>
          {canal === "discord" && (
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <p>Chaque matin, la synthèse est publiée dans le salon #synthese-du-jour du serveur Discord Le Fil IA (lecture seule).</p>
              {INVITATION_DISCORD && (
                <a href={INVITATION_DISCORD} target="_blank" rel="noopener noreferrer" className="link-accent">
                  Rejoindre le salon #synthese-du-jour ↗<span className="sr-only"> (nouvel onglet)</span>
                </a>
              )}
            </div>
          )}
          {msg && <p role="status" className={`text-sm ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
          <Button type="submit" size="sm">Enregistrer</Button>
        </form>
      </section>

      <section aria-labelledby="rubriques-titre" className={card}>
        <h2 id="rubriques-titre" className="text-lg font-semibold text-foreground">Rubriques suivies</h2>
        <form onSubmit={saveRubriques} className="mt-3 space-y-3">
          {RUBRIQUES.map((r, i) => (
            <div key={r} className="flex items-center gap-2">
              <Checkbox
                id={`rub-${i}`}
                checked={rubriques.includes(r)}
                onCheckedChange={(c) => setRubriques((prev) => (c ? [...prev, r] : prev.filter((x) => x !== r)))}
              />
              <Label htmlFor={`rub-${i}`} className="font-normal">{r}</Label>
            </div>
          ))}
          {msgR && <p role="status" className={`text-sm ${msgR.ok ? "text-primary" : "text-destructive"}`}>{msgR.text}</p>}
          <Button type="submit" size="sm">Enregistrer</Button>
        </form>
      </section>
    </>
  );
}

function MesDonnees() {
  const del = useServerFn(supprimerCompte);
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  return (
    <section aria-labelledby="donnees-titre" className={card}>
      <h2 id="donnees-titre" className="text-lg font-semibold text-foreground">Mes données</h2>
      <p className="mt-2 text-sm text-muted-foreground">La suppression efface définitivement votre compte et vos préférences.</p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="mt-3">Supprimer mon compte</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer votre compte ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est définitive : votre compte et votre profil seront supprimés.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await del();
                  await supabase.auth.signOut();
                  navigate({ to: "/" });
                } catch {
                  setErr("La suppression a échoué. Réessayez.");
                }
              }}
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
    </section>
  );
}
