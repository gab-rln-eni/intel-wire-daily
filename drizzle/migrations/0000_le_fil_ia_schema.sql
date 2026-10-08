
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  canal text NOT NULL DEFAULT 'email' CHECK (canal IN ('email','discord')),
  discord_webhook_url text CHECK (discord_webhook_url IS NULL OR discord_webhook_url = '' OR discord_webhook_url LIKE 'https://discord.com/api/webhooks/%'),
  rubriques text[] NOT NULL DEFAULT ARRAY['Réglementation et gouvernance','Modèles et produits','Recherche','Usages en entreprise','France et Europe','Autres actualités'],
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (canal, discord_webhook_url, rubriques) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profile update own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.grant_admin_if_confirmed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'gabriel.roulon@gmail.com' AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_admin_ins AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_admin_if_confirmed();
CREATE TRIGGER on_auth_user_admin_upd AFTER UPDATE OF email_confirmed_at, email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_admin_if_confirmed();

CREATE TABLE public.syntheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_veille date NOT NULL UNIQUE,
  statut text NOT NULL CHECK (statut IN ('envoyee','en_cours','echec')),
  nb_sources int, nb_sources_echec int, nb_articles int, nb_sujets int,
  degrade boolean NOT NULL DEFAULT false,
  exemple boolean NOT NULL DEFAULT false,
  envoye_le timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.syntheses TO authenticated;
GRANT ALL ON public.syntheses TO service_role;
ALTER TABLE public.syntheses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "syntheses read" ON public.syntheses FOR SELECT TO authenticated
  USING (statut = 'envoyee' OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.sujets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  synthese_id uuid NOT NULL REFERENCES public.syntheses(id) ON DELETE CASCADE,
  ordre int NOT NULL DEFAULT 0,
  ordre_rubrique int NOT NULL DEFAULT 0,
  rubrique text NOT NULL,
  titre text NOT NULL,
  resume text NOT NULL DEFAULT '',
  redige boolean NOT NULL DEFAULT true,
  extrait text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  lien text NOT NULL,
  publie_le timestamptz
);
CREATE INDEX ON public.sujets (synthese_id);
GRANT SELECT ON public.sujets TO authenticated;
GRANT ALL ON public.sujets TO service_role;
ALTER TABLE public.sujets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sujets read" ON public.sujets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.syntheses s WHERE s.id = synthese_id
    AND (s.statut = 'envoyee' OR public.has_role(auth.uid(), 'admin'))));

CREATE TABLE public.demandes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  demandeur uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','prise','terminee'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandes TO authenticated;
GRANT ALL ON public.demandes TO service_role;
ALTER TABLE public.demandes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demandes admin" ON public.demandes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND demandeur = auth.uid());

CREATE OR REPLACE FUNCTION public.apercu_public()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH s AS (
    SELECT * FROM public.syntheses WHERE statut = 'envoyee'
    ORDER BY date_veille DESC LIMIT 1
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM s) THEN NULL ELSE
    jsonb_build_object(
      'date_veille', (SELECT date_veille FROM s),
      'exemple', (SELECT exemple FROM s),
      'sujets', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.ordre_rubrique, t.ordre) FROM (
        SELECT j.rubrique, j.titre, j.resume, j.redige, j.extrait, j.source, j.lien, j.ordre, j.ordre_rubrique
        FROM public.sujets j WHERE j.synthese_id = (SELECT id FROM s)
        ORDER BY j.ordre_rubrique, j.ordre LIMIT 3) t), '[]'::jsonb)
    ) END
$$;
REVOKE EXECUTE ON FUNCTION public.apercu_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apercu_public() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.publier_synthese(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  s jsonb := p->'synthese';
  suj jsonb := p->'sujets';
  d date := (s->>'date_veille')::date;
  st text := s->>'statut';
  existing_id uuid;
  has_sujets boolean := false;
  sid uuid;
  n int := 0;
BEGIN
  SELECT id INTO existing_id FROM public.syntheses WHERE date_veille = d;
  IF existing_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.sujets WHERE synthese_id = existing_id) INTO has_sujets;
  END IF;
  IF has_sujets AND (suj IS NULL OR jsonb_typeof(suj) <> 'array' OR jsonb_array_length(suj) = 0) THEN
    RETURN jsonb_build_object('conflict', true, 'date_veille', d);
  END IF;
  INSERT INTO public.syntheses (date_veille, statut, nb_sources, nb_sources_echec, nb_articles, nb_sujets, degrade, exemple, envoye_le, updated_at)
  VALUES (d, st, (s->>'nb_sources')::int, (s->>'nb_sources_echec')::int, (s->>'nb_articles')::int, (s->>'nb_sujets')::int,
    COALESCE((s->>'degrade')::boolean, false), false, (s->>'envoye_le')::timestamptz, now())
  ON CONFLICT (date_veille) DO UPDATE SET statut = EXCLUDED.statut, nb_sources = EXCLUDED.nb_sources,
    nb_sources_echec = EXCLUDED.nb_sources_echec, nb_articles = EXCLUDED.nb_articles, nb_sujets = EXCLUDED.nb_sujets,
    degrade = EXCLUDED.degrade, exemple = false, envoye_le = EXCLUDED.envoye_le, updated_at = now()
  RETURNING id INTO sid;
  IF st = 'envoyee' AND suj IS NOT NULL AND jsonb_typeof(suj) = 'array' AND jsonb_array_length(suj) > 0 THEN
    DELETE FROM public.sujets WHERE synthese_id = sid;
    INSERT INTO public.sujets (synthese_id, ordre, ordre_rubrique, rubrique, titre, resume, redige, extrait, source, lien, publie_le)
    SELECT sid, COALESCE((x->>'n')::int,0), COALESCE((x->>'ordre_rubrique')::int,0), COALESCE(x->>'rubrique','Autres actualités'),
      x->>'titre', COALESCE(x->>'resume',''), COALESCE((x->>'redige')::boolean, true), COALESCE(x->>'extrait',''),
      COALESCE(x->>'source',''), x->>'lien', NULLIF(x->>'publie_le','')::timestamptz
    FROM jsonb_array_elements(suj) x;
  END IF;
  SELECT count(*) INTO n FROM public.sujets WHERE synthese_id = sid;
  RETURN jsonb_build_object('ok', true, 'date_veille', d, 'nb_sujets', n);
END $$;
REVOKE EXECUTE ON FUNCTION public.publier_synthese(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publier_synthese(jsonb) TO service_role;

-- Données d'exemple
WITH s AS (
  INSERT INTO public.syntheses (date_veille, statut, nb_sources, nb_sources_echec, nb_articles, nb_sujets, degrade, exemple, envoye_le)
  VALUES (current_date, 'envoyee', 20, 1, 143, 5, false, true, (current_date + time '07:05') AT TIME ZONE 'Europe/Paris')
  RETURNING id
)
INSERT INTO public.sujets (synthese_id, ordre, ordre_rubrique, rubrique, titre, resume, redige, extrait, source, lien, publie_le)
SELECT s.id, v.ordre, v.ord_r, v.rubrique, v.titre, v.resume, v.redige, v.extrait, v.source, v.lien, now() - interval '12 hours'
FROM s, (VALUES
  (1, 1, 'Réglementation et gouvernance', 'AI Act : les obligations des modèles à usage général se précisent',
   'La Commission publie de nouvelles lignes directrices sur la documentation technique attendue des fournisseurs de modèles à usage général. Le calendrier d''application reste inchangé.',
   true, 'La Commission européenne a publié des lignes directrices sur les obligations des fournisseurs de modèles à usage général.', 'EU AI Act Newsletter', 'https://artificialintelligenceact.substack.com/'),
  (2, 2, 'Modèles et produits', 'Mistral AI présente un nouveau modèle compact',
   'Mistral AI annonce un modèle plus léger, pensé pour un déploiement local, avec une fenêtre de contexte étendue et une licence ouverte.',
   true, 'Mistral AI annonce la disponibilité d''un nouveau modèle compact.', 'Mistral AI', 'https://mistral.ai/news/'),
  (3, 3, 'Recherche', 'Hugging Face publie un jeu de données d''évaluation multilingue',
   '', false, 'Hugging Face met à disposition un nouveau jeu de données pour évaluer les modèles de langue dans plus de quarante langues, dont plusieurs langues peu dotées.', 'Hugging Face', 'https://huggingface.co/blog'),
  (4, 4, 'Usages en entreprise', 'Les PME françaises accélèrent sur les assistants de rédaction',
   'Une enquête relève une hausse nette de l''usage des assistants génératifs dans les PME, surtout pour la relation client et la rédaction de documents internes.',
   true, 'Selon une enquête récente, l''adoption des assistants IA progresse dans les PME.', 'JDN IA', 'https://www.journaldunet.com/intelligence-artificielle/'),
  (5, 5, 'France et Europe', 'La CNIL publie des recommandations sur l''IA et le RGPD',
   'La CNIL complète ses fiches pratiques pour aider les organismes à concilier développement de systèmes d''IA et protection des données personnelles.',
   true, 'La CNIL publie de nouvelles recommandations pour le développement des systèmes d''IA.', 'CNIL', 'https://www.cnil.fr/fr/intelligence-artificielle')
) AS v(ordre, ord_r, rubrique, titre, resume, redige, extrait, source, lien);
