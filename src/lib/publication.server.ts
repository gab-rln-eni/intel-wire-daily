export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
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

/** Mode test (D-WEB-16) lu dans parametres ; en cas d'erreur de lecture, on se met en sécurité (mode test supposé actif). */
export async function lireModeTest(sb: Admin) {
  const { data, error } = await sb
    .from("parametres")
    .select("valeur")
    .eq("cle", "mode_test")
    .maybeSingle();
  return error ? true : data?.valeur === true;
}
