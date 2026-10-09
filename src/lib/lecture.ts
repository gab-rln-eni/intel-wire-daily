import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sauverFavori } from "@/lib/favoris.functions";
import type { Sujet } from "@/lib/rubriques";

// Lus et favoris de l'abonné (A-2 à A-5, A-7) : en base, liés au compte, clé = URL de l'article
// (les sujets sont réécrits à chaque publication, leur identifiant change, l'URL non).
// Tables ajoutées hors des types générés : accès non typé, toujours lié à son client (PNPR-WEB-3).

export type SujetLu = Sujet & { id: string; publie_le?: string | null };
export type Favori = {
  id: string;
  lien: string;
  titre: string;
  resume: string | null;
  source: string | null;
  rubrique: string | null;
  date_veille: string | null;
  sauve_le: string;
  lien_etat: "inconnu" | "ok" | "rompu" | "incertain";
  verifie_le: string | null;
};

type Lecture = {
  select: (c: string) => {
    in: (k: string, v: string[]) => Promise<{ data: { lien: string }[] | null }>;
    order: (k: string, o: object) => Promise<{ data: unknown[] | null }>;
  };
  upsert: (v: object[], o: object) => Promise<{ error: unknown }>;
  delete: () => { eq: (k: string, v: string) => { in: (k: string, v: string[]) => Promise<{ error: unknown }> } };
};
const t = (nom: string) => (supabase.from as unknown as (n: string) => Lecture).bind(supabase)(nom);

/** Dernière synthèse publiée et ses sujets (mêmes clés de cache que la page Synthèse). */
export function useSyntheses(actif = true) {
  return useQuery({
    queryKey: ["syntheses-envoyees"],
    enabled: actif,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("syntheses")
        .select("id, date_veille, exemple, nb_sources, nb_sources_echec, nb_articles, nb_sujets")
        .eq("statut", "envoyee")
        .order("date_veille", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useSujets(syntheseId: string | undefined) {
  return useQuery({
    queryKey: ["sujets", syntheseId],
    enabled: !!syntheseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sujets")
        .select("*")
        .eq("synthese_id", syntheseId!)
        .order("ordre_rubrique")
        .order("ordre");
      if (error) throw error;
      return data as SujetLu[];
    },
  });
}

/** Liens déjà lus parmi ceux affichés. */
export function useLus(userId: string | undefined, liens: string[]) {
  const cle = liens.join("|");
  return useQuery({
    queryKey: ["lus", userId, cle],
    enabled: !!userId && liens.length > 0,
    queryFn: async () => {
      const { data } = await t("lectures").select("lien").in("lien", liens);
      return new Set((data ?? []).map((x) => x.lien));
    },
  });
}

/** Liens sauvegardés (pour l'étoile). */
export function useFavoris(userId: string | undefined) {
  return useQuery({
    queryKey: ["favoris", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await t("favoris")
        .select("id, lien, titre, resume, source, rubrique, date_veille, sauve_le, lien_etat, verifie_le")
        .order("sauve_le", { ascending: false });
      return (data ?? []) as Favori[];
    },
  });
}

/** Nombre de non lus de la dernière synthèse, pour l'en-tête. */
export function useNonLus(userId: string | undefined) {
  const { data: syntheses = [] } = useSyntheses(!!userId);
  const { data: sujets = [] } = useSujets(userId ? syntheses[0]?.id : undefined);
  const liens = sujets.map((s) => s.lien);
  const { data: lus } = useLus(userId, liens);
  return lus ? liens.filter((l) => !lus.has(l)).length : 0;
}

/** Actions de lecture et d'étoile, avec mise à jour immédiate de l'affichage (puis relecture de la base). */
export function useActionsLecture(userId: string) {
  const qc = useQueryClient();
  const sauver = useServerFn(sauverFavori);
  const majLus = (fn: (s: Set<string>) => void) =>
    qc.setQueriesData<Set<string>>({ queryKey: ["lus", userId] }, (old) => {
      const s = new Set(old ?? []);
      fn(s);
      return s;
    });
  const relire = () => qc.invalidateQueries({ queryKey: ["lus", userId] });
  return {
    marquerLus: async (liens: string[]) => {
      if (!liens.length) return;
      majLus((s) => liens.forEach((l) => s.add(l)));
      await t("lectures").upsert(liens.map((lien) => ({ user_id: userId, lien })), { onConflict: "user_id,lien", ignoreDuplicates: true });
      relire();
    },
    marquerNonLu: async (lien: string) => {
      majLus((s) => s.delete(lien));
      await t("lectures").delete().eq("user_id", userId).in("lien", [lien]);
      relire();
    },
    marquerNonLus: async (liens: string[]) => {
      if (!liens.length) return;
      majLus((s) => liens.forEach((l) => s.delete(l)));
      await t("lectures").delete().eq("user_id", userId).in("lien", liens);
      relire();
    },
    basculerFavori: async (lien: string, estFavori: boolean) => {
      if (estFavori) await t("favoris").delete().eq("user_id", userId).in("lien", [lien]);
      else await sauver({ data: { lien } });
      await qc.invalidateQueries({ queryKey: ["favoris", userId] });
    },
  };
}
