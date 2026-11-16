# AFHMA-95

Résultats, records et stats des haltérophiles du Val d'Oise (AFHMA Franconville, HFC CP95 Cergy, WIM LIFT).

**Le site :** https://yanissidlakhdar-1990.github.io/AFHMA-95/

## Comment ça marche

1. Chaque nuit (vers 6 h), GitHub lance `scripts/scrape.py`, qui lit les pages publiques
   « recherche par club » de [scoresheet.ffhaltero.fr](https://scoresheet.ffhaltero.fr/scoresheet/)
   pour chaque club et chaque saison depuis 2020/21 → `data/raw/`.
2. `scripts/build.py` recalcule les catégories, les records du 95, les séries et les fiches → `site/data/`.
3. Le dossier `site/` est publié sur GitHub Pages.

Rien à faire à la main. Pour forcer une mise à jour : onglet **Actions** → « Mise à jour des résultats » → **Run workflow**.

## Changer quelque chose

- Ajouter / retirer un club, changer la première saison : `config.json`
- Règles de calcul (catégories d'âge et de poids, records, séries) : en haut de `scripts/build.py`
- Apparence du site : `site/`

Si le site de la Fédé change de format, le robot échoue et GitHub envoie un mail : il faudra adapter `scripts/scrape.py`.
