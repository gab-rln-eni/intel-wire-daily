-- Schéma de la base Le Fil IA (MNT-01, D-AUD-09) : instantané lu en base de production le 2026-10-10, schéma public
-- et déclencheurs sur auth.users. Référence de lecture, pas une migration à rejouer telle quelle : la base est gérée
-- par Lovable Cloud. Pour le mettre à jour, rejouer docs/db/exporter_schema.sql (lecture seule) et remplacer ce fichier.

CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'veilleur');

CREATE TABLE public.actions_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cree_le timestamp with time zone NOT NULL DEFAULT now(),
  auteur uuid,
  auteur_email text,
  role text,
  action text NOT NULL,
  nom text NOT NULL,
  url text,
  categorie text,
  priorite text,
  motif text NOT NULL,
  statut text NOT NULL DEFAULT 'en_attente'::text,
  detail text,
  valide_par text,
  pris_le timestamp with time zone,
  traite_le timestamp with time zone
);

CREATE TABLE public.admin_journal (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cree_le timestamp with time zone NOT NULL DEFAULT now(),
  auteur uuid,
  auteur_email text,
  role text,
  action text NOT NULL,
  cible text,
  detail text,
  resultat text NOT NULL DEFAULT 'ok'::text
);

CREATE TABLE public.chaine_etat (
  id integer NOT NULL DEFAULT 1,
  dernier_appel timestamp with time zone
);

CREATE TABLE public.demandes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  demandeur uuid,
  statut text NOT NULL DEFAULT 'en_attente'::text,
  pris_le timestamp with time zone,
  termine_le timestamp with time zone,
  detail text,
  sujets_avant integer
);

CREATE TABLE public.favoris (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lien text NOT NULL,
  titre text NOT NULL,
  resume text,
  source text,
  rubrique text,
  date_veille date,
  sauve_le timestamp with time zone NOT NULL DEFAULT now(),
  lien_etat text NOT NULL DEFAULT 'inconnu'::text,
  verifie_le timestamp with time zone
);

CREATE TABLE public.lectures (
  user_id uuid NOT NULL,
  lien text NOT NULL,
  lu_le timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.nettoyages_salons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cree_le timestamp with time zone NOT NULL DEFAULT now(),
  salon text NOT NULL,
  portee text NOT NULL,
  mode text NOT NULL,
  auteur_email text,
  statut text NOT NULL DEFAULT 'en_attente'::text,
  pris_le timestamp with time zone,
  termine_le timestamp with time zone,
  supprimes integer NOT NULL DEFAULT 0,
  detail text
);

CREATE TABLE public.parametres (
  cle text NOT NULL,
  valeur jsonb NOT NULL,
  maj_le timestamp with time zone NOT NULL DEFAULT now(),
  maj_par text
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text,
  canal text NOT NULL DEFAULT 'email'::text,
  discord_webhook_url text,
  rubriques text[] NOT NULL DEFAULT ARRAY['Réglementation et gouvernance'::text, 'Modèles et produits'::text, 'Recherche'::text, 'Usages en entreprise'::text, 'France et Europe'::text, 'Autres actualités'::text],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  consentement_le timestamp with time zone DEFAULT now()
);

CREATE TABLE public.sources_miroir (
  nom text NOT NULL,
  url text,
  categorie text,
  priorite integer,
  active boolean NOT NULL DEFAULT true,
  statut_sante text,
  jours_echec integer,
  nb_articles integer,
  sante_le date,
  maj_le timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.sujets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  synthese_id uuid NOT NULL,
  ordre integer NOT NULL DEFAULT 0,
  ordre_rubrique integer NOT NULL DEFAULT 0,
  rubrique text NOT NULL,
  titre text NOT NULL,
  resume text NOT NULL DEFAULT ''::text,
  redige boolean NOT NULL DEFAULT true,
  extrait text NOT NULL DEFAULT ''::text,
  source text NOT NULL DEFAULT ''::text,
  lien text NOT NULL,
  publie_le timestamp with time zone
);

CREATE TABLE public.syntheses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  date_veille date NOT NULL,
  statut text NOT NULL,
  nb_sources integer,
  nb_sources_echec integer,
  nb_articles integer,
  nb_sujets integer,
  degrade boolean NOT NULL DEFAULT false,
  exemple boolean NOT NULL DEFAULT false,
  envoye_le timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL
);

ALTER TABLE actions_sources ADD CONSTRAINT actions_sources_action_check CHECK ((action = ANY (ARRAY['Ajouter'::text, 'Activer'::text, 'Désactiver'::text])));

ALTER TABLE actions_sources ADD CONSTRAINT actions_sources_pkey PRIMARY KEY (id);

ALTER TABLE actions_sources ADD CONSTRAINT actions_sources_statut_check CHECK ((statut = ANY (ARRAY['a_valider'::text, 'en_attente'::text, 'prise'::text, 'appliquee'::text, 'refusee'::text, 'annulee'::text])));

ALTER TABLE admin_journal ADD CONSTRAINT admin_journal_pkey PRIMARY KEY (id);

ALTER TABLE chaine_etat ADD CONSTRAINT chaine_etat_id_check CHECK ((id = 1));

ALTER TABLE chaine_etat ADD CONSTRAINT chaine_etat_pkey PRIMARY KEY (id);

ALTER TABLE demandes ADD CONSTRAINT demandes_demandeur_fkey FOREIGN KEY (demandeur) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE demandes ADD CONSTRAINT demandes_pkey PRIMARY KEY (id);

ALTER TABLE demandes ADD CONSTRAINT demandes_statut_check CHECK ((statut = ANY (ARRAY['en_attente'::text, 'prise'::text, 'terminee'::text, 'echec'::text])));

ALTER TABLE favoris ADD CONSTRAINT favoris_lien_etat_check CHECK ((lien_etat = ANY (ARRAY['inconnu'::text, 'ok'::text, 'rompu'::text, 'incertain'::text])));

ALTER TABLE favoris ADD CONSTRAINT favoris_pkey PRIMARY KEY (id);

ALTER TABLE favoris ADD CONSTRAINT favoris_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE favoris ADD CONSTRAINT favoris_user_id_lien_key UNIQUE (user_id, lien);

ALTER TABLE lectures ADD CONSTRAINT lectures_lien_check CHECK ((length(lien) <= 2000));

ALTER TABLE lectures ADD CONSTRAINT lectures_pkey PRIMARY KEY (user_id, lien);

ALTER TABLE lectures ADD CONSTRAINT lectures_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE nettoyages_salons ADD CONSTRAINT nettoyages_salons_mode_check CHECK ((mode = ANY (ARRAY['auto'::text, 'manuel'::text])));

ALTER TABLE nettoyages_salons ADD CONSTRAINT nettoyages_salons_pkey PRIMARY KEY (id);

ALTER TABLE nettoyages_salons ADD CONSTRAINT nettoyages_salons_portee_check CHECK ((portee = ANY (ARRAY['30j'::text, 'tout'::text])));

ALTER TABLE nettoyages_salons ADD CONSTRAINT nettoyages_salons_salon_check CHECK ((salon = ANY (ARRAY['alertes'::text, 'assistant'::text])));

ALTER TABLE nettoyages_salons ADD CONSTRAINT nettoyages_salons_statut_check CHECK ((statut = ANY (ARRAY['en_attente'::text, 'prise'::text, 'terminee'::text, 'echec'::text])));

ALTER TABLE parametres ADD CONSTRAINT parametres_pkey PRIMARY KEY (cle);

ALTER TABLE profiles ADD CONSTRAINT profiles_canal_check CHECK ((canal = ANY (ARRAY['email'::text, 'discord'::text, 'aucun'::text])));

ALTER TABLE profiles ADD CONSTRAINT profiles_discord_webhook_url_check CHECK (((discord_webhook_url IS NULL) OR (discord_webhook_url = ''::text) OR (discord_webhook_url ~~ 'https://discord.com/api/webhooks/%'::text)));

ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE sources_miroir ADD CONSTRAINT sources_miroir_pkey PRIMARY KEY (nom);

ALTER TABLE sujets ADD CONSTRAINT sujets_pkey PRIMARY KEY (id);

ALTER TABLE sujets ADD CONSTRAINT sujets_synthese_id_fkey FOREIGN KEY (synthese_id) REFERENCES syntheses(id) ON DELETE CASCADE;

ALTER TABLE syntheses ADD CONSTRAINT syntheses_date_veille_key UNIQUE (date_veille);

ALTER TABLE syntheses ADD CONSTRAINT syntheses_pkey PRIMARY KEY (id);

ALTER TABLE syntheses ADD CONSTRAINT syntheses_statut_check CHECK ((statut = ANY (ARRAY['envoyee'::text, 'en_cours'::text, 'echec'::text])));

ALTER TABLE user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);

ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

CREATE INDEX actions_sources_statut ON public.actions_sources USING btree (statut, cree_le);

CREATE INDEX admin_journal_cree_le ON public.admin_journal USING btree (cree_le DESC);

CREATE INDEX favoris_user ON public.favoris USING btree (user_id, sauve_le DESC);

CREATE INDEX sujets_synthese_id_idx ON public.sujets USING btree (synthese_id);

ALTER TABLE public.actions_sources ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_journal ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.chaine_etat ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.demandes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.favoris ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.nettoyages_salons ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.parametres ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sources_miroir ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sujets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.syntheses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "actions sources equipe" ON public.actions_sources AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'veilleur'::app_role)));

CREATE POLICY "journal admin" ON public.admin_journal AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "journal veilleur" ON public.admin_journal AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'veilleur'::app_role) AND (auteur = auth.uid())));

CREATE POLICY "chaine_etat admin" ON public.chaine_etat AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "chaine_etat veilleur" ON public.chaine_etat AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'veilleur'::app_role));

CREATE POLICY "demandes admin" ON public.demandes AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) AND (demandeur = auth.uid())));

CREATE POLICY "demandes veilleur" ON public.demandes AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'veilleur'::app_role));

CREATE POLICY "favoris lire" ON public.favoris AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY "favoris retirer" ON public.favoris AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY "lectures ajouter" ON public.lectures AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "lectures lire" ON public.lectures AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY "lectures retirer" ON public.lectures AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY "nettoyages admin" ON public.nettoyages_salons AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "parametres equipe" ON public.parametres AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR (has_role(auth.uid(), 'veilleur'::app_role) AND (cle = ANY (ARRAY['mode_test'::text, 'sources_maj'::text])))));

CREATE POLICY "profile read" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (((id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "profile update own" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));

CREATE POLICY "sources equipe" ON public.sources_miroir AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'veilleur'::app_role)));

CREATE POLICY "sujets read" ON public.sujets AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM syntheses s
  WHERE ((s.id = sujets.synthese_id) AND ((s.statut = 'envoyee'::text) OR has_role(auth.uid(), 'admin'::app_role))))));

CREATE POLICY "syntheses read" ON public.syntheses AS PERMISSIVE FOR SELECT TO authenticated USING (((statut = 'envoyee'::text) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "own roles read" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE OR REPLACE FUNCTION public.apercu_public()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Aperçu public de l'accueil : sans lien vers les articles (réservés aux abonnés)
  WITH s AS (
    SELECT * FROM public.syntheses WHERE statut = 'envoyee'
    ORDER BY date_veille DESC LIMIT 1
  ),
  j AS (
    SELECT x.*, row_number() OVER (PARTITION BY x.rubrique ORDER BY x.ordre) AS rang
    FROM public.sujets x WHERE x.synthese_id = (SELECT id FROM s)
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM s) THEN NULL ELSE
    jsonb_build_object(
      'date_veille', (SELECT date_veille FROM s),
      'exemple', (SELECT exemple FROM s),
      'nb_sujets', (SELECT count(*) FROM j),
      'nb_rubriques', (SELECT count(DISTINCT rubrique) FROM j),
      'nb_sources_citees', (SELECT count(DISTINCT source) FROM j),
      'nb_sources', (SELECT nb_sources FROM s),
      'nb_sources_echec', (SELECT nb_sources_echec FROM s),
      'sujets', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.ordre_rubrique, t.ordre) FROM (
        SELECT rubrique, titre, resume, redige, extrait, source, ordre, ordre_rubrique, rang
        FROM j WHERE rang <= 3) t), '[]'::jsonb)
    ) END
$function$
;

CREATE OR REPLACE FUNCTION public.grant_admin_if_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF lower(NEW.email) = 'gabriel.roulon@gmail.com' AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$function$
;

CREATE OR REPLACE FUNCTION public.lancer_demande(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE derniere timestamptz; nb int;
BEGIN
  IF EXISTS (SELECT 1 FROM demandes WHERE statut IN ('en_attente', 'prise')) THEN
    RETURN jsonb_build_object('ok', false, 'motif', 'Une demande est déjà en attente ou en cours.');
  END IF;
  SELECT max(created_at) INTO derniere FROM demandes;
  IF derniere > now() - interval '15 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'motif', 'Patientez 15 minutes entre deux demandes.');
  END IF;
  SELECT count(*) INTO nb FROM demandes WHERE (created_at AT TIME ZONE 'Europe/Paris')::date = (now() AT TIME ZONE 'Europe/Paris')::date;
  IF nb >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'motif', 'Plafond de 5 demandes par jour atteint (quota du modèle).');
  END IF;
  INSERT INTO demandes (demandeur, statut) VALUES (p_user, 'en_attente');
  RETURN jsonb_build_object('ok', true);
END $function$
;

CREATE OR REPLACE FUNCTION public.maintenance_executer(p_force boolean, p_auteur uuid, p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE dernier timestamptz; n_dem int; n_jou int; n_act int; n_lec int; n_syn int; n_cpt int; n_net int; res jsonb;
BEGIN
  SELECT nullif(valeur->>'le', '')::timestamptz INTO dernier FROM parametres WHERE cle = 'maintenance';
  IF NOT p_force AND dernier IS NOT NULL AND dernier > now() - interval '24 hours' THEN RETURN jsonb_build_object('fait', false, 'dernier', dernier); END IF;
  DELETE FROM demandes WHERE statut IN ('terminee', 'echec') AND created_at < now() - interval '90 days'; GET DIAGNOSTICS n_dem = ROW_COUNT;
  DELETE FROM admin_journal WHERE cree_le < now() - interval '12 months' AND action <> 'Purger le journal'; GET DIAGNOSTICS n_jou = ROW_COUNT;
  DELETE FROM actions_sources WHERE statut IN ('appliquee', 'refusee', 'annulee') AND cree_le < now() - interval '12 months'; GET DIAGNOSTICS n_act = ROW_COUNT;
  DELETE FROM lectures WHERE lu_le < now() - interval '90 days'; GET DIAGNOSTICS n_lec = ROW_COUNT;
  DELETE FROM syntheses WHERE date_veille < (now() AT TIME ZONE 'Europe/Paris')::date - interval '12 months'; GET DIAGNOSTICS n_syn = ROW_COUNT;
  DELETE FROM auth.users u WHERE u.email_confirmed_at IS NULL AND u.created_at < now() - interval '30 days'
    AND NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role IN ('admin', 'veilleur')); GET DIAGNOSTICS n_cpt = ROW_COUNT;
  DELETE FROM nettoyages_salons WHERE statut IN ('terminee', 'echec') AND cree_le < now() - interval '90 days'; GET DIAGNOSTICS n_net = ROW_COUNT;
  res := jsonb_build_object('demandes', n_dem, 'journal', n_jou, 'actions_sources', n_act, 'lectures', n_lec, 'syntheses', n_syn, 'comptes_non_confirmes', n_cpt, 'nettoyages', n_net);
  UPDATE parametres SET valeur = jsonb_build_object('le', now(), 'resultat', res, 'par', coalesce(p_email, 'automatique')), maj_le = now(), maj_par = coalesce(p_email, 'automatique') WHERE cle = 'maintenance';
  INSERT INTO admin_journal (auteur, auteur_email, role, action, cible, detail, resultat) VALUES (p_auteur, coalesce(p_email, 'automatique'), CASE WHEN p_auteur IS NULL THEN 'systeme' ELSE 'admin' END, 'Maintenance des données', 'base', left(res::text, 300), 'ok');
  RETURN jsonb_build_object('fait', true, 'resultat', res);
END $function$
;

CREATE OR REPLACE FUNCTION public.noter_consentement()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.canal IS DISTINCT FROM OLD.canal OR NEW.rubriques IS DISTINCT FROM OLD.rubriques THEN
    NEW.consentement_le := now();
  END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.prendre_action_source()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r actions_sources%ROWTYPE;
BEGIN
  UPDATE actions_sources SET statut = 'refusee', traite_le = now(), detail = 'Délai dépassé : aucune fin signalée en 30 min'
    WHERE statut = 'prise' AND pris_le < now() - interval '30 minutes';
  DELETE FROM actions_sources WHERE statut IN ('appliquee', 'refusee', 'annulee') AND cree_le < now() - interval '12 months';
  IF EXISTS (SELECT 1 FROM actions_sources WHERE statut = 'prise') THEN RETURN jsonb_build_object('action', null); END IF;
  UPDATE actions_sources SET statut = 'prise', pris_le = now()
    WHERE id = (SELECT id FROM actions_sources WHERE statut = 'en_attente' ORDER BY cree_le LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING * INTO r;
  IF r.id IS NULL THEN RETURN jsonb_build_object('action', null); END IF;
  RETURN jsonb_build_object('action', jsonb_build_object('id', r.id, 'action', r.action, 'nom', r.nom, 'url', coalesce(r.url, ''),
    'categorie', coalesce(r.categorie, ''), 'priorite', coalesce(r.priorite, ''), 'motif', r.motif, 'auteur_email', coalesce(r.auteur_email, ''),
    'cree_le', to_char(r.cree_le AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY HH24:MI:SS')));
END $function$
;

CREATE OR REPLACE FUNCTION public.prendre_demande()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  UPDATE chaine_etat SET dernier_appel = now() WHERE id = 1;
  BEGIN
    PERFORM maintenance_executer(false, NULL, NULL);
  EXCEPTION WHEN others THEN
    UPDATE parametres SET valeur = jsonb_build_object('le', now(), 'erreur', left(SQLERRM, 200), 'par', 'automatique') WHERE cle = 'maintenance';
  END;
  UPDATE demandes SET statut = 'echec', termine_le = now(), detail = 'Expirée : n8n n''a pas pris la demande en 2 h (serveur n8n injoignable ?)' WHERE statut = 'en_attente' AND created_at < now() - interval '2 hours';
  UPDATE demandes SET statut = 'echec', termine_le = now(), detail = 'Délai dépassé : aucune fin signalée en 30 min' WHERE statut = 'prise' AND pris_le < now() - interval '30 minutes';
  IF EXISTS (SELECT 1 FROM demandes WHERE statut = 'prise') THEN RETURN jsonb_build_object('demande', null, 'motif', 'une demande est déjà en cours'); END IF;
  UPDATE demandes SET statut = 'prise', pris_le = now(), sujets_avant = (SELECT nb_sujets FROM syntheses WHERE date_veille = (now() AT TIME ZONE 'Europe/Paris')::date)
    WHERE id = (SELECT id FROM demandes WHERE statut = 'en_attente' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id INTO r;
  IF r.id IS NULL THEN RETURN jsonb_build_object('demande', null); END IF;
  RETURN jsonb_build_object('demande', jsonb_build_object('id', r.id));
END $function$
;

CREATE OR REPLACE FUNCTION public.prendre_nettoyage()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r nettoyages_salons%ROWTYPE; s text;
BEGIN
  UPDATE nettoyages_salons SET statut = 'echec', termine_le = now(), detail = 'Délai dépassé : aucune fin signalée en 30 min' WHERE statut = 'prise' AND pris_le < now() - interval '30 minutes';
  IF EXISTS (SELECT 1 FROM nettoyages_salons WHERE statut = 'prise') THEN RETURN jsonb_build_object('nettoyage', null); END IF;
  FOREACH s IN ARRAY ARRAY['alertes', 'assistant'] LOOP
    IF NOT EXISTS (SELECT 1 FROM nettoyages_salons WHERE salon = s AND mode = 'auto' AND cree_le > now() - interval '24 hours')
       AND NOT EXISTS (SELECT 1 FROM nettoyages_salons WHERE salon = s AND statut = 'en_attente') THEN
      INSERT INTO nettoyages_salons (salon, portee, mode, auteur_email) VALUES (s, '30j', 'auto', 'automatique');
    END IF;
  END LOOP;
  UPDATE nettoyages_salons SET statut = 'prise', pris_le = now()
    WHERE id = (SELECT id FROM nettoyages_salons WHERE statut = 'en_attente' ORDER BY (mode = 'auto'), cree_le LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING * INTO r;
  IF r.id IS NULL THEN RETURN jsonb_build_object('nettoyage', null); END IF;
  RETURN jsonb_build_object('nettoyage', jsonb_build_object('id', r.id, 'salon', r.salon, 'portee', r.portee,
    'avant_ms', (extract(epoch FROM CASE WHEN r.portee = '30j' THEN now() - interval '30 days' ELSE now() END) * 1000)::bigint));
END $function$
;

CREATE OR REPLACE FUNCTION public.publier_sources(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  IF jsonb_typeof(p) <> 'array' OR jsonb_array_length(p) = 0 THEN RETURN jsonb_build_object('ok', false, 'motif', 'liste vide refusée'); END IF;
  INSERT INTO sources_miroir (nom, url, categorie, priorite, active, statut_sante, jours_echec, nb_articles, sante_le, maj_le)
  SELECT left(x->>'nom', 200), left(x->>'url', 500), left(x->>'categorie', 50), nullif(x->>'priorite', '')::int,
         coalesce((x->>'active')::boolean, true), left(x->>'statut_sante', 20), nullif(x->>'jours_echec', '')::int,
         nullif(x->>'nb_articles', '')::int, nullif(x->>'sante_le', '')::date, now()
  FROM jsonb_array_elements(p) x WHERE coalesce(x->>'nom', '') <> ''
  ON CONFLICT (nom) DO UPDATE SET url = EXCLUDED.url, categorie = EXCLUDED.categorie, priorite = EXCLUDED.priorite, active = EXCLUDED.active,
    statut_sante = EXCLUDED.statut_sante, jours_echec = EXCLUDED.jours_echec, nb_articles = EXCLUDED.nb_articles, sante_le = EXCLUDED.sante_le, maj_le = now();
  DELETE FROM sources_miroir WHERE nom NOT IN (SELECT x->>'nom' FROM jsonb_array_elements(p) x);
  SELECT count(*) INTO n FROM sources_miroir;
  UPDATE parametres SET valeur = to_jsonb(now()), maj_le = now(), maj_par = 'n8n' WHERE cle = 'sources_maj';
  RETURN jsonb_build_object('ok', true, 'sources', n);
END $function$
;

CREATE OR REPLACE FUNCTION public.publier_synthese(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
END $function$
;

CREATE OR REPLACE FUNCTION public.purger_journal(p_jours integer, p_auteur uuid, p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  IF p_jours IS NULL OR p_jours < 90 THEN RETURN jsonb_build_object('ok', false, 'motif', 'au moins 90 jours'); END IF;
  DELETE FROM admin_journal WHERE cree_le < now() - make_interval(days => p_jours) AND action <> 'Purger le journal';
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO admin_journal (auteur, auteur_email, role, action, cible, detail, resultat) VALUES (p_auteur, p_email, 'admin', 'Purger le journal', 'journal', n || ' ligne(s) de plus de ' || p_jours || ' jours effacée(s)', 'ok');
  RETURN jsonb_build_object('ok', true, 'supprimees', n);
END $function$
;

CREATE OR REPLACE FUNCTION public.purger_lectures()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM lectures WHERE user_id = NEW.user_id AND lu_le < now() - interval '90 days';
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.terminer_action_source(p_id uuid, p_statut text, p_detail text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_statut NOT IN ('appliquee', 'refusee') THEN RETURN jsonb_build_object('ok', false, 'motif', 'statut invalide'); END IF;
  UPDATE actions_sources SET statut = p_statut, traite_le = now(), detail = nullif(left(coalesce(p_detail, ''), 300), '')
    WHERE id = p_id AND statut = 'prise';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'motif', 'action inconnue ou déjà close'); END IF;
  RETURN jsonb_build_object('ok', true);
END $function$
;

CREATE OR REPLACE FUNCTION public.terminer_demande(p_id uuid, p_erreur text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE dm demandes%ROWTYPE; sy syntheses%ROWTYPE; ajout int; err text := nullif(left(coalesce(p_erreur, ''), 300), '');
BEGIN
  SELECT * INTO dm FROM demandes WHERE id = p_id AND statut = 'prise' FOR UPDATE;
  IF dm.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'motif', 'demande inconnue ou déjà close'); END IF;
  SELECT * INTO sy FROM syntheses WHERE date_veille = (now() AT TIME ZONE 'Europe/Paris')::date;
  IF sy.id IS NOT NULL AND sy.statut = 'envoyee' AND sy.envoye_le >= dm.pris_le THEN
    ajout := coalesce(sy.nb_sujets, 0) - coalesce(dm.sujets_avant, 0);
    UPDATE demandes SET statut = 'terminee', termine_le = now(),
      detail = CASE WHEN ajout > 0 THEN '+' || ajout || ' sujet' || CASE WHEN ajout > 1 THEN 's' ELSE '' END || ' ajouté' || CASE WHEN ajout > 1 THEN 's' ELSE '' END
                    ELSE 'Aucun article nouveau depuis la dernière veille' END
               || CASE WHEN err IS NOT NULL THEN ' | alerte n8n : ' || err ELSE '' END
      WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'statut', 'terminee');
  END IF;
  UPDATE demandes SET statut = 'echec', termine_le = now(),
    detail = coalesce(err, 'Aucune synthèse republiée depuis la prise en charge') WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'statut', 'echec');
END $function$
;

CREATE OR REPLACE FUNCTION public.terminer_nettoyage(p_id uuid, p_ok boolean, p_supprimes integer, p_reste boolean, p_detail text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE nettoyages_salons SET supprimes = supprimes + greatest(coalesce(p_supprimes, 0), 0),
      statut = CASE WHEN NOT p_ok THEN 'echec' WHEN p_reste THEN 'en_attente' ELSE 'terminee' END,
      termine_le = CASE WHEN NOT p_ok OR NOT p_reste THEN now() ELSE NULL END,
      pris_le = CASE WHEN p_ok AND p_reste THEN NULL ELSE pris_le END,
      detail = nullif(left(coalesce(p_detail, ''), 300), '')
    WHERE id = p_id AND statut = 'prise';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'motif', 'nettoyage inconnu ou déjà clos'); END IF;
  RETURN jsonb_build_object('ok', true);
END $function$
;

CREATE TRIGGER lectures_purge BEFORE INSERT ON public.lectures FOR EACH ROW EXECUTE FUNCTION purger_lectures();

CREATE TRIGGER on_auth_user_admin_ins AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION grant_admin_if_confirmed();

CREATE TRIGGER on_auth_user_admin_upd AFTER UPDATE OF email_confirmed_at, email ON auth.users FOR EACH ROW EXECUTE FUNCTION grant_admin_if_confirmed();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER profiles_consentement BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION noter_consentement();

GRANT EXECUTE ON FUNCTION public.apercu_public TO anon;

GRANT EXECUTE ON FUNCTION public.apercu_public TO authenticated;

GRANT EXECUTE ON FUNCTION public.apercu_public TO service_role;

GRANT EXECUTE ON FUNCTION public.grant_admin_if_confirmed TO anon;

GRANT EXECUTE ON FUNCTION public.grant_admin_if_confirmed TO authenticated;

GRANT EXECUTE ON FUNCTION public.grant_admin_if_confirmed TO service_role;

GRANT EXECUTE ON FUNCTION public.handle_new_user TO anon;

GRANT EXECUTE ON FUNCTION public.handle_new_user TO authenticated;

GRANT EXECUTE ON FUNCTION public.handle_new_user TO service_role;

GRANT EXECUTE ON FUNCTION public.has_role TO anon;

GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;

GRANT EXECUTE ON FUNCTION public.has_role TO service_role;

GRANT EXECUTE ON FUNCTION public.lancer_demande TO service_role;

GRANT EXECUTE ON FUNCTION public.maintenance_executer TO service_role;

GRANT EXECUTE ON FUNCTION public.noter_consentement TO anon;

GRANT EXECUTE ON FUNCTION public.noter_consentement TO authenticated;

GRANT EXECUTE ON FUNCTION public.noter_consentement TO service_role;

GRANT EXECUTE ON FUNCTION public.prendre_action_source TO service_role;

GRANT EXECUTE ON FUNCTION public.prendre_demande TO service_role;

GRANT EXECUTE ON FUNCTION public.prendre_nettoyage TO service_role;

GRANT EXECUTE ON FUNCTION public.publier_sources TO service_role;

GRANT EXECUTE ON FUNCTION public.publier_synthese TO service_role;

GRANT EXECUTE ON FUNCTION public.purger_journal TO service_role;

GRANT EXECUTE ON FUNCTION public.purger_lectures TO anon;

GRANT EXECUTE ON FUNCTION public.purger_lectures TO authenticated;

GRANT EXECUTE ON FUNCTION public.purger_lectures TO service_role;

GRANT EXECUTE ON FUNCTION public.terminer_action_source TO service_role;

GRANT EXECUTE ON FUNCTION public.terminer_demande TO service_role;

GRANT EXECUTE ON FUNCTION public.terminer_nettoyage TO service_role;
