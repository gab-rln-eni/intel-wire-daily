export const RUBRIQUES = [
  "Réglementation et gouvernance",
  "Modèles et produits",
  "Recherche",
  "Usages en entreprise",
  "France et Europe",
  "Autres actualités",
] as const;

export const WEBHOOK_PREFIX = "https://discord.com/api/webhooks/";

export type Sujet = {
  id?: string;
  rubrique: string;
  titre: string;
  resume: string;
  redige: boolean;
  extrait: string;
  source: string;
  lien: string;
  ordre: number;
  ordre_rubrique: number;
};

export function rubriqueIndex(r: string) {
  const i = RUBRIQUES.indexOf(r as (typeof RUBRIQUES)[number]);
  return i === -1 ? RUBRIQUES.length : i;
}

export function todayParis() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
}

export function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTime(d: string | null) {
  if (!d) return "Non renseigné";
  return new Date(d).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function maskEmail(e: string | null) {
  if (!e) return "Inconnu";
  const [u, d] = e.split("@");
  return `${u.slice(0, 1)}***@${d ?? ""}`;
}
