# Adalix Knowledge — Le Grand Été

Appli web des enfants pour le programme d'été (4 semaines) : programme du jour, quiz notés, galerie des 100 personnalités, checklist quotidienne, chat, atelier d'images, dashboard parent.

En ligne : https://adalix-knowledge.vercel.app

## Structure

```
index.html        page unique de l'appli (shell + styles)
app.js             toute la logique cliente (Supabase, quiz, checklist, chat, dashboard...)
cours.js           module « Mes cours » : photo du cours → cours au propre, tuteur, exercices, révisions
lecture.js         lire et écrire : lecture guidée à voix haute, carnet de mots, dictées
data.js            contenu du programme : semaines, quiz, 100 personnalités, checklist
api/chat.js        fonction serverless Vercel — proxy vers l'API Anthropic (Claude)
api/image.js       fonction serverless Vercel — proxy vers l'API Runware (génération d'images)
api/cours.js       fonction serverless Vercel — module des cours (transcription, exercices, correction, interro)
manifest.json      installation sur l'écran d'accueil (PWA)
sw.js              service worker minimal, sans cache — ne sert qu'à rendre l'app installable
tests/             tests Node sans dépendance, 669 au total (voir tests/README.md)
```

Pas de build : c'est du HTML/JS statique + des fonctions serverless Node. Vercel déploie ce dossier tel quel.

## Déploiement (Vercel)

1. Pousser ce dossier sur GitHub (repo `spacieba/Adalix-knowledge`).
2. Connecter le repo à Vercel (projet `adalix-knowledge`, équipe `spaciebas-projects`) — déjà fait, redeploy automatique à chaque push.
3. Variables d'environnement à définir dans Vercel → Settings → Environment Variables :
   - `ANTHROPIC_API_KEY` — clé API Anthropic pour activer la boîte de dialogue (optionnel, l'appli fonctionne sans, avec un message d'attente pour les enfants)
   - `ANTHROPIC_MODEL` — optionnel, ex. `claude-haiku-4-5` pour un coût minimal (par défaut `claude-sonnet-4-5`)
   - `RUNWARE_API_KEY` — clé API Runware pour activer l'atelier d'images (optionnel)
   - `RUNWARE_MODEL` — optionnel (par défaut `bytedance:5@0`)
   - `FAMILY_CODE` — **recommandé** : sans lui, toutes les fonctions IA sont ouvertes à qui connaît l'URL, et chaque transcription de photo coûte. Les enfants le saisissent une fois par appareil (stocké en `localStorage`). Défini en type `encrypted` et non `sensitive`, donc relisible dans le dashboard Vercel si on l'oublie.
   - `ANTHROPIC_MODEL_COURS` — optionnel, modèle qui LIT les photos de cours (par défaut `claude-sonnet-5-5`)
   - `ANTHROPIC_MODEL_COURS_LEGER` — optionnel, modèle des exercices, corrections et interros (par défaut `claude-haiku-5-5`)

Après ajout/modif d'une variable : redeploy manuel depuis Vercel (Deployments → ⋯ → Redeploy).

## Supabase

Projet : `qntpdaakdqaysxbeugxk` (`https://qntpdaakdqaysxbeugxk.supabase.co`)
Tables (préfixe `adalix_`) : `adalix_personalities`, `adalix_qcm_scores`, `adalix_checklist`, `adalix_journal`, `adalix_chat`.
Module des cours : `adalix_cours`, `adalix_cours_notions`, `adalix_cours_revisions`, `adalix_cours_photos` (déjà créées).
Clé publique déjà en dur dans `app.js` (`SUPA_URL` / `SUPA_KEY`) — c'est la clé publique anonyme, normal qu'elle soit visible côté client, les policies RLS limitent ce qui est possible.

## Sécurité

Le fichier `tokens adalix_knowledge.txt` dans ce dossier contient des clés en clair (Runware, Supabase, Vercel) — à ne jamais pousser sur un repo public. Si ce dossier est versionné avec git, pense à l'ajouter au `.gitignore` ou à le supprimer une fois les clés bien enregistrées ailleurs (gestionnaire de mots de passe).

## Les deux espaces

Quand Adam ou Alix choisit son profil, l'app ne montre plus une barre de onze onglets
mais deux cartes :

- **🌞 Le Grand Été** — le programme des 4 semaines, les quiz, les jeux géo, les 100
  personnalités, le projet du mois, la Fabrique, le guide, et l'orientation pour Adam.
- **🎓 Tuteur** — l'année scolaire : Mes cours, Mes mots, la journée, l'assistant et son
  propre guide.

Un onglet n'appartient qu'à un seul espace, sinon les deux barres redeviennent identiques.
Le bouton 🏠 de l'en-tête ramène aux deux cartes depuis n'importe où, et l'en-tête rappelle
en permanence l'espace courant (« 🦊 Alix · 🎓 Tuteur »). Tout se règle dans `ESPACES`
(app.js) : une liste d'onglets par espace, dérivée de l'enfant. `tests/espaces.test.mjs`
vérifie qu'aucun onglet n'est en double, perdu, ou absent de la table de routage.

Changer d'onglet remonte en haut de la page (`hautDePage`). Sans ça le navigateur garde la
position de défilement de l'onglet précédent : on ouvrait « Ma journée » au milieu de la
liste, titre et compteur hors de l'écran. Défaut invisible aux tests sur DOM simulé, trouvé
en regardant l'app tourner dans Chrome le 26/10/2026.

Chaque espace a son guide, et c'est pour ça qu'il y a deux onglets : `guide`
(`renderGuide`) raconte Le Grand Été, `aide` (`renderAide`) raconte le Tuteur. Un guide
unique mélangeait un programme daté et un outil d'année scolaire, et obligeait à mettre
le même onglet dans les deux barres. Les deux s'ouvrent sur la même carte « Les deux
espaces » (`gcardEspaces`) : sans elle, on peut vivre dans un espace sans soupçonner
l'autre.

## La journée (checklist)

Les 13 gestes de `D.checklist` (data.js) cadrent une **journée d'école** : le matin,
l'après-école (devoirs, notions à revoir, photo du cours du jour, lecture, mots du
carnet), puis le soir (maison, cartable, écriture du soir). Un geste peut porter un
champ `tab` : une ligne affiche alors un chevron `›` qui ouvre l'outil concerné **sans
cocher la case** — le clic sur la ligne coche, le chevron navigue, et
`event.stopPropagation()` sépare les deux. (Un geste qui navigue au lieu de cocher a
déjà trompé un enfant une fois : il croyait avoir validé et retrouvait la case vide.)

L'onglet ne s'affiche que du lundi au vendredi (`estJourEcole`) ; le week-end il propose
le repos. La série 🔥 est alors **en pause, pas remise à zéro** : `calculeSerie` saute
les samedis et dimanches, et une journée compte dès `CHK_SEUIL` gestes — les trois
quarts de la liste, dérivés de data.js. Avant, le seuil était le nombre `10` écrit en
dur dans **trois** calculs de série différents (en-tête, badges, tableau de bord
parent), qui pouvaient donc afficher trois valeurs ; il n'en reste qu'un,
`calculeSerie`, et il est testé.

Limite connue : les **vacances scolaires** ne sont pas distinguées — un mardi de
vacances affiche la liste d'école. Il faudrait un calendrier des vacances pour faire
mieux, et ça n'en vaut probablement pas le prix.

## L'appareil photo, et pourquoi il est dans la page

`openAjoutCours` proposait un `<input type="file" capture="environment">` : le bouton
passait la main à l'application Appareil photo du système. **Sur l'Android de la maison,
Android détruisait l'onglet Chrome à chaque fois** — mémoire réclamée pendant que la
caméra tournait. Au retour la page se rechargeait de zéro : écran des profils, photo
perdue, et le geste central du module était donc inutilisable.

`ouvrirCamera()` (cours.js) ouvre maintenant la caméra **dans la page** via
`getUserMedia` : un `<video playsinline>` plein écran, un déclencheur, un compteur. La
page ne passe jamais en arrière-plan, donc le système ne peut rien reprendre, et on
enchaîne les pages d'un cours sans aller-retour. Une prise dessine la vidéo dans un
canvas et passe par `coursPousseImage()`, partagé avec le fichier choisi — mêmes deux
tailles (1500px q0.82 pour le serveur, 1000px q0.68 pour l'archive et l'aperçu).

Après une prise, **seul le compteur est redessiné** : refaire tout l'écran détruirait la
balise vidéo et redémarrerait la caméra, avec un clignotement à chaque page.

Replis, dans l'ordre : pas de `getUserMedia` (vieux navigateur, pas de caméra) ou
autorisation refusée → on clique l'ancien `<input capture>`, qui reste dans le DOM
exprès. Il marche quand le téléphone a de la mémoire, et c'est mieux que rien.

## Retrouver sa place après un rechargement subi

Au démarrage l'app montre toujours « Qui es-tu ? », exprès : le même appareil sert aux
deux enfants. Mais une page peut se recharger sans qu'on l'ait demandé. `SES` (app.js)
range l'enfant, l'espace et l'onglet dans `sessionStorage`, qui a exactement la bonne
durée de vie : il survit au rechargement du **même onglet** et disparaît à la fermeture.
Un vrai démarrage redemande donc bien qui on est.

Trois garde-fous : le **parent** n'est jamais restauré (il est protégé par un code), un
**visiteur** non plus (il doit donner son nom), et **« changer » efface la session**
(`logout`) — sinon le rechargement qui suit restaurerait le profil qu'on vient de
quitter, et le bouton ne changerait rien.

La reprise passe l'onglet voulu à `enterEspace(k, tabVoulu)` pour n'avoir **qu'un seul
rendu**. Ouvrir l'onglet par défaut puis le bon lançait deux rendus asynchrones en
course : le plus lent gagnait, et on voyait « Checklist » surligné au-dessus du contenu
de « Mes cours ». Vu dans Chrome, invisible aux tests avant qu'ils ne comptent les
rendus.

## Le code famille, et le poids des envois

Les six fonctions serveur comparent le code **après `trim().toLowerCase()` des deux
côtés**. Il est tapé par un enfant sur un clavier de téléphone, qui ajoute volontiers une
majuscule au premier caractère ou un espace à la fin : un code juste à la casse près doit
passer. On ne protège pas un compte en banque, on empêche un inconnu de dépenser des
crédits IA. Le champ de saisie coupe `autocapitalize`, `autocorrect`, `autocomplete` et
`spellcheck` — la règle valait déjà partout où un enfant tape un mot évalué, ce champ-là
avait été oublié.

Un refus le dit maintenant explicitement, et `apresCode` **rejoue le geste** dès que le
code est accepté. Avant, l'enfant saisissait le code, rien ne se passait, et il devait
deviner qu'il fallait refaire sa demande — c'est exactement ce qui est arrivé au premier
vrai essai.

Vercel refuse un corps de requête au-delà d'environ **4,5 Mo** et répond alors un 413 en
texte brut, que `r.json()` ne sait pas lire. `callCours` tolère donc une réponse non-JSON
et l'explique, et `photosAEnvoyer()` bascule sur les versions d'archive (1000px) quand les
grandes dépassent le seuil — un cours un peu moins fin vaut mieux qu'un échec.

## Module « Mes cours »

L'enfant photographie son cours (jusqu'à 5 pages), l'app le transcrit au propre et le structure,
puis il peut réviser dessus. Onglet réservé à Adam et Alix — invisible pour les visiteurs.

**Ce que fait la transcription** — `api/cours.js`, mode `transcrire` : fidélité au cahier avant tout
(aucune connaissance ajoutée, les mots illisibles sont signalés), orthographe et abréviations corrigées,
structure rendue visible. Elle produit en plus un résumé, des points clés, le vocabulaire,
des cartes question/réponse et des pistes pour aller plus loin.

**Comment la photo entre dans l'app.** Sur téléphone ou tablette (`pointer: coarse`), le bouton
« Prendre une photo » déclenche l'appareil photo depuis la page : aucun transfert, une page par prise,
jusqu'à 5. Sur ordinateur ce bouton n'existe pas — `capture` y est ignoré et ouvrirait l'explorateur de
fichiers — et l'écran propose à la place le glisser-déposer, le collage (Ctrl + V, pratique pour un
document de l'ENT) et le choix de fichier.

**Les trois façons de réviser**
- *Interroge-moi* : le tuteur pose une question à la fois, laisse une seconde chance avant de donner la réponse.
- *Exercices* : une fiche sur mesure (QCM + rédaction), corrigée sur le fond ; l'orthographe ne pénalise pas.
- *Révisions espacées* : chaque notion suit les boîtes de Leitner (1, 3, 7, 16 puis 35 jours). Réussie, elle
  revient plus tard ; ratée, elle repart au début. Ce mode ne consomme aucun appel API.

**Les liens « pour aller plus loin » ne sont jamais inventés.** L'IA choisit un site dans le catalogue
en tête de `api/cours.js` (Lumni, Vikidia, Nota Bene, Yvan Monka, Khan Academy, Arte, BnF…) et propose
une requête ; c'est le serveur qui fabrique l'URL. Pour ajouter un site, il suffit d'une ligne dans `SITES` :
il apparaît automatiquement dans le catalogue envoyé au modèle.

**Coût.** Seules la transcription, les exercices, la correction et l'interro appellent l'API. La transcription
est le poste principal (modèle solide + images) ; tout le reste tourne sur le modèle léger. Les deux sont
réglables par variable d'environnement, sans toucher au code. Si le modèle configuré n'est pas disponible
sur la clé, le serveur bascule tout seul sur `claude-sonnet-4-5` et l'écrit dans les logs Vercel.

**Les photos d'origine sont conservées** dans `adalix_cours_photos` (copie compressée, ~100 Ko) : elles
permettent de vérifier une transcription douteuse et de retrouver un schéma que le texte ne rend pas.

## Lire et écrire (lecture.js)

Trois outils, volontairement fondus dans le Tuteur sans étiquette : rien dans l'interface
ne désigne une difficulté, ce sont juste des outils disponibles.

**Lecture guidée** — bouton « 👓 Lire ce cours ». Le Markdown est retiré, le texte est lu
par la voix du téléphone (`speechSynthesis`, gratuite) et le mot en cours est surligné via
les évènements `onboundary`. Un mot se relit seul au clic. Réglages mémorisés par enfant et
par appareil : taille, espacement des lettres et des lignes, vitesse, syllabes colorées.
L'espacement est la seule adaptation typographique dont l'effet soit mesuré chez les lecteurs
en difficulté — davantage que les polices dites « spéciales ». Si la voix manque sur
l'appareil, l'écran le dit et le confort de lecture reste disponible.

**Carnet de mots** — onglet « ✏️ Mes mots ». Il se remplit **tout seul** : pendant la
transcription d'un cahier, le modèle remonte les mots mal orthographiés (`mots_a_revoir`),
qui arrivent au statut `propose`. L'enfant garde ou écarte — une écriture mal déchiffrée ne
doit jamais devenir une faute à réviser. Les mots validés passent dans les boîtes de Leitner
déjà utilisées par les cours, avec la routine regarde → cache → écris → vérifie. La
comparaison lettre à lettre (plus longue sous-séquence commune) met en couleur ce qui a
changé **sur l'orthographe juste**, jamais sur la faute : c'est le mot correct qu'il faut
photographier. Ce mode ne consomme aucun appel API.

**Dictées** — texte court bâti sur les mots de son carnet, lu à voix haute, avec deux
versions : `texte` (à écrire) et `a_dire` (ponctuation énoncée, « virgule », « point »).
La correction ne compte pas les fautes, elle les **classe** — phonétique, grammaticale,
visuelle — et donne la règle plutôt que la réponse. Les mots repris rejoignent le carnet.

Partout où l'enfant écrit un mot qui sera évalué, les champs portent
`spellcheck="false" autocorrect="off" autocomplete="off"` : sans ça le téléphone fait
l'exercice à sa place.

**Côté parent** : répartition des erreurs par nature, mots qui résistent, et un
**récapitulatif imprimable** (`openRecapOrtho`) avec exemples concrets et dates — le genre
d'observations qu'on demande en premier rendez-vous et dont on ne se souvient jamais sur le
moment. Le document dit explicitement qu'il ne constitue pas un bilan.

Tables : `adalix_mots` (contrainte d'unicité sur `child, mot`, donc pas de doublon) et
`adalix_dictees`.

## Installation sur l'écran d'accueil

`manifest.json` + `sw.js` rendent l'app installable : sur Android, Chrome propose « Installer » ;
sur iPhone, Partager → « Sur l'écran d'accueil ». Elle s'ouvre alors en plein écran, sans barre
d'adresse — l'effet d'un vrai programme, sans rien à installer ni à mettre à jour.
Le service worker ne met **rien** en cache, volontairement : une app scolaire qui sert une vieille
version depuis un cache est bien pire qu'une app qui exige le réseau.

Depuis le 26/10/2026, l'écran des deux espaces propose l'installation lui-même : il fallait
sinon aller la chercher dans le menu du navigateur, et personne n'y allait. Le navigateur
annonce qu'il sait installer en émettant `beforeinstallprompt` ; index.html le capte, empêche
sa bannière (qui tombe n'importe quand et qu'on ne contrôle pas) et le range dans
`window.__pwaPrompt`. `majInstall()` (app.js) remplit alors l'emplacement `#install-slot`
réservé dans `showEspaces` — et index.html rappelle `majInstall` à l'arrivée de l'événement,
qui peut survenir après le premier rendu.

Règle tenue : **jamais un bouton qui ne marche pas.** Rien ne s'affiche si l'app tourne déjà
installée (`display-mode: standalone`, ou `navigator.standalone` sur iOS), ni dans un
navigateur qui ne sait pas installer. Safari n'émet jamais l'événement : sur iPhone, le bouton
ouvre les deux gestes à faire à la main. Un `vercel dev`/local n'y change rien, l'installation
marche sur n'importe quelle origine `http(s)`.

Ce qui resterait à faire pour un **vrai exécutable** (.exe/.msi via Tauri, .apk) : rien n'est
commencé, et ça ne rendrait pas l'app autonome — `api/` doit rester côté serveur, la clé
Anthropic ne pouvant pas voyager dans un client. Le gain serait cosmétique et le coût réel
(mises à jour à distribuer, un emballage par plateforme).
