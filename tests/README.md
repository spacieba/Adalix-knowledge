# Tests

Aucune dépendance, aucun installeur : du Node pur. Depuis la racine du dépôt :

```bash
node tests/cours-api.test.mjs .      # api/cours.js : liens, JSON, repli de modèle, normalisation
node tests/cours-rendu.test.mjs .    # cours.js : chaque écran rendu avec un DOM et une base simulés
node tests/espaces.test.mjs .        # app.js : découpage Grand Été / Tuteur, navigation, en-tête
```

Les scripts chargent les fichiers réellement servis (sans les modifier) et sortent en
code 1 au premier échec — utilisables tels quels dans un hook de pré-commit.

Ce qu'ils protègent en priorité : qu'aucun écran ne plante, qu'aucune bonne réponse
ne soit divulguée avant correction, qu'aucun lien externe ne soit inventé, et qu'aucun
onglet ne devienne inatteignable après une réorganisation de la navigation.
