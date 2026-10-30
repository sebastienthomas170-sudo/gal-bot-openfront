# gal-bot-openfront

Diagnostic navigateur de l'accès aux salons publics OpenFront, sans connexion à un compte joueur.

## Pourquoi cette première étape ?

Les connexions directes depuis Netlify aux services de salons OpenFront ont répondu HTTP 403. Le projet GAL contient déjà un relais navigateur qui écoute l'événement public `public-lobbies-update`. Avant de construire un bot distant ou de le relier au site GAL, il faut vérifier qu'un navigateur automatisé distant peut recevoir ces données sans connexion de joueur.

## Lancer le diagnostic

1. Ouvrir l'onglet **Actions** de ce dépôt GitHub.
2. Choisir **Vérifier l'accès public OpenFront**.
3. Cliquer sur **Run workflow**.
4. Attendre la fin du test (environ une minute).
5. Ouvrir le résultat et télécharger l'artefact **diagnostic-openfront**.

Le test ouvre uniquement `https://openfront.io`, sans identifiant ni compte joueur. Il ne tente pas de contourner les protections du site. Il n'envoie aucune donnée au site GAL et ne modifie pas le site existant.

## Interprétation

- `public_lobby_event_received_without_player_login` : le navigateur a reçu l'événement contenant les salons publics sans connexion joueur. On pourra alors développer le collecteur.
- `lobby_websocket_frames_seen_but_event_not_confirmed` : des trames de WebSocket ont été vues, mais le format doit être étudié avant d'aller plus loin.
- `no_public_lobby_data_observed_without_player_login` : le navigateur distant n'a pas reçu de données publiques pendant le test. Ne pas construire le relais comme si cela fonctionnait.
- `openfront_page_not_reached` : le navigateur distant n'a pas réussi à ouvrir le site.

## Coût et sécurité

Le test est manuel : il ne tourne pas en continu. Il n'utilise aucun secret, aucun compte OpenFront, aucun téléphone et aucun serveur Netlify. Il ne touche pas au dépôt ni au site GAL en dehors de ce dépôt de diagnostic.
