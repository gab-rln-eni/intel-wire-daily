# Le Fil IA

Crée l'application web « Le Fil IA », en français : des synthèses de veille IA consultables sur le web, avec le choix de les recevoir par email ou sur Discord. La maquette (3 écrans) est décrite ci-dessous : respecte cette description.

1. ROUTES : exactement 3 pages.
- « / » Accueil, public : titre Le Fil IA, promesse « Chaque matin, une synthèse courte et sourcée de l'actualité de l'IA, sur le canal que vous utilisez déjà : votre boîte mail ou Discord. », boutons « Créer un compte » et « Se connecter », aperçu des 3 premiers sujets de la dernière synthèse envoyée, mention « Résumés générés par IA d'après l'extrait de chaque article ; chaque sujet renvoie à l'article d'origine. ».
- « /compte » Mon compte, connecté : dernière synthèse envoyée complète (titre « Synthèse du jour » seulement si elle est datée du jour) (cartes groupées par rubrique dans l'ordre des rubriques), historique des synthèses envoyées (les jours sans synthèse ou en échec n'apparaissent pas), bloc Réception (choix email ou Discord ; si Discord, champ URL de webhook qui doit commencer par https://discord.com/api/webhooks/), bloc Rubriques suivies (6 cases), bloc Mes données avec « Supprimer mon compte » (confirmation, suppression réelle du compte et du profil).
- « /admin » Admin, rôle admin seulement (sinon redirection vers l'accueil) : compteurs (abonnés, dernière synthèse, sources lues, sujets du jour), journal des synthèses (date, statut, sources lues sur total, articles analysés, sujets retenus, résumés complets ou partiels), bouton « Lancer une veille » qui insère une demande (statut en attente) avec la note « Demande enregistrée ; prise en charge par la chaîne en bonus. », tableau des demandes, tableau des abonnés (email masqué, canal, nombre de rubriques, date d'inscription), lien « Gérer les sources ↗ » vers https://docs.google.com/forms/d/e/1FAIpQLSfXm_fq5V8gyo35l-rn-6AsE8wa4LGSR7WADUjRV0DR4TDZ1w/viewform (nouvel onglet), visible sur cette page seulement.
- Toute autre adresse redirige vers « / ».
- Connexion : fenêtre modale (pas de page dédiée), « Continuer avec Google » et email avec mot de passe, lien « Créer un compte ».
- En-tête commun : logo texte « Le Fil IA », liens Accueil, Mon compte (connecté), Admin (admin seulement), menu du compte.

2. AUTHENTIFICATION ET RÔLES : connexion Google et email ; confirmation de l'email obligatoire pour les inscriptions par mot de passe (confirmation automatique désactivée). Table user_roles séparée (user_id, role parmi admin et user), jamais modifiable par l'utilisateur ; fonction has_role(user_id, role) en security definer pour les contrôles ; le compte gabriel.roulon@gmail.com reçoit le rôle admin par un déclencheur côté base, seulement si son email est confirmé (email_confirmed_at non nul, à l'insertion ou à la mise à jour). Aucune colonne de rôle dans les profils. Clés vers les utilisateurs : profiles et user_roles en ON DELETE CASCADE, demandes.demandeur en ON DELETE SET NULL.

3. TABLES (avec RLS sur toutes) :
- profiles : id (= utilisateur), email, canal ('email' ou 'discord', défaut 'email'), discord_webhook_url, rubriques (tableau de texte, défaut les 6), created_at. Chacun lit et modifie seulement sa ligne, sans pouvoir changer son email ; l'admin lit tout. Contrainte en base : discord_webhook_url vide ou commençant par https://discord.com/api/webhooks/.
- syntheses : id, date_veille (date, unique), statut ('envoyee', 'en_cours', 'echec'), nb_sources, nb_sources_echec, nb_articles, nb_sujets (compteurs pouvant être vides), degrade (booléen), exemple (booléen, défaut faux), envoye_le (horodatage, vide possible), created_at, updated_at. Sources lues = nb_sources moins nb_sources_echec. Lecture : connectés pour les synthèses envoyées ; l'admin lit tout. Aucune règle RLS pour les visiteurs non connectés.
- sujets : id, synthese_id (cascade), ordre, ordre_rubrique, rubrique, titre, resume, redige (booléen), extrait, source, lien, publie_le. Mêmes règles de lecture que leur synthèse.
- Accueil public : il lit une fonction SQL apercu_public() en security definer (search_path fixé, exécutable par anon), qui renvoie la dernière synthèse de statut envoyee et ses 3 premiers sujets triés par ordre_rubrique puis ordre.
- demandes : id, created_at, demandeur (utilisateur), statut ('en_attente', 'prise', 'terminee'). Admin seulement.
Rubriques, dans cet ordre : Réglementation et gouvernance, Modèles et produits, Recherche, Usages en entreprise, France et Europe, Autres actualités.

4. FONCTION SERVEUR « publier-synthese » (appelée par une chaîne externe, jamais par l'interface ; verify_jwt = false) : POST JSON { synthese: {...}, sujets: [...] } ; autorisée seulement si l'en-tête x-publication-secret est égal au secret PUBLICATION_SECRET (à créer dans les secrets du projet), sinon 401.
- Champs de synthese reçus : date_veille, statut (ENVOYE, EN_COURS ou ECHEC, traduit en envoyee, en_cours, echec ; toute autre valeur donne 400), nb_sources, nb_sources_echec, nb_articles, nb_sujets, degrade, envoye_le. Champs de chaque sujet : n (devient ordre), rubrique, ordre_rubrique, titre, resume, extrait, redige, source, lien, publie_le. Les champs inconnus sont ignorés (aucun HTML stocké).
- Contrôles avant écriture : liens en http ou https seulement, longueurs bornées (titre 300, résumé 1000, extrait 500), sinon 400.
- L'écriture passe par une fonction SQL publier_synthese(p jsonb) en security invoker (REVOKE EXECUTE FROM PUBLIC, anon, authenticated ; GRANT EXECUTE TO service_role), en une seule transaction : si la synthèse de même date_veille a déjà des sujets et que la liste reçue est absente, nulle ou vide, rien n'est modifié et la réponse est 409 ; sinon upsert de la synthèse par date_veille avec exemple = faux, puis remplacement de ses sujets seulement si le statut reçu est envoyee. Réponse JSON { ok, date_veille, nb_sujets }.
Ajoute une fonction « lister-abonnes » (verify_jwt = false, même en-tête x-publication-secret, sinon 401, GET) : renvoie email, canal, discord_webhook_url et rubriques de chaque profil.
Ajoute aussi une fonction « supprimer-compte » : elle identifie l'utilisateur par son jeton puis appelle auth.admin.deleteUser.

5. DONNÉES D'EXEMPLE : insère une synthèse marquée exemple = vrai, datée du jour, statut envoyée, 19 sources lues sur 20, 143 articles analysés, 5 sujets d'exemple (un par rubrique sauf Autres actualités ; sources EU AI Act Newsletter, Mistral AI, Hugging Face, JDN IA, CNIL ; l'un avec redige = faux, resume vide et l'extrait affiché) ; nb_sources 20, nb_sources_echec 1, envoye_le à 07:05. Les cartes d'une synthèse exemple portent un badge discret « Exemple ».

6. STYLE : sobre et technique, tableau de bord sombre (fond #0D1117, cartes #161B22, bordures #30363D, texte #E6EDF3, texte secondaire #A9B4C0), une seule couleur d'accent turquoise #3DD6C4 (boutons, liens, étiquettes de rubrique), cartes par sujet (étiquette de rubrique, titre, résumé, « Source | Lire l'article ↗ »), lecture en 2 minutes ; sujet sans résumé (redige faux) : l'app affiche « Résumé indisponible. Extrait : » suivi du champ extrait ; la chaîne envoie alors resume vide. Aucun tiret long ni demi-cadratin dans les textes.

7. CONFORMITÉ (cadre indicatif, non validé juridiquement) :
- Accessibilité : viser WCAG 2.1 niveau AA (référence RGAA) : contrastes suffisants en thème sombre, navigation au clavier, focus visible, textes alternatifs, libellés de formulaires, hiérarchie de titres, attribut lang="fr".
- Pied de page commun : « Le Fil IA, projet de démonstration | Mentions légales | Confidentialité | Cookies » ; les trois textes s'ouvrent en fenêtres modales, aucune route en plus.
- Mentions légales : éditeur « Le Fil IA, projet de démonstration », contact : via le dépôt GitHub du projet (aucune adresse affichée) ; hébergeur : à compléter.
- Confidentialité : données traitées (email, identité du compte Google, canal choisi, URL de webhook Discord, rubriques) ; finalité : envoi et consultation de la synthèse ; conservation jusqu'à la suppression du compte ; droits d'accès, de rectification et de suppression ; suppression du compte depuis Mon compte.
- Cookies : uniquement ce qui est strictement nécessaire à la connexion, donc pas de bandeau ; aucune mesure d'audience ni traceur tiers.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/62bab409-eb01-4e3a-a183-be05f6e57e8f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
