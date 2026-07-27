# Adalix Knowledge — Le Grand Été

Appli web des enfants pour le programme d'été (4 semaines) : programme du jour, quiz notés, galerie des 100 personnalités, checklist quotidienne, chat, atelier d'images, dashboard parent.

En ligne : https://adalix-knowledge.vercel.app

## Structure

```
index.html        page unique de l'appli (shell + styles)
app.js             toute la logique cliente (Supabase, quiz, checklist, chat, dashboard...)
data.js            contenu du programme : semaines, quiz, 100 personnalités, checklist
api/chat.js        fonction serverless Vercel — proxy vers l'API Anthropic (Claude)
api/image.js       fonction serverless Vercel — proxy vers l'API Runware (génération d'images)
```

Pas de build : c'est du HTML/JS statique + deux fonctions serverless Node. Vercel déploie ce dossier tel quel.

## Déploiement (Vercel)

1. Pousser ce dossier sur GitHub (repo `spacieba/Adalix-knowledge`).
2. Connecter le repo à Vercel (projet `adalix-knowledge`, équipe `spaciebas-projects`) — déjà fait, redeploy automatique à chaque push.
3. Variables d'environnement à définir dans Vercel → Settings → Environment Variables :
   - `ANTHROPIC_API_KEY` — clé API Anthropic pour activer la boîte de dialogue (optionnel, l'appli fonctionne sans, avec un message d'attente pour les enfants)
   - `ANTHROPIC_MODEL` — optionnel, ex. `claude-haiku-4-5` pour un coût minimal (par défaut `claude-sonnet-4-5`)
   - `RUNWARE_API_KEY` — clé API Runware pour activer l'atelier d'images (optionnel)
   - `RUNWARE_MODEL` — optionnel (par défaut `bytedance:5@0`)

Après ajout/modif d'une variable : redeploy manuel depuis Vercel (Deployments → ⋯ → Redeploy).

## Supabase

Projet : `qntpdaakdqaysxbeugxk` (`https://qntpdaakdqaysxbeugxk.supabase.co`)
Tables (préfixe `adalix_`) : `adalix_personalities`, `adalix_qcm_scores`, `adalix_checklist`, `adalix_journal`, `adalix_chat`.
Clé publique déjà en dur dans `app.js` (`SUPA_URL` / `SUPA_KEY`) — c'est la clé publique anonyme, normal qu'elle soit visible côté client, les policies RLS limitent ce qui est possible.

## Sécurité

Le fichier `tokens adalix_knowledge.txt` dans ce dossier contient des clés en clair (Runware, Supabase, Vercel) — à ne jamais pousser sur un repo public. Si ce dossier est versionné avec git, pense à l'ajouter au `.gitignore` ou à le supprimer une fois les clés bien enregistrées ailleurs (gestionnaire de mots de passe).
