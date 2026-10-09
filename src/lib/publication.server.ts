export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export function verifierSecret(request: Request) {
  const expected = process.env["PUBLICATION_SECRET"];
  const got = request.headers.get("x-publication-secret") ?? "";
  if (!expected || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Fonction SQL ajoutée hors des types générés ; bind indispensable : rpc détachée de son client plante (« this » perdu, PNPR-WEB-3). */
export function rpcLiee(sb: Admin) {
  return (sb.rpc as unknown as (f: string, a?: object) => Promise<{ data: unknown; error: unknown }>).bind(sb);
}

/** Mode test (D-WEB-16) lu dans parametres ; en cas d'erreur de lecture, on se met en sécurité (mode test supposé actif). */
export async function lireModeTest(sb: Admin) {
  const lecture = (sb.from as unknown as (t: string) => {
    select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { valeur: unknown } | null; error: unknown }> } };
  }).bind(sb);
  const { data, error } = await lecture("parametres").select("valeur").eq("cle", "mode_test").maybeSingle();
  return error ? true : data?.valeur === true;
}
