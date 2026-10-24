# Tests du module « Mes cours »

Aucune dépendance, aucun installeur : du Node pur. Depuis la racine du dépôt :

```bash
node tests/cours-api.test.mjs .      # api/cours.js : liens, JSON, repli de modèle, normalisation
node tests/cours-rendu.test.mjs .    # cours.js : chaque écran est rendu avec un DOM et une base simulés
```

Les deux scripts chargent les fichiers réellement servis (sans les modifier) et sortent
en code 1 au premier échec — utilisable tel quel dans un hook de pré-commit.
