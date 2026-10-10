// Tests des adresses appelées par n8n (MNT-03, D-AUD-10) : faux client Supabase, aucun réseau.
// lister-abonnes (D-AUD-01) : liste d'autorisation et mode test ; corps invalides (API-02) ; plafond de sujets (API-01).
import { beforeEach, describe, expect, it, vi } from "vitest";

type Etat = {
  users: object[];
  profils: object[];
  modeTest?: boolean;
  erreurMode?: boolean;
  roles: object[];
  rpc?: unknown;
};
const etat: Etat = { users: [], profils: [], roles: [] };

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(t: string) {
      if (t === "profiles") return { select: async () => ({ data: etat.profils, error: null }) };
      if (t === "parametres")
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () =>
                etat.erreurMode
                  ? { data: null, error: { message: "x" } }
                  : { data: { valeur: etat.modeTest === true }, error: null },
            }),
          }),
        };
      if (t === "user_roles") return { select: async () => ({ data: etat.roles, error: null }) };
      throw new Error("table inattendue " + t);
    },
    rpc: async () => ({ data: etat.rpc ?? { ok: true }, error: null }),
    auth: {
      admin: {
        listUsers: async ({ page }: { page: number }) => ({
          data: { users: page === 1 ? etat.users : [] },
          error: null,
        }),
      },
    },
  },
}));

const SECRET = "secret-de-test-0123456789";
const req = (corps?: string, secret = SECRET) =>
  new Request("https://x/api", {
    method: corps === undefined ? "GET" : "POST",
    headers: { "x-publication-secret": secret, "content-type": "application/json" },
    body: corps ?? null,
  });
type Route = {
  options?: unknown;
  server?: { handlers: Record<string, (a: { request: Request }) => Promise<Response>> };
};
const appel = async (mod: { Route: Route }, methode: "GET" | "POST", r: Request) => {
  const route = mod.Route as unknown as {
    options: {
      server: { handlers: Record<string, (a: { request: Request }) => Promise<Response>> };
    };
  };
  const h = route.options.server.handlers[methode]!;
  const rep = await h({ request: r });
  return { code: rep.status, corps: await rep.json().catch(() => null) };
};

const passe = new Date(Date.now() - 864e5).toISOString();
const futur = new Date(Date.now() + 864e5).toISOString();

beforeEach(() => {
  process.env["PUBLICATION_SECRET"] = SECRET;
  etat.users = [
    { id: "a", email: "a@x.fr", email_confirmed_at: passe },
    { id: "b", email: "b@x.fr", email_confirmed_at: null },
    { id: "c", email: "c@x.fr", email_confirmed_at: passe, banned_until: futur },
    { id: "adm", email: "adm@x.fr", email_confirmed_at: passe },
  ];
  etat.profils = [
    { id: "a", canal: "email", rubriques: ["Recherche"] },
    { id: "b", canal: "email", rubriques: [] },
    { id: "c", canal: "email", rubriques: [] },
    { id: "adm", canal: "aucun", rubriques: [] },
    { id: "orphelin", canal: "email", rubriques: [] },
  ];
  etat.roles = [{ user_id: "adm", role: "admin" }];
  etat.modeTest = false;
  etat.erreurMode = false;
});

describe("lister-abonnes", async () => {
  const mod = await import("@/routes/api/public/lister-abonnes");
  it("refuse un secret faux", async () => {
    expect((await appel(mod, "GET", req(undefined, "faux"))).code).toBe(401);
  });
  it("ne renvoie que les comptes confirmés et non suspendus, adresse du compte, champs limités", async () => {
    const r = await appel(mod, "GET", req());
    expect(r.corps.mode_test).toBe(false);
    expect(r.corps.abonnes.map((x: { email: string }) => x.email).sort()).toEqual([
      "a@x.fr",
      "adm@x.fr",
    ]);
    expect(Object.keys(r.corps.abonnes[0]).sort()).toEqual(["canal", "email", "rubriques"]);
  });
  it("mode test : équipe seule", async () => {
    etat.modeTest = true;
    const r = await appel(mod, "GET", req());
    expect(r.corps.abonnes.map((x: { email: string }) => x.email)).toEqual(["adm@x.fr"]);
  });
  it("lecture du mode test en échec : traitée comme mode test (jamais d'envoi aux abonnés par erreur)", async () => {
    etat.erreurMode = true;
    const r = await appel(mod, "GET", req());
    expect(r.corps.mode_test).toBe(true);
    expect(r.corps.abonnes.map((x: { email: string }) => x.email)).toEqual(["adm@x.fr"]);
  });
});

describe("corps invalides (API-02) et plafond (API-01)", async () => {
  const routes = {
    "demande-statut": await import("@/routes/api/public/demande-statut"),
    "publier-sources": await import("@/routes/api/public/publier-sources"),
    "action-source-statut": await import("@/routes/api/public/action-source-statut"),
    "nettoyage-statut": await import("@/routes/api/public/nettoyage-statut"),
  };
  for (const [nom, mod] of Object.entries(routes)) {
    it(`${nom} : corps null ou tableau = 400`, async () => {
      expect((await appel(mod, "POST", req("null"))).code).toBe(400);
      expect((await appel(mod, "POST", req("[]"))).code).toBe(400);
    });
  }
  it("publier-synthese : plus de 100 sujets = 400", async () => {
    const mod = await import("@/routes/api/public/publier-synthese");
    const sujet = { titre: "t", lien: "https://x.fr/a", rubrique: "Recherche" };
    const corps = {
      synthese: { date_veille: "2026-10-10", statut: "ENVOYE" },
      sujets: Array.from({ length: 101 }, () => sujet),
    };
    const r = await appel(mod, "POST", req(JSON.stringify(corps)));
    expect(r.code).toBe(400);
    expect(r.corps.error).toBe("trop de sujets");
  });
});
