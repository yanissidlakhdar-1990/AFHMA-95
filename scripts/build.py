"""Calcule tout ce que le site affiche à partir des données brutes.

Entrée  : data/raw/results.json, data/raw/birthdates.json
Sortie  : site/data/results.json, site/data/athletes.json, site/data/records.json, site/data/meta.json

Règles (reprises du fichier Excel « Records Val d'Oise ») :
- catégorie d'âge réelle = année de fin de saison − année de naissance
  (U13 ≤ 13, U15 14-15, U17 16-17, U20 18-20, Senior 21+)
- Masters (35+, par tranches de 5 ans) : seulement pour les athlètes qui ont déjà concouru
  dans une catégorie Masters (W35, M40…) sur une feuille de match
- une perf compte dans la catégorie d'âge de l'athlète et dans celles au-dessus :
  U15 → U17, U20, Senior ; U17 → U20, Senior ; U20 → Senior ;
  Masters → leur tranche + Senior ; U13 → U13 uniquement
- catégorie de poids recalculée d'après le poids de corps, avec le barème de la période
  (2020/21 → 2024/25, 2025/26, depuis 2026/27)
- seules les perfs avec un total valide comptent pour les records
"""
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "site" / "data"

# ---------------------------------------------------------------- barèmes
# Limites hautes des catégories de poids (la dernière est « + »), par période, sexe et catégorie d'âge.
WEIGHT_CLASSES = {
    "2020-25": {
        "F": {
            "U13": [35, 40, 45, 49, 55, 59, 64, 71],
            "U15": [40, 45, 49, 55, 59, 64, 71, 76, 81],
            "U17": [40, 45, 49, 55, 59, 64, 71, 76, 81],
            "U20": [45, 49, 55, 59, 64, 71, 76, 81, 87],
            "Senior": [45, 49, 55, 59, 64, 71, 76, 81, 87],
        },
        "M": {
            "U13": [35, 40, 45, 49, 55, 61, 67, 73],
            "U15": [49, 55, 61, 67, 73, 81, 89, 96, 102],
            "U17": [49, 55, 61, 67, 73, 81, 89, 96, 102],
            "U20": [55, 61, 67, 73, 81, 89, 96, 102, 109],
            "Senior": [55, 61, 67, 73, 81, 89, 96, 102, 109],
        },
    },
    "2025-26": {
        "F": {
            "U13": [35, 40, 44, 48, 53, 58, 63],
            "U15": [40, 44, 48, 53, 58, 63, 69],
            "U17": [44, 48, 53, 58, 63, 69, 77],
            "U20": [48, 53, 58, 63, 69, 77, 86],
            "Senior": [48, 53, 58, 63, 69, 77, 86],
        },
        "M": {
            "U13": [36, 42, 47, 52, 56, 60, 65],
            "U15": [47, 52, 56, 60, 65, 71, 79, 88],
            "U17": [56, 60, 65, 71, 79, 88, 94],
            "U20": [60, 65, 71, 79, 88, 94, 110],
            "Senior": [60, 65, 71, 79, 88, 94, 110],
        },
    },
    "2026-27": {
        "F": {
            "U13": [35, 41, 45, 49, 53, 57, 61],
            "U15": [41, 45, 49, 53, 57, 61, 69],
            "U17": [45, 49, 53, 57, 61, 69, 77],
            "U20": [49, 53, 57, 61, 69, 77, 86],
            "Senior": [49, 53, 57, 61, 69, 77, 86],
        },
        "M": {
            "U13": [39, 43, 47, 51, 55, 60, 65, 70],
            "U15": [45, 51, 55, 60, 65, 70, 75, 85],
            "U17": [55, 60, 65, 70, 75, 85, 95],
            "U20": [60, 65, 70, 75, 85, 95, 110],
            "Senior": [60, 65, 70, 75, 85, 95, 110],
        },
    },
}
PERIOD_LABELS = {
    "2026-27": "Depuis 2026/27 (nouvelles catégories)",
    "2025-26": "Saison 2025/26",
    "2020-25": "2020/21 → 2024/25 (anciennes catégories)",
}
YOUTH_ORDER = ["U13", "U15", "U17", "U20", "Senior"]

# Séries FFHM : ancien code · nouveau code (même niveau)
SERIES_LEVELS = [
    ("DEB", ["DEB"], "Débutant"),
    ("DPT", ["DPT"], "Départemental"),
    ("REG", ["REG", "PRO"], "Régional"),
    ("IRG", ["IRG", "LIG"], "Interrégional"),
    ("FED", ["FED", "HON"], "Fédéral"),
    ("NAT", ["NAT"], "National"),
    ("INT B", ["INT B", "EUR"], "International B"),
    ("INT A", ["INT A", "MON"], "International A"),
    ("OLY", ["OLY"], "Olympique"),
]
MASTERS_LEVELS = [
    ("REGION", ["REGION"], "Régional"),
    ("FRANCE", ["FRANCE"], "France"),
    ("EUROPE", ["EUROPE"], "Europe"),
    ("MONDE", ["MONDE"], "Monde"),
]
CODE_TO_LEVEL = {}
for scale, levels in (("ffhm", SERIES_LEVELS), ("masters", MASTERS_LEVELS)):
    for i, (key, codes, _) in enumerate(levels):
        for c in codes:
            CODE_TO_LEVEL[c] = (scale, key, i)

LIFTS = [("snatch", "Arraché"), ("cj", "Épaulé-jeté"), ("total", "Total")]


# ---------------------------------------------------------------- helpers
def season_end(label):  # '2025/2026' -> 2026
    return int(label.split("/")[1])


def period_of(season_label):
    end = season_end(season_label)
    if end <= 2025:
        return "2020-25"
    if end == 2026:
        return "2025-26"
    return "2026-27"


def age_category(age, sex, masters=False):
    if age is None:
        return None
    if age <= 13:
        return "U13"
    if age <= 15:
        return "U15"
    if age <= 17:
        return "U17"
    if age <= 20:
        return "U20"
    if age < 35 or not masters:
        return "Senior"
    band = 35 + 5 * ((age - 35) // 5)
    return f"{'W' if sex == 'F' else 'M'}{band}"


def age_cat_from_sheet(category):
    head = (category or "").split(" ")[0].upper()
    return head if head in ("U13", "U15", "U17", "U20") else "Senior"


def weight_group(age_cat):
    return age_cat if age_cat in YOUTH_ORDER else "Senior"


def weight_class(period, sex, age_cat, bw):
    limits = WEIGHT_CLASSES[period][sex][weight_group(age_cat)]
    if bw is None:
        return None
    for lim in limits:
        if bw <= lim:
            return f"{lim} kg"
    return f"+{limits[-1]} kg"


def target_groups(age_cat):
    """Catégories d'âge dans lesquelles une perf compte pour les records."""
    if age_cat == "U13":
        return ["U13"]
    if age_cat in YOUTH_ORDER:
        return YOUTH_ORDER[YOUTH_ORDER.index(age_cat):]
    return [age_cat, "Senior"]  # Masters


def age_sort_key(age_cat):
    if age_cat in YOUTH_ORDER:
        return (YOUTH_ORDER.index(age_cat), 0)
    return (len(YOUTH_ORDER), int(age_cat[1:]))


def wc_sort_key(wc):
    return (wc.startswith("+"), float(wc.strip("+ kg")))


def fr_date(iso):
    return f"{iso[8:10]}/{iso[5:7]}/{iso[0:4]}" if iso else ""


# ---------------------------------------------------------------- build
def main():
    results = json.loads((RAW / "results.json").read_text(encoding="utf-8"))
    birthdates = json.loads((RAW / "birthdates.json").read_text(encoding="utf-8"))

    # athlètes « Masters » : ont déjà une feuille de match en catégorie Masters
    masters = {r["licence"] for r in results if re.match(r"^[MW]\d{2}\b", r.get("category") or "")}

    # 1. enrichir chaque ligne
    rows = []
    for i, r in enumerate(sorted(results, key=lambda r: (r["date"] or "", r["competition"], r["athlete"]))):
        sex = r.get("sex") or "M"
        bd = birthdates.get(r["licence"])
        age = season_end(r["season"]) - int(bd[:4]) if bd else None
        cat = age_category(age, sex, r["licence"] in masters) or age_cat_from_sheet(r["category"])
        sheet_m = re.match(r"^([MW]\d{2})\b", r.get("category") or "")
        if sheet_m:  # tranche Masters indiquée sur la feuille de match : elle fait foi
            cat = sheet_m.group(1)
        period = period_of(r["season"])
        rows.append({
            "id": i,
            "season": r["season"],
            "date": r["date"],
            "competition": r["competition"],
            "competition_url": r.get("competition_url"),
            "club": r["club"],
            "licence": r["licence"],
            "athlete": r["athlete"],
            "sex": sex,
            "age_cat": cat,
            "sheet_cat": r["category"],
            "period": period,
            "weight_class": weight_class(period, sex, cat, r["bw"]),
            "bw": r["bw"],
            "snatch": r["snatch"] or 0,
            "cj": r["cj"] or 0,
            "total": r["total"] or 0,
            "snatch_attempts": r.get("snatch_attempts"),
            "cj_attempts": r.get("cj_attempts"),
            "series": r["series"],
            "iwf": r["iwf"],
            "records": [],
        })

    # 2. records du 95 (chronologiques) + historique
    current = {}  # (period, sex, age, wc, lift) -> {value, athlete, club, date, competition, row}
    history = []
    for row in rows:
        if not row["total"] or row["bw"] is None or not row["date"]:
            continue
        for grp in target_groups(row["age_cat"]):
            wc = weight_class(row["period"], row["sex"], grp, row["bw"])
            for lift, lift_label in LIFTS:
                val = row[lift]
                if not val or val <= 0:
                    continue
                key = (row["period"], row["sex"], grp, wc, lift)
                old = current.get(key)
                if old is None or val > old["value"]:
                    current[key] = {
                        "value": val, "athlete": row["athlete"], "licence": row["licence"],
                        "club": row["club"], "date": row["date"], "competition": row["competition"],
                    }
                    history.append({
                        "period": row["period"], "sex": row["sex"], "age_cat": grp, "weight_class": wc,
                        "lift": lift, "value": val,
                        "previous": old["value"] if old else None,
                        "previous_holder": old["athlete"] if old else None,
                        "athlete": row["athlete"], "licence": row["licence"], "athlete_cat": row["age_cat"],
                        "club": row["club"], "date": row["date"], "competition": row["competition"],
                    })
                    tag = f"{grp} {wc} {lift_label}"
                    if tag not in row["records"]:
                        row["records"].append(tag)

    # tableau des records : toutes les catégories du barème, même vides
    records = []
    for period, by_sex in WEIGHT_CLASSES.items():
        for sex in ("F", "M"):
            ages_seen = {k[2] for k in current if k[0] == period and k[1] == sex}
            ages = sorted(set(YOUTH_ORDER) | ages_seen, key=age_sort_key)
            for age in ages:
                limits = by_sex[sex][weight_group(age)]
                wcs = [f"{l} kg" for l in limits] + [f"+{limits[-1]} kg"]
                if age not in YOUTH_ORDER:  # Masters : seulement les catégories où il y a un record
                    wcs = sorted({k[3] for k in current if k[:3] == (period, sex, age)}, key=wc_sort_key)
                for wc in wcs:
                    entry = {"period": period, "sex": sex, "age_cat": age, "weight_class": wc}
                    for lift, _ in LIFTS:
                        entry[lift] = current.get((period, sex, age, wc, lift))
                    records.append(entry)

    # 3. fiches athlètes
    latest_season = max(r["season"] for r in rows)
    latest_period = period_of(latest_season)
    by_lic = defaultdict(list)
    for row in rows:
        by_lic[row["licence"]].append(row)

    athletes = []
    for lic, rs in by_lic.items():
        rs.sort(key=lambda r: (r["date"] or "", r["id"]))
        last = rs[-1]
        sex = last["sex"]
        bd = birthdates.get(lic)
        cur_age = season_end(latest_season) - int(bd[:4]) if bd else None
        cur_cat = age_category(cur_age, sex, lic in masters) or last["age_cat"]
        last_bw = next((r["bw"] for r in reversed(rs) if r["bw"]), None)
        cur_wc = weight_class(latest_period, sex, cur_cat, last_bw)
        valid = [r for r in rs if r["total"]]

        pbs = {}
        for lift, _ in LIFTS:
            best = max(rs, key=lambda r: (r[lift] or 0, -(r["id"])), default=None)
            pbs[lift] = {"value": best[lift], "date": best["date"]} if best and best[lift] else None

        rec95 = {lift: current.get((latest_period, sex, cur_cat, cur_wc, lift)) for lift, _ in LIFTS}

        # séries
        levels = {}
        level_history = []
        for r in rs:
            info = CODE_TO_LEVEL.get(r["series"])
            if not info:
                continue
            scale, key, _ = info
            lv = levels.setdefault(f"{scale}:{key}", {"first": r["date"], "count": 0, "first_row": r["id"]})
            lv["count"] += 1
            if lv["first_row"] == r["id"]:
                level_history.append({
                    "scale": scale, "level": key, "date": r["date"], "age_cat": r["age_cat"],
                    "total": r["total"], "competition": r["competition"],
                })

        by_season = defaultdict(int)
        for r in valid:
            by_season[r["season"]] = max(by_season[r["season"]], r["total"])

        athletes.append({
            "licence": lic,
            "name": last["athlete"],
            "club": last["club"],
            "clubs": sorted({r["club"] for r in rs}),
            "sex": sex,
            "birth_year": int(bd[:4]) if bd else None,
            "age_cat": cur_cat,
            "weight_class": cur_wc,
            "last_bw": last_bw,
            "last_date": last["date"],
            "first_date": rs[0]["date"],
            "n_competitions": len(rs),
            "best_iwf": max((r["iwf"] or 0 for r in rs), default=0) or None,
            "pb": pbs,
            "record95": rec95,
            "levels": levels,
            "level_history": level_history,
            "best_total_by_season": dict(sorted(by_season.items())),
            "results": [r["id"] for r in rs],
        })
    athletes.sort(key=lambda a: a["name"])

    OUT.mkdir(parents=True, exist_ok=True)
    dump = lambda name, obj: (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    dump("results.json", rows)
    dump("athletes.json", athletes)
    dump("records.json", {"records": records, "history": history})
    dump("meta.json", {
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "latest_result": max(r["date"] for r in rows if r["date"]),
        "latest_season": latest_season,
        "latest_period": latest_period,
        "periods": PERIOD_LABELS,
        "clubs": json.loads((ROOT / "config.json").read_text(encoding="utf-8"))["clubs"],
        "series_levels": [{"key": k, "codes": c, "label": l} for k, c, l in SERIES_LEVELS],
        "masters_levels": [{"key": k, "codes": c, "label": l} for k, c, l in MASTERS_LEVELS],
        "counts": {"results": len(rows), "athletes": len(athletes), "records_broken": len(history)},
    })
    print(f"OK : {len(rows)} résultats, {len(athletes)} athlètes, {len(history)} records battus")


if __name__ == "__main__":
    main()
