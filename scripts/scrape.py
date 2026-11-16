"""Récupère les résultats des clubs sur scoresheet.ffhaltero.fr.

Sortie :
  data/raw/results.json    toutes les lignes de résultats (une par athlète et par compétition)
  data/raw/birthdates.json date de naissance par licence (cache, complété au fil de l'eau)

Le site de la Fédé n'a pas d'API publique : on lit les pages HTML publiques
« recherche par club », une par club et par saison, en y allant doucement.
"""
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
CONFIG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
BASE = CONFIG["base_url"]
DELAY = CONFIG.get("delay_seconds", 1.0)

SESSION = requests.Session()
SESSION.headers["User-Agent"] = "AFHMA-95 records bot (club project; contact via GitHub repo)"

MONTHS = {
    # La Fédé écrit : Jan Fév Mar Avr Mai Jui (juin) Jul (juillet) Aoû Sep Oct Nov Déc
    "jan": 1, "fev": 2, "fév": 2, "mar": 3, "avr": 4, "mai": 5, "jui": 6, "juin": 6,
    "jul": 7, "juil": 7, "aou": 8, "aoû": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12, "déc": 12,
}


def get(url):
    for attempt in range(3):
        try:
            r = SESSION.get(url, timeout=60)
            r.raise_for_status()
            time.sleep(DELAY)
            return r.text
        except requests.RequestException as e:
            print(f"  ! {url}: {e} (essai {attempt + 1}/3)", file=sys.stderr)
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"Impossible de lire {url}")


def num(text):
    text = (text or "").strip().replace("\xa0", "").replace(",", ".")
    if not text or text in {"-", "—"}:
        return None
    try:
        v = float(text)
    except ValueError:
        return None
    return int(v) if v.is_integer() else v


def parse_date(text):
    """'sam 18 Avr 2026' -> '2026-04-18'"""
    m = re.search(r"(\d{1,2})\s+([A-Za-zéûÉÛ]+)\.?\s+(\d{4})", text)
    if not m:
        return None
    day, mon, year = m.groups()
    mon = mon.lower()
    month = MONTHS.get(mon) or MONTHS.get(mon[:4]) or MONTHS.get(mon[:3])
    if not month:
        return None
    return f"{int(year):04d}-{month:02d}-{int(day):02d}"


def seasons_from(html):
    """Liste (id, '2025/2026') des saisons proposées sur la page."""
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for inp in soup.select("input[name=currentSeason]"):
        label = soup.find("label", attrs={"for": inp.get("id")})
        m = re.search(r"(\d{4}/\d{4})", label.get_text() if label else "")
        sid = inp.get("value", "").rstrip("/").split("/")[-1]
        if m and sid.isdigit():
            out.append((int(sid), m.group(1)))
    return out


def parse_club_page(html, season_label):
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", id="competitionSet")
    rows = []
    if not table:
        return rows
    for tr in table.select("tbody tr") or table.find_all("tr")[1:]:
        tds = tr.find_all("td", recursive=False)
        if len(tds) < 18:
            continue
        txt = [td.get_text(" ", strip=True).replace("\xa0", " ") for td in tds]
        a_ath = tds[1].find("a")
        a_comp = tds[2].find("a")
        comp_name = a_comp.get_text(" ", strip=True) if a_comp else txt[2]
        cat = re.sub(r"\s+", " ", txt[16]).strip()
        sex_m = re.search(r"\b([FM])\b", cat)
        rows.append({
            "season": season_label,
            "date": parse_date(txt[2]),
            "competition": comp_name,
            "competition_url": (BASE + a_comp["href"]) if a_comp and a_comp.get("href") else None,
            "licence": txt[0].strip(),
            "athlete": re.sub(r"\s+", " ", txt[1]).strip(),
            "athlete_url": (BASE + a_ath["href"]) if a_ath and a_ath.get("href") else None,
            "club": tds[3].get_text("\n", strip=True).split("\n")[0].strip(),
            "nat": txt[4],
            "bw": num(txt[5]),
            "snatch_attempts": [num(t) for t in txt[6:9]],
            "snatch": num(txt[9]),
            "cj_attempts": [num(t) for t in txt[10:13]],
            "cj": num(txt[13]),
            "total": num(txt[14]),
            "series": txt[15].strip(),
            "category": cat,
            "sex": sex_m.group(1) if sex_m else None,
            "iwf": num(txt[17]),
        })
    return rows


def parse_birthdate(html):
    m = re.search(r"</h3>\s*(\d{2})/(\d{2})/(\d{4})", html)
    if not m:
        return None
    d, mo, y = m.groups()
    return f"{y}-{mo}-{d}"


def athlete_id(href):
    """'/scoresheet/search/8172/10' -> '8172' (identifiant Fédé de l'athlète)."""
    m = re.search(r"/search/(\d+)", href or "")
    return m.group(1) if m else None


def parse_france_records(html):
    """Page /scoresheet/record/ : records de France en cours (SENIOR, U20, U17, U15).

    Une section par catégorie d'âge, deux colonnes (Féminin / Masculin), puis une ligne par
    catégorie de poids ; chaque mouvement contient « nom du détenteur | valeur »
    (« standard » quand personne n'a encore battu le minimum fixé par la Fédé).
    """
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for inner in soup.find_all("table", id="competitionSet"):
        col = inner.find_parent("td")
        section = col.find_parent("table") if col else None
        head = section.find("th") if section else None
        age = head.get_text(strip=True).upper() if head else ""
        label = col.find("span") if col else None
        sex = {"féminin": "F", "masculin": "M"}.get(label.get_text(strip=True).lower() if label else "")
        if age not in ("SENIOR", "U20", "U17", "U15") or not sex:
            continue
        if True:
            for tr in inner.select("tbody > tr"):
                tds = tr.find_all("td", recursive=False)
                if len(tds) < 4:
                    continue
                wc_txt = tds[0].get_text(strip=True)
                wc = f"+{wc_txt.lstrip('>+')} kg" if wc_txt.startswith((">", "+")) else f"{wc_txt} kg"
                for lift, td in zip(("snatch", "cj", "total"), tds[1:4]):
                    cells = td.find_all("td")
                    if len(cells) < 2:
                        continue
                    who = cells[0].get_text(" ", strip=True)
                    link = cells[0].find("a")
                    out.append({
                        "age_cat": "Senior" if age == "SENIOR" else age, "sex": sex, "weight_class": wc,
                        "lift": lift, "value": num(cells[1].get_text()),
                        "standard": who.lower() == "standard",
                        "holder": None if who.lower() == "standard" else re.sub(r"\s+", " ", who),
                        "holder_id": athlete_id(link.get("href")) if link else None,
                    })
    # la page imbrique ses tableaux : on dédoublonne
    seen, uniq = set(), []
    for r in out:
        k = (r["age_cat"], r["sex"], r["weight_class"], r["lift"])
        if k not in seen:
            seen.add(k)
            uniq.append(r)
    return uniq


def scrape_france_records():
    try:
        recs = parse_france_records(get(f"{BASE}/scoresheet/record/"))
    except RuntimeError as e:  # pas bloquant : on garde le fichier précédent
        print(f"  ! records de France : {e}", file=sys.stderr)
        return
    if len(recs) < 50:
        print(f"  ! records de France : seulement {len(recs)} lignes lues, fichier non modifié", file=sys.stderr)
        return
    (RAW / "france_records.json").write_text(json.dumps(recs, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"Records de France : {len(recs)} lignes")


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    scrape_france_records()
    bd_path = RAW / "birthdates.json"
    birthdates = json.loads(bd_path.read_text(encoding="utf-8")) if bd_path.exists() else {}

    first = CONFIG.get("first_season", "2020/2021")
    all_rows = []
    for club in CONFIG["clubs"]:
        club_url = f"{BASE}/scoresheet/search-by-club/{quote(club)}/0/"
        seasons = [s for s in seasons_from(get(club_url)) if s[1] >= first]
        if not seasons:
            raise RuntimeError(f"Aucune saison trouvée pour {club} — la page de la Fédé a peut-être changé.")
        for sid, label in seasons:
            rows = parse_club_page(get(club_url + str(sid)), label)
            print(f"{club} {label}: {len(rows)} lignes")
            all_rows.extend(rows)

    if not all_rows:
        raise RuntimeError("Aucun résultat récupéré — on ne touche pas aux données existantes.")

    # Dates de naissance (une seule fois par licence, gardées en cache)
    todo = {}
    for r in all_rows:
        if r["licence"] and r["licence"] not in birthdates and r["athlete_url"]:
            todo.setdefault(r["licence"], r["athlete_url"])
    print(f"Dates de naissance à récupérer : {len(todo)}")
    for lic, url in todo.items():
        try:
            birthdates[lic] = parse_birthdate(get(url))
        except RuntimeError as e:
            print(f"  ! {e}", file=sys.stderr)

    bad = [r for r in all_rows if not r["date"]]
    if bad:
        print(f"  ! {len(bad)} lignes sans date lisible, ex. : {bad[0]['competition']}", file=sys.stderr)

    all_rows.sort(key=lambda r: (r["date"] or "", r["competition"], r["athlete"]))
    (RAW / "results.json").write_text(json.dumps(all_rows, ensure_ascii=False, indent=0), encoding="utf-8")
    bd_path.write_text(json.dumps(dict(sorted(birthdates.items())), ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"OK : {len(all_rows)} résultats, {len(birthdates)} dates de naissance")


if __name__ == "__main__":
    main()
