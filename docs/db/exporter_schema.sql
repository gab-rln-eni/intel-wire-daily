-- Export du schéma (lecture seule) : produit le texte de docs/db/schema.sql en une seule ligne de résultat.
-- À exécuter dans l'éditeur SQL de Lovable Cloud ; rien n'est modifié.
WITH t AS (
 SELECT 1 o, c.relname::text k, 'CREATE TABLE public.' || c.relname || ' (' || E'\n' || string_agg('  ' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END || coalesce(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), ''), E',\n' ORDER BY a.attnum) || E'\n);' s
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
 WHERE n.nspname='public' AND c.relkind='r' GROUP BY c.relname
 UNION ALL SELECT 2, conrelid::regclass::text || conname, 'ALTER TABLE ' || conrelid::regclass || ' ADD CONSTRAINT ' || conname || ' ' || pg_get_constraintdef(oid) || ';' FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype IN ('p','u','f','c')
 UNION ALL SELECT 3, indexname, indexdef || ';' FROM pg_indexes WHERE schemaname='public' AND indexname NOT IN (SELECT conname FROM pg_constraint)
 UNION ALL SELECT 4, c.relname, 'ALTER TABLE public.' || c.relname || ' ENABLE ROW LEVEL SECURITY;' FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND c.relrowsecurity
 UNION ALL SELECT 5, tablename || policyname, 'CREATE POLICY "' || policyname || '" ON public.' || tablename || ' AS ' || permissive || ' FOR ' || cmd || ' TO ' || array_to_string(roles, ', ') || coalesce(' USING (' || qual || ')', '') || coalesce(' WITH CHECK (' || with_check || ')', '') || ';' FROM pg_policies WHERE schemaname='public'
 UNION ALL SELECT 6, p.proname, pg_get_functiondef(p.oid) || ';' FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
 UNION ALL SELECT 7, tgname, pg_get_triggerdef(t.oid) || ';' FROM pg_trigger t WHERE NOT t.tgisinternal AND (t.tgrelid::regclass::text LIKE 'public.%' OR t.tgrelid::regclass::text NOT LIKE '%.%' OR t.tgrelid='auth.users'::regclass)
 UNION ALL SELECT 8, t.typname, 'CREATE TYPE public.' || t.typname || ' AS ENUM (' || string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) || ');' FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typnamespace='public'::regnamespace GROUP BY t.typname
 UNION ALL SELECT 9, routine_name || grantee, 'GRANT EXECUTE ON FUNCTION public.' || routine_name || ' TO ' || grantee || ';' FROM information_schema.routine_privileges WHERE routine_schema='public' AND grantee NOT IN ('postgres','PUBLIC','supabase_admin')
)
SELECT string_agg(s, E'\n\n' ORDER BY CASE o WHEN 8 THEN 0 ELSE o END, k) AS schema FROM t;
