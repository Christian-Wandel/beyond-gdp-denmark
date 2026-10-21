"""Fetch the extra DST tables the 2.0 decision dashboard needs.

Reuses the HTTP/cache/write helpers in fetch_dst.py (that file is frozen).
Writes data/dst_v2_<metric>.json in the same DNK schema, with breakdowns.

    python fetch_dst_v2.py                       # fetch all
    python fetch_dst_v2.py --discover-table MRO2 # show codes
"""

import argparse
import csv
import io
import sys

import fetch_dst as base

# DRIVHUS2 top-level groups for the sector chart (section codes, OPPRINCIP=DIR).
SECTOR_GROUPS = {
    "households": ["MHUSHOLD"],
    "agriculture": ["VA"],
    "energy_supply": ["VD"],
    "industry_extraction": ["VB", "VC"],
    "transport": ["VH"],
    "construction": ["VF"],
    "water_waste": ["VE"],
    "services": ["VG", "VI", "VJ", "VK", "VLA", "VLB", "VM", "VN",
                 "VO", "VP", "VQ", "VR", "VSA", "VSB"],
}

NEET_AGES = [str(a) for a in range(16, 25)]  # hero is 16-24, like NEET1
REGIONS = ["000", "084", "085", "083", "082", "081"]


def fetch_codes(table_id, variables):
    """Like base.fetch_table_data, but returns value CODES, not labels."""
    body = {"table": table_id, "format": "CSV", "valuePresentation": "Code",
            "variables": variables}
    raw = base.cached_post("data", body, ext="csv")
    return list(csv.DictReader(io.StringIO(raw), delimiter=";"))


def _num(s):
    try:
        return float((s or "").strip().replace(",", "."))
    except ValueError:
        return None  # ".." = missing


def _nest(rows, keys):
    """rows -> {k1: {k2: ... {TID: value}}} for the given dimension columns."""
    out = {}
    for r in rows:
        v = _num(r.get("INDHOLD"))
        if v is None:
            continue
        node = out
        for k in keys:
            node = node.setdefault(r[k], {})
        node[r["TID"]] = v
    return out


def fetch_mro2():
    # Bridge: national accounts -> territorial (UNFCCC) -> incl. LULUCF, by gas.
    rows = fetch_codes("MRO2", [
        {"code": "OVERPOST", "values": ["*"]},
        {"code": "EMTYPE8", "values": ["*"]},
        {"code": "Tid", "values": ["*"]},
    ])
    nested = _nest(rows, ["OVERPOST", "EMTYPE8"])
    return base.write_json(
        "v2_mro2", "MRO2",
        "Territorial GHG incl. LULUCF (Klimaloven basis), excl. biomass CO2",
        "1000 tonnes CO2-eq", nested["TOTLULU"]["GHGEXBIO"],
        breakdown={"by_item_gas": nested})


def fetch_drivhus2():
    codes = ["MTOT", "MV", "NEEL"] + [c for g in SECTOR_GROUPS.values() for c in g]
    rows = fetch_codes("DRIVHUS2", [
        {"code": "BRANCHE", "values": codes},
        {"code": "EMTYPE8", "values": ["GHGEXBIO"]},
        {"code": "OPPRINCIP", "values": ["DIR"]},
        {"code": "Tid", "values": ["*"]},
    ])
    by_code = _nest(rows, ["BRANCHE"])
    groups = {}
    for g, members in SECTOR_GROUPS.items():
        s = {}
        for c in members:
            for t, v in by_code.get(c, {}).items():
                s[t] = round(s.get(t, 0.0) + v, 3)
        groups[g] = s
    return base.write_json(
        "v2_drivhus2", "DRIVHUS2",
        "GHG by sector, direct emissions (national-accounts basis), excl. biomass CO2",
        "1000 tonnes CO2-eq", by_code["MTOT"],
        breakdown={"by_group": groups, "by_code": by_code,
                   "groups": SECTOR_GROUPS})


def fetch_neet4():
    rows = fetch_codes("NEET4", [
        {"code": "STATUSNEET", "values": ["00", "10"]},
        {"code": "BOPOMR", "values": REGIONS},
        {"code": "KON", "values": ["00", "M", "K"]},
        {"code": "ALDER", "values": NEET_AGES},
        {"code": "Tid", "values": ["*"]},
    ])
    # Sum ages 16-24, then rate = NEET / all.
    counts = {}
    for r in rows:
        v = _num(r["INDHOLD"])
        if v is None:
            continue
        key = (r["BOPOMR"], r["KON"], r["TID"], r["STATUSNEET"])
        counts[key] = counts.get(key, 0.0) + v
    rates = {}
    for (area, sex, t, status), n in counts.items():
        if status != "10":
            continue
        total = counts.get((area, sex, t, "00"))
        if total:
            rates.setdefault(area, {}).setdefault(sex, {})[t] = round(100 * n / total, 2)
    return base.write_json(
        "v2_neet4", "NEET4", "NEET share, population 16-24, by region and sex",
        "percent", rates["000"]["00"],
        breakdown={"by_region_sex": rates, "ages": "16-24"})


def fetch_ifor41_municipal():
    rows = fetch_codes("IFOR41", [
        {"code": "ULLIG", "values": ["70"]},
        {"code": "KOMMUNEDK", "values": ["*"]},
        {"code": "Tid", "values": ["*"]},
    ])
    by_mun = _nest(rows, ["KOMMUNEDK"])
    names = {v["id"]: v["text"] for v in _tableinfo("IFOR41")["KOMMUNEDK"]}
    return base.write_json(
        "v2_gini_municipal", "IFOR41", "Gini coefficient by municipality",
        "Gini (0-100)", by_mun["000"],
        breakdown={"by_municipality": by_mun, "names": names})


def fetch_ifor32():
    rows = fetch_codes("IFOR32", [
        {"code": "DECILGEN", "values": ["*"]},
        {"code": "KOMMUNEDK", "values": ["000"]},
        {"code": "Tid", "values": ["*"]},
    ])
    by_dec = _nest(rows, ["DECILGEN"])
    return base.write_json(
        "v2_income_deciles", "IFOR32",
        "Average equivalised disposable income by decile (national)",
        "DKK", by_dec["5DC"], breakdown={"by_decile": by_dec})


def fetch_hisbr():
    rows = fetch_codes("HISBR", [
        {"code": "OMRÅDE", "values": ["*"]},
        {"code": "KØN", "values": ["*"]},
        {"code": "Tid", "values": ["*"]},
    ])
    nested = _nest(rows, ["OMRÅDE", "KØN"])
    names = {v["id"]: v["text"] for v in _tableinfo("HISBR")["OMRÅDE"]}
    return base.write_json(
        "v2_life_exp_region", "HISBR", "Life expectancy at birth by region and sex",
        "years", nested["000"]["TOT"],
        breakdown={"by_region_sex": nested, "names": names})


def fetch_cpi():
    """PRIS113 monthly CPI -> annual mean, complete years only (deflates income)."""
    rows = fetch_codes("PRIS113", [
        {"code": "TYPE", "values": ["INDEKS"]},
        {"code": "Tid", "values": ["*"]},
    ])
    months = {}
    for r in rows:
        v = _num(r.get("INDHOLD"))
        if v is not None:
            months.setdefault(r["TID"][:4], []).append(v)
    annual = {y: sum(v) / 12 for y, v in months.items() if len(v) == 12}
    return base.write_json("v2_cpi", "PRIS113", "Consumer price index, annual mean",
                           "index", annual)


def _tableinfo(table_id):
    import json
    info = json.loads(base.cached_post(
        "tableinfo", {"table": table_id, "format": "JSON"}, ext="json"))
    return {v["id"]: v["values"] for v in info["variables"]}


FETCHERS = [fetch_mro2, fetch_drivhus2, fetch_neet4, fetch_ifor41_municipal,
            fetch_ifor32, fetch_hisbr, fetch_cpi]


def main():
    ap = argparse.ArgumentParser(description="DST fetcher for dashboard 2.0")
    ap.add_argument("--discover-table", metavar="TABLE")
    args = ap.parse_args()
    if args.discover_table:
        base.discover_table(args.discover_table)
        return
    ok = 0
    for fn in FETCHERS:
        try:
            if fn():
                ok += 1
        except Exception as e:  # noqa: BLE001 - report and continue
            print(f"  [ERR] {fn.__name__}: {e!r}")
    print(f"\nDone. {ok}/{len(FETCHERS)} v2 tables written.")


if __name__ == "__main__":
    sys.exit(main())
