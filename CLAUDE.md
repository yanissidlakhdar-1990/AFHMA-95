# AFHMA-95 — contexte pour Claude

Site de stats et records d'haltérophilie pour les clubs du Val d'Oise (AFHMA Franconville, HFC CP95 Cergy, WIM LIFT).
Utilisateurs : les athlètes du club, surtout sur téléphone. Tout le site est en français.
Site en ligne : https://yanissidlakhdar-1990.github.io/AFHMA-95/

## Architecture (volontairement simple, zéro serveur, gratuit)
- `scripts/scrape.py` lit les pages HTML publiques de scoresheet.ffhaltero.fr (pas d'API) :
  `/scoresheet/search-by-club/<CLUB>/0/<id saison>` (une page par club et saison, tableau `#competitionSet`, 18 colonnes)
  et la page athlète (`/scoresheet/search/<id>/<saison>`) pour la date de naissance, gardée en cache dans `data/raw/birthdates.json`.
  Mois écrits par la Fédé : Jan Fév Mar Avr Mai Jui (juin) Jul (juillet) Aoû Sep Oct Nov Déc. Essai négatif = raté.
- `scripts/build.py` calcule catégories, records du 95, séries et fiches → `site/data/*.json`.
- `site/` = site statique (HTML/CSS/JS vanilla, pas de framework, pas de build). Routes par hash : `#/`, `#/a/<licence>`, `#/records`, `#/derniers`.
- `.github/workflows/update.yml` : chaque nuit (05:00 UTC) + à chaque push sur main → scrape, build, commit des données, déploiement GitHub Pages.

## Règles métier (reprises de l'Excel d'origine, validées : 1716/1716 lignes identiques)
- Âge = année de fin de saison − année de naissance. U13 ≤13, U15 14-15, U17 16-17, U20 18-20, Senior 21+.
- Masters (W35, M40…, tranches de 5 ans) uniquement si l'athlète a déjà une feuille de match en catégorie Masters.
- Records du 95 : une perf compte dans sa catégorie d'âge et au-dessus (U15→U17,U20,Senior ; U17→U20,Senior ; U20→Senior ; Masters→tranche+Senior ; U13→U13 seul).
  Catégorie de poids recalculée depuis le poids de corps avec le barème de la période (2020-25 / 2025-26 / 2026-27+). Total valide obligatoire.
- Séries FFHM : ancien code · nouveau code = même niveau (REG·PRO, IRG·LIG, FED·HON, INT B·EUR, INT A·MON). DEB = débutant.

## Points d'attention
- Le robot commite des données sur main chaque nuit : toujours `git pull` avant de modifier.
- Ne pas commiter de fausses données de test dans `data/` ou `site/data/` (elles sont générées par l'action).
- `site/data/` n'existe qu'après un passage du workflow : pour tester en local, lancer `python scripts/scrape.py && python scripts/build.py` (accès réseau à ffhaltero requis), puis `python -m http.server -d site`.
- Le site ne doit pas être indexé (meta robots noindex + robots.txt) : il y a des mineurs.
- Pas encore fait : badges Record IDF / Record de France (à récupérer sur /scoresheet/record/).
