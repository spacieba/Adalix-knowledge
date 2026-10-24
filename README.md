# Adalix Knowledge — Le Grand Été

Appli web des enfants pour le programme d'été (4 semaines) : programme du jour, quiz notés, galerie des 100 personnalités, checklist quotidienne, chat, atelier d'images, dashboard parent.

En ligne : https://adalix-knowledge.vercel.app

## Structure

```
index.html        page unique de l'appli (shell + styles)
app.js             toute la logique cliente (Supabase, quiz, checklist, chat, dashboard...)
cours.js           module « Mes cours » : photo du cours → cours au propre, tuteur, exercices, révisions
data.js            contenu du programme : semaines, quiz, 100 personnalités, checklist
api/chat.js        fonction serverless Vercel — proxy vers l'API Anthropic (Claude)
api/image.js       fonction serverless Vercel — proxy vers l'API Runware (génération d'images)
api/cours.js       fonction serverless Vercel — module des cours (transcription, exercices, correction, interro)
manifest.json      installation sur l'écran d'accueil (PWA)
sw.js              service worker minimal, sans cache — ne sert qu'à rendre l'app installable
tests/             tests Node sans dépendance, 257 au total (voir tests/README.md)
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
- **🎓 Tuteur** — l'année scolaire : Mes cours, la checklist et l'assistant.

Un onglet n'appartient qu'à un seul espace, sinon les deux barres redeviennent identiques.
Le bouton 🏠 de l'en-tête ramène aux deux cartes depuis n'importe où, et l'en-tête rappelle
en permanence l'espace courant (« 🦊 Alix · 🎓 Tuteur »). Tout se règle dans `ESPACES`
(app.js) : une liste d'onglets par espace, dérivée de l'enfant. `tests/espaces.test.mjs`
vérifie qu'aucun onglet n'est en double, perdu, ou absent de la table de routage.

La checklist a déménagé dans Tuteur mais son contenu est resté celui de l'été
(`D.checklist` dans data.js) — à revoir si elle doit cadrer l'année scolaire.

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

## Installation sur l'écran d'accueil

`manifest.json` + `sw.js` rendent l'app installable : sur Android, Chrome propose « Installer » ;
sur iPhone, Partager → « Sur l'écran d'accueil ». Elle s'ouvre alors en plein écran, sans barre
d'adresse — l'effet d'un vrai programme, sans rien à installer ni à mettre à jour.
Le service worker ne met **rien** en cache, volontairement : une app scolaire qui sert une vieille
version depuis un cache est bien pire qu'une app qui exige le réseau.
