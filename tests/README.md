# Tests

Aucune dépendance, aucun installeur : du Node pur. Depuis la racine du dépôt :

```bash
node tests/cours-api.test.mjs .      # api/cours.js : liens, JSON, repli de modèle, dictées, normalisation
node tests/cours-rendu.test.mjs .    # cours.js : chaque écran rendu avec un DOM et une base simulés
node tests/espaces.test.mjs .        # app.js : découpage Grand Été / Tuteur, navigation, en-tête
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
- un raccourci de la checklist navigue sans cocher la case à la place de l’enfant.
