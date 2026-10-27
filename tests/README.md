# Tests

Aucune dépendance, aucun installeur : du Node pur. Depuis la racine du dépôt :

```bash
node tests/cours-api.test.mjs .      # api/cours.js : liens, JSON, repli de modèle, dictées, normalisation
node tests/cours-rendu.test.mjs .    # cours.js : chaque écran rendu avec un DOM et une base simulés, appareil photo intégré
node tests/espaces.test.mjs .        # app.js : découpage Grand Été / Tuteur, navigation, en-tête, installation, « Interroge-moi », micro
node tests/lecture.test.mjs .        # lecture.js : syllabes, lecture guidée, carnet de mots, dictées
node tests/checklist.test.mjs .      # app.js : gestes de la journée, série 🔥 qui saute le week-end, les deux guides
```

Les scripts chargent les fichiers réellement servis (sans les modifier) et sortent en
code 1 au premier échec — utilisables tels quels dans un hook de pré-commit.

Ce qu'ils protègent en priorité :

- aucun écran ne plante, y compris sur les cas vides ;
- aucune bonne réponse n'est divulguée avant correction — ni dans un exercice, ni dans
  une carte de révision, ni dans une dictée, ni pendant l'étape « écris de mémoire » ;
- la correction automatique du téléphone reste désactivée partout où l'enfant écrit un
  mot évalué, sinon l'exercice s'écrit tout seul ;
- aucun lien externe n'est inventé ;
- aucun onglet ne devient inatteignable après une réorganisation de la navigation ;
- le découpage en syllabes ne perd jamais une lettre ;
- la série 🔥 ne se remet pas à zéro un samedi, et un seul calcul la produit partout ;
- un raccourci de la checklist navigue sans cocher la case à la place de l’enfant ;
- changer d’onglet ramène en haut de la nouvelle page ;
- l’appareil photo rend toujours le flux au système, et ne prend jamais d’image vide ;
- un rechargement subi remet l’enfant où il était, sans jamais court-circuiter l’écran
  des profils d’un vrai démarrage ni le code du parent ;
- aucun bouton proposé ne mène nulle part : la proposition d’installer l’app ne s’affiche
  pas si l’app est déjà installée, ni dans un navigateur qui ne sait pas l’installer — mais
  elle s’affiche partout où il y a un geste à faire, avec le geste de CE navigateur ;
- « Interroge-moi » ne propose aucun thème vide, ne mélange pas deux thèmes voisins
  (géographie / géopolitique, « Qui écrit l’histoire ? » / histoire de l’art), et n’arme
  jamais une révision sans contexte ;
- le micro n’apparaît que si le navigateur sait écouter, écoute en français, s’arrête au
  silence, complète la saisie au lieu de l’écraser, et n’envoie jamais tout seul.
