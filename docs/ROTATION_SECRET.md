# Changer le secret de publication (MNT-08, D-AUD-09)

Le secret `x-publication-secret` protège les adresses `/api/public/*` que n8n appelle. Il existe à deux endroits qui doivent toujours être identiques : le secret `PUBLICATION_SECRET` du projet Lovable, et 9 nœuds n8n. Personne d'autre que le propriétaire ne le manipule ; il n'est jamais écrit dans un fichier ni dans une conversation.

## Quand le changer
- Soupçon de fuite (capture d'écran, copie dans un message, export de workflow avec le secret collé).
- Départ d'une personne qui y avait accès.
- Sinon, une fois par an.

## Moment
Après 14 h 20, une fois les publications du jour terminées ; jamais entre 6 h et 14 h 20 (veille du matin). Entre les deux étapes, n8n reçoit des refus (401) : la file des demandes et le miroir des sources sont en pause, la veille du lendemain n'est pas touchée.

## Étapes
1. Générer une nouvelle valeur longue et aléatoire (au moins 32 caractères), par exemple avec un gestionnaire de mots de passe.
2. Lovable, projet Le Fil IA : remplacer la valeur du secret `PUBLICATION_SECRET` (secrets du projet Lovable Cloud, là où il a été saisi la première fois).
3. n8n : coller la même valeur dans l'en-tête `x-publication-secret` de chacun de ces nœuds, puis republier chaque workflow :

| Workflow | Nœuds |
|---|---|
| Fil_IA_Veille_Demandes_v4 | Prendre une demande, Signaler la fin, Prendre une action source, Signaler l'action, Prendre un nettoyage, Signaler le nettoyage |
| Fil_IA_Veille_Miroir_Sources_v1 | Publier vers l'app |
| Fil_IA_Veille_Publication_v5 | Publier vers l'app, Lister abonnés |

4. Vérifier : console admin, Vue d'ensemble, « n8n : En ligne » dans les 2 minutes ; lancer Miroir_Sources à la main (doit passer au vert).
5. Noter la date du changement dans LOG.md (jamais la valeur).

## Si une étape échoue
Un 401 dans n8n après le changement signifie qu'un nœud a encore l'ancienne valeur : reprendre la liste ci-dessus. Le site lui-même n'est jamais bloqué par cette opération.
