"""Beyond GDP Denmark — Danmarks Statistik (DST) data retrieval.

Fetches Beyond-GDP-relevant metrics for Denmark from the StatBank API,
caches raw responses, and writes cleaned JSON to data/.

Usage:
    python fetch_dst.py --discover-subject 9      # list tables in a subject
    python fetch_dst.py --discover-table FOLK1A   # show variables + value codes
    python fetch_dst.py                           # run all fetchers
"""

import argparse
import csv
import hashlib
import io
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DST_BASE = "https://api.statbank.dk/v1"
ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"
CACHE_DIR = ROOT / ".tmp" / "dst_cache"
CACHE_TTL_DAYS = 7

UA = "BeyondGDP-Denmark/0.1 (data retrieval PoC)"


# ── HTTP helpers ────────────────────────────────────────────────────────────

def _request(url, data=None):
    headers = {"User-Agent": UA}
    if data is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode("utf-8-sig")  # strip DST's UTF-8 BOM
    return raw


def dst_get(endpoint, params=None):
    """GET against /subjects, /tables. Returns parsed JSON."""
    url = f"{DST_BASE}/{endpoint}"
    if params:
        query = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{url}?{query}"
    return json.loads(_request(url))


def dst_post(endpoint, body):
    """POST against /tableinfo, /data. Returns raw string (may be JSON or CSV)."""
    return _request(f"{DST_BASE}/{endpoint}", data=body)


def cached_post(endpoint, body, ext="txt"):
    """POST with a 7-day disk cache, keyed by md5 of the request body."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = hashlib.md5(json.dumps(body, sort_keys=True).encode()).hexdigest()
    table = body.get("table", endpoint)
    cache_file = CACHE_DIR / f"{table}_{key}.{ext}"

    if cache_file.exists():
        age_days = (datetime.now().timestamp() - cache_file.stat().st_mtime) / 86400
        if age_days < CACHE_TTL_DAYS:
            return cache_file.read_text(encoding="utf-8")

    raw = dst_post(endpoint, body)
    cache_file.write_text(raw, encoding="utf-8")
    return raw


# ── Discovery helpers (dev tools) ───────────────────────────────────────────

def discover_subject(subject_id):
    """Print all tables under a subject id."""
    tables = dst_get("tables", {"subjects": subject_id, "format": "JSON"})
    print(f"\nTables under subject {subject_id}: ({len(tables)} found)\n")
    for t in tables:
        print(f"  {t['id']:<12} {t.get('text', '')}")
        print(f"               vars: {', '.join(t.get('variables', []))}  "
              f"updated: {t.get('updated', '?')}")


def discover_table(table_id):
    """Print variables and accepted value codes for a table (tableinfo)."""
    info = json.loads(cached_post(
        "tableinfo", {"table": table_id, "format": "JSON"}, ext="json"))
    print(f"\nTable {table_id}: {info.get('text', '')}")
    print(f"Unit: {info.get('unit', '?')}   Updated: {info.get('updated', '?')}\n")
    for var in info.get("variables", []):
        print(f"  Variable: {var['id']}  ({var.get('text', '')})")
        values = var.get("values", [])
        shown = values[:12]
        for v in shown:
            print(f"      {v['id']:<14} {v.get('text', '')}")
        if len(values) > 12:
            print(f"      ... (+{len(values) - 12} more)")
        print()


# ── Data extraction ─────────────────────────────────────────────────────────

def fetch_table_data(table_id, variables):
    """Fetch a table as semicolon-delimited CSV. Returns list[dict] rows.

    The /data endpoint does not accept format=JSON; CSV is the cleanest
    tabular form. Columns are the variable labels plus TID and INDHOLD.
    """
    body = {"table": table_id, "format": "CSV", "variables": variables}
    raw = cached_post("data", body, ext="csv")
    reader = csv.DictReader(io.StringIO(raw), delimiter=";")
    return list(reader)


def _parse_timeseries(rows):
    """Collapse CSV rows into {period: value} using the TID/INDHOLD columns.

    Assumes the query fixed every dimension except time, so there is one row
    per period. Period keys keep any quarter/month suffix (e.g. "2024K1").
    """
    series = {}
    for row in rows:
        period = (row.get("TID") or "").strip()
        val = (row.get("INDHOLD") or "").strip()
        if not period:
            continue
        try:
            series[period] = float(val.replace(",", "."))
        except ValueError:
            continue  # ".." / blank = missing value
    return series


def _sum_by_period(rows):
    """Sum INDHOLD across multiple rows per period (e.g. age/sex bands)."""
    series = {}
    for row in rows:
        period = (row.get("TID") or "").strip()
        val = (row.get("INDHOLD") or "").strip()
        if not period:
            continue
        try:
            series[period] = series.get(period, 0.0) + float(val.replace(",", "."))
        except ValueError:
            continue
    return series


def _mean_by_period(rows):
    """Average INDHOLD across multiple rows per period (e.g. both sexes)."""
    sums, counts = {}, {}
    for row in rows:
        period = (row.get("TID") or "").strip()
        val = (row.get("INDHOLD") or "").strip()
        if not period:
            continue
        try:
            num = float(val.replace(",", "."))
        except ValueError:
            continue
        sums[period] = sums.get(period, 0.0) + num
        counts[period] = counts.get(period, 0) + 1
    return {p: round(sums[p] / counts[p], 2) for p in sums}


def write_json(metric, table, label, unit, series, breakdown=None):
    """Normalize + write data/dst_<metric>.json under the DNK schema."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not series and not breakdown:
        print(f"  [!] {metric}: no data parsed — skipping write")
        return None

    latest_year = max(series, key=lambda y: y[:4]) if series else None
    dnk = {"name": "Denmark"}
    if series:
        dnk["value"] = series[latest_year]
        dnk["year"] = latest_year
        dnk["series"] = series
    if breakdown:
        dnk["breakdown"] = breakdown

    out = {
        "meta": {
            "source": "Danmarks Statistik StatBank API",
            "table": table,
            "label": label,
            "unit": unit,
            "fetched": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "latest_year": latest_year,
        },
        "data": {"DNK": dnk},
    }
    path = DATA_DIR / f"dst_{metric}.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    n = len(series) if series else len(breakdown or {})
    print(f"  [ok] {metric:<16} {table:<10} {n} pts, latest {latest_year}")
    return path


# ── Per-metric fetchers ─────────────────────────────────────────────────────
# Variable codes confirmed via discover_table() before filling these in.

def fetch_population():
    # FOLK1A is quarterly; fix every dimension to its total to get one series.
    rows = fetch_table_data("FOLK1A", [
        {"code": "OMRÅDE", "values": ["000"]},      # Hele landet
        {"code": "KØN", "values": ["TOT"]},
        {"code": "ALDER", "values": ["IALT"]},
        {"code": "CIVILSTAND", "values": ["TOT"]},
        {"code": "Tid", "values": ["*"]},
    ])
    series = _parse_timeseries(rows)
    return write_json("population", "FOLK1A",
                      "Population, start of quarter", "persons", series)


def fetch_life_expectancy():
    # HISB8 mortality table; TAVLE=3 "Middellevetid", ALDER=0 = at birth.
    # No combined-sex code, so fetch M+K and average per period.
    rows = fetch_table_data("HISB8", [
        {"code": "ALDER", "values": ["0"]},
        {"code": "KØN", "values": ["*"]},
        {"code": "TAVLE", "values": ["3"]},
        {"code": "Tid", "values": ["*"]},
    ])
    series = _mean_by_period(rows)
    return write_json("life_expectancy", "HISB8",
                      "Life expectancy at birth (avg of sexes)", "years", series)


def fetch_unemployment():
    # AKU111K (current LFS, quarterly %); BESKSTATUS=LPCT is the AKU
    # unemployment rate, ALDER=TOT and KØN=TOT give the headline figure.
    rows = fetch_table_data("AKU111K", [
        {"code": "BESKSTATUS", "values": ["LPCT"]},
        {"code": "ALDER", "values": ["TOT"]},
        {"code": "KØN", "values": ["TOT"]},
        {"code": "Tid", "values": ["*"]},
    ])
    series = _parse_timeseries(rows)
    return write_json("unemployment", "AKU111K",
                      "Unemployment rate (LFS)", "percent", series)


def fetch_income():
    # INDKP101; ENHED=116 average for all persons, INDKOMSTTYPE=100 disposable.
    rows = fetch_table_data("INDKP101", [
        {"code": "OMRÅDE", "values": ["000"]},
        {"code": "ENHED", "values": ["116"]},
        {"code": "KOEN", "values": ["MOK"]},
        {"code": "INDKOMSTTYPE", "values": ["100"]},
        {"code": "Tid", "values": ["*"]},
    ])
    series = _parse_timeseries(rows)
    return write_json("income", "INDKP101",
                      "Average disposable income per person", "DKK", series)


def fetch_gdp():
    # NAN1 (national accounts). TRANSAKT=B1GQK is "B.1*g Bruttonationalprodukt, BNP"
    # (GDP). PRISENHED=LAN_M is "2020-priser, kaedede vaerdier" (2020 chained prices,
    # bn kr) — the real, inflation-adjusted series, not current-price nominal GDP.
    # No OMRAADE dimension on this table (national accounts are DK-only by definition).
    rows = fetch_table_data("NAN1", [
        {"code": "TRANSAKT", "values": ["B1GQK"]},
        {"code": "PRISENHED", "values": ["LAN_M"]},
        {"code": "Tid", "values": ["*"]},
    ])
    series = _parse_timeseries(rows)
    return write_json("gdp", "NAN1",
                      "Real GDP (2020 chained prices)", "DKK billion", series)


def fetch_education():
    # HFUDD11 counts population by highest attained education. Total across all
    # education levels = total 15-69 population; kept as a coverage check.
    rows = fetch_table_data("HFUDD11", [
        {"code": "BOPOMR", "values": ["000"]},
        {"code": "HERKOMST", "values": ["TOT"]},
        {"code": "HFUDD", "values": ["TOT"]},
        {"code": "ALDER", "values": ["TOT"]},
        {"code": "KØN", "values": ["TOT"]},
        {"code": "Tid", "values": ["*"]},
    ])
    series = _parse_timeseries(rows)
    return write_json("education", "HFUDD11",
                      "Population 15-69 by highest education (total)",
                      "persons", series)


def fetch_ghg():
    # DRIVHUS; BRANCHE=MV all industries, EMTYPE8=GHGEXBIO total GHG excl. biomass CO2.
    rows = fetch_table_data("DRIVHUS", [
        {"code": "BRANCHE", "values": ["MV"]},
        {"code": "EMTYPE8", "values": ["GHGEXBIO"]},
        {"code": "Tid", "values": ["*"]},
    ])
    series = _parse_timeseries(rows)
    return write_json("ghg", "DRIVHUS",
                      "Greenhouse gas emissions (excl. biomass CO2)",
                      "1000 tonnes CO2-eq", series)


def fetch_energy():
    # ENE2HO energy balance (GJ); TILANV=ETIL total supply, ENERGI1=ETOT all types.
    rows = fetch_table_data("ENE2HO", [
        {"code": "TILANV", "values": ["ETIL"]},
        {"code": "ENERGI1", "values": ["ETOT"]},
        {"code": "Tid", "values": ["*"]},
    ])
    series = _parse_timeseries(rows)
    return write_json("energy", "ENE2HO",
                      "Total energy supply", "GJ", series)


def fetch_climate_footprint():
    # AFTRYK1 (experimental): consumption-based climate footprint.
    # ANVENDTYPE=IEA = total domestic final use (the headline footprint figure).
    # UDLEDBRANCHE=MTOT = all emitting industries.
    # UDLEDLAND=T = global (domestic + rest-of-world).
    # Unit: tonnes CO2-equivalents (individual, not 1000s).
    rows = fetch_table_data("AFTRYK1", [
        {"code": "ANVENDTYPE", "values": ["IEA"]},
        {"code": "UDLEDBRANCHE", "values": ["MTOT"]},
        {"code": "UDLEDLAND", "values": ["T"]},
        {"code": "Tid", "values": ["*"]},
    ])
    series = _parse_timeseries(rows)
    # Also pull the domestic vs rest-of-world split for the offshore story
    rows_split = fetch_table_data("AFTRYK1", [
        {"code": "ANVENDTYPE", "values": ["IEA"]},
        {"code": "UDLEDBRANCHE", "values": ["MTOT"]},
        {"code": "UDLEDLAND", "values": ["DK", "ROW"]},
        {"code": "Tid", "values": ["*"]},
    ])
    dk_series, row_series = {}, {}
    for row in rows_split:
        period = (row.get("TID") or "").strip()
        country = (row.get("UDLEDLAND") or "").strip()
        val = (row.get("INDHOLD") or "").strip()
        if not period:
            continue
        try:
            num = float(val.replace(",", "."))
        except ValueError:
            continue
        if country == "DK":
            dk_series[period] = num
        elif country == "ROW":
            row_series[period] = num
    breakdown = {"domestic": dk_series, "rest_of_world": row_series}
    return write_json("climate_footprint", "AFTRYK1",
                      "Climate footprint (consumption-based, experimental)",
                      "tonnes CO2-eq", series, breakdown=breakdown)


def fetch_material_flow():
    # MRM2: Economy-wide material flow accounts.
    # MATER=MF0 = all materials total; INDIKATOR=50 = Domestic Material Consumption (DMC).
    rows = fetch_table_data("MRM2", [
        {"code": "MATER", "values": ["MF0"]},
        {"code": "INDIKATOR", "values": ["50"]},
        {"code": "Tid", "values": ["*"]},
    ])
    series = _parse_timeseries(rows)
    return write_json("material_flow", "MRM2",
                      "Domestic Material Consumption (DMC)", "tonnes", series)


def fetch_water_abstraction():
    # VANDRG1: Physical water accounts — abstraction.
    # ERHVERV=ETOT = all industries + households; VANDTYP=TOTVAND = total water.
    rows = fetch_table_data("VANDRG1", [
        {"code": "ERHVERV", "values": ["ETOT"]},
        {"code": "VANDTYP", "values": ["TOTVAND"]},
        {"code": "Tid", "values": ["*"]},
    ])
    series = _parse_timeseries(rows)
    return write_json("water_abstraction", "VANDRG1",
                      "Water abstraction (physical water accounts)",
                      "1000 m3", series)


def fetch_energy_mix():
    # ENE2HO energy balance (GJ); TILANV=ETOT = domestic consumption by sectors
    # and households (excludes exports, bunkers, stock changes).
    # Fetch individual fuel-type codes so we can compute provisioning mix shares.
    #
    # Fossil codes: crude oil, petrol, diesel, heating oil, natural gas, coal, jet fuel, fuel oil
    # Renewable codes: wind, solar PV, solar thermal, straw, firewood, wood chips,
    #                  wood pellets, biogas, biodiesel, heat pumps, geothermal
    # Waste codes: non-biodegradable, biodegradable (split kept for transparency)
    # Total: ETOT for denominator
    FUEL_CODES = {
        # Fossil
        "crude_oil":     "ERO",
        "petrol":        "EMBZF",
        "diesel":        "EGASOTR",
        "heating_oil":   "EGASOOE",
        "natural_gas":   "ENG3",
        "coal":          "EKUL",
        "coke":          "EKOKS",
        "jet_fuel":      "EJP1",
        "fuel_oil":      "EFUEL",
        # Renewable
        "wind":          "EVIND",
        "solar_pv":      "ESOLK",
        "solar_thermal": "ESOLV",
        "straw":         "EHALM",
        "firewood":      "EBRND",
        "wood_chips":    "EFLIS",
        "wood_pellets":  "ETPI",
        "biogas":        "EBIO",
        "biodiesel":     "EBIOOIL",
        "heat_pumps":    "EVMP",
        "geothermal":    "EGEO",
        # Waste (contested — split kept for transparency)
        "waste_fossil":  "EAFF",
        "waste_bio":     "EAFF_BIO",
    }

    # Group codes for aggregate share calculation
    FOSSIL_KEYS = {
        "crude_oil", "petrol", "diesel", "heating_oil",
        "natural_gas", "coal", "coke", "jet_fuel", "fuel_oil",
    }
    RENEWABLE_KEYS = {
        "wind", "solar_pv", "solar_thermal", "straw", "firewood",
        "wood_chips", "wood_pellets", "biogas", "biodiesel",
        "heat_pumps", "geothermal",
    }

    all_codes = list(FUEL_CODES.values())
    rows = fetch_table_data("ENE2HO", [
        {"code": "TILANV", "values": ["ETOT"]},
        {"code": "ENERGI1", "values": all_codes},
        {"code": "Tid", "values": ["*"]},
    ])

    # DST CSV returns Danish labels in the ENERGI1 column, not the code ids.
    # Build a label→name lookup by fetching tableinfo for the label text.
    import json as _json
    info = _json.loads(dst_post("tableinfo", {"table": "ENE2HO", "format": "JSON"}))
    label_to_name = {}
    for var in info.get("variables", []):
        if var["id"] == "ENERGI1":
            for v in var["values"]:
                if v["id"] in FUEL_CODES.values():
                    name = code_to_name = None
                    for fname, fcode in FUEL_CODES.items():
                        if fcode == v["id"]:
                            name = fname
                            break
                    if name:
                        label_to_name[v["text"].strip()] = name
            break

    # Parse into {fuel_name: {year: GJ}}
    by_fuel = {name: {} for name in FUEL_CODES}
    for row in rows:
        period = (row.get("TID") or "").strip()
        label = (row.get("ENERGI1") or "").strip()
        val = (row.get("INDHOLD") or "").strip()
        name = label_to_name.get(label)
        if not period or not name:
            continue
        try:
            by_fuel[name][period] = float(val.replace(",", "."))
        except ValueError:
            continue

    # Build aggregate series: fossil total, renewable total per year
    all_years = sorted({y for series in by_fuel.values() for y in series})
    fossil_series, renewable_series = {}, {}
    for year in all_years:
        fossil_series[year] = sum(
            by_fuel[k].get(year, 0.0) for k in FOSSIL_KEYS
        )
        renewable_series[year] = sum(
            by_fuel[k].get(year, 0.0) for k in RENEWABLE_KEYS
        )

    # Use fossil total as the headline series (the thing we want to shrink)
    breakdown = {
        "by_fuel": by_fuel,
        "fossil_total": fossil_series,
        "renewable_total": renewable_series,
    }
    return write_json("energy_mix", "ENE2HO",
                      "Energy supply by fuel type (domestic consumption)",
                      "GJ", fossil_series, breakdown=breakdown)


def fetch_green_gva():
    # GRON1: Environmental goods and services.
    # MFORMAAL=G_05 = total; BRANCHE=TOT = all industries; ENHED=XOM = turnover.
    rows_turnover = fetch_table_data("GRON1", [
        {"code": "MFORMAAL", "values": ["G_05"]},
        {"code": "BRANCHE", "values": ["TOT"]},
        {"code": "ENHED", "values": ["XOM"]},
        {"code": "Tid", "values": ["*"]},
    ])
    series = _parse_timeseries(rows_turnover)
    # Also fetch value added (XVT) for GDP-share context
    rows_va = fetch_table_data("GRON1", [
        {"code": "MFORMAAL", "values": ["G_05"]},
        {"code": "BRANCHE", "values": ["TOT"]},
        {"code": "ENHED", "values": ["XVT"]},
        {"code": "Tid", "values": ["*"]},
    ])
    va_series = _parse_timeseries(rows_va)
    breakdown = {"value_added": va_series}
    return write_json("green_gva", "GRON1",
                      "Green goods and services — total turnover",
                      "DKK million", series, breakdown=breakdown)


def fetch_energy_by_sector():
    # ENE3H: Gross energy consumption (GJ) by sector × fuel type, 1966–2024.
    # We fetch the 7 scenario-relevant sector aggregates × the same fuel codes
    # used in fetch_energy_mix(), giving a sector × fuel × year cube.
    #
    # Sector groups fetched:
    #   ETOT       = all sectors + households (grand total)
    #   EHUSHOLD   = households (heating scenario)
    #   EV         = all business sectors
    #   VA         = agriculture, forestry, fishing
    #   VH         = transport sector (commercial fleets, rail, shipping, aviation)
    #   VD         = energy supply (power plants, gas, district heating)
    #   VC         = all manufacturing industry
    #   VF         = construction
    #   VO_Q       = public sector (admin, education, health)

    SECTOR_CODES = {
        "total":          "ETOT",
        "households":     "EHUSHOLD",
        "all_industry":   "EV",
        "agriculture":    "VA",
        "transport":      "VH",
        "energy_supply":  "VD",
        "manufacturing":  "VC",
        "construction":   "VF",
        "public":         "VO_Q",
    }

    FUEL_CODES = {
        "crude_oil":     "ERO",
        "petrol":        "EMBZF",
        "diesel":        "EGASOTR",
        "heating_oil":   "EGASOOE",
        "natural_gas":   "ENG3",
        "coal":          "EKUL",
        "coke":          "EKOKS",
        "jet_fuel":      "EJP1",
        "fuel_oil":      "EFUEL",
        "wind":          "EVIND",
        "solar_pv":      "ESOLK",
        "solar_thermal": "ESOLV",
        "straw":         "EHALM",
        "firewood":      "EBRND",
        "wood_chips":    "EFLIS",
        "wood_pellets":  "ETPI",
        "biogas":        "EBIO",
        "biodiesel":     "EBIOOIL",
        "heat_pumps":    "EVMP",
        "geothermal":    "EGEO",
        "waste_fossil":  "EAFF",
        "waste_bio":     "EAFF_BIO",
        "electricity":   "EEL",
        "district_heat": "EFJV",
    }

    FOSSIL_KEYS = {
        "crude_oil", "petrol", "diesel", "heating_oil",
        "natural_gas", "coal", "coke", "jet_fuel", "fuel_oil",
    }
    RENEWABLE_KEYS = {
        "wind", "solar_pv", "solar_thermal", "straw", "firewood",
        "wood_chips", "wood_pellets", "biogas", "biodiesel",
        "heat_pumps", "geothermal",
    }

    import json as _json

    # Build label→name lookups from tableinfo (both BRANCHE and ENERGI1)
    info = _json.loads(dst_post("tableinfo", {"table": "ENE3H", "format": "JSON"}))
    sector_label_to_name, fuel_label_to_name = {}, {}
    for var in info.get("variables", []):
        if var["id"] == "BRANCHE":
            code_to_sname = {v: k for k, v in SECTOR_CODES.items()}
            for v in var["values"]:
                sname = code_to_sname.get(v["id"])
                if sname:
                    sector_label_to_name[v["text"].strip()] = sname
        elif var["id"] == "ENERGI1":
            code_to_fname = {v: k for k, v in FUEL_CODES.items()}
            for v in var["values"]:
                fname = code_to_fname.get(v["id"])
                if fname:
                    fuel_label_to_name[v["text"].strip()] = fname

    rows = fetch_table_data("ENE3H", [
        {"code": "BRANCHE",  "values": list(SECTOR_CODES.values())},
        {"code": "ENERGI1",  "values": list(FUEL_CODES.values())},
        {"code": "Tid",      "values": ["*"]},
    ])

    # Parse into {sector: {fuel: {year: GJ}}}
    cube = {s: {f: {} for f in FUEL_CODES} for s in SECTOR_CODES}
    for row in rows:
        period      = (row.get("TID")     or "").strip()
        sector_lbl  = (row.get("BRANCHE") or "").strip()
        fuel_lbl    = (row.get("ENERGI1") or "").strip()
        val         = (row.get("INDHOLD") or "").strip()
        sname = sector_label_to_name.get(sector_lbl)
        fname = fuel_label_to_name.get(fuel_lbl)
        if not period or not sname or not fname:
            continue
        try:
            cube[sname][fname][period] = float(val.replace(",", "."))
        except ValueError:
            continue

    # Build per-sector fossil/renewable aggregates
    sector_summaries = {}
    for sname, fuels in cube.items():
        all_years = sorted({y for f in fuels.values() for y in f})
        fossil  = {y: sum(fuels[f].get(y, 0.0) for f in FOSSIL_KEYS)  for y in all_years}
        renew   = {y: sum(fuels[f].get(y, 0.0) for f in RENEWABLE_KEYS) for y in all_years}
        sector_summaries[sname] = {
            "fossil_total":    fossil,
            "renewable_total": renew,
            "by_fuel":         fuels,
        }

    # Headline series = total-sector fossil consumption (the thing to shrink)
    headline = sector_summaries.get("total", {}).get("fossil_total", {})

    breakdown = {"by_sector": sector_summaries}
    return write_json("energy_by_sector", "ENE3H",
                      "Energy consumption by sector and fuel type",
                      "GJ", headline, breakdown=breakdown)


FETCHERS = [
    fetch_population, fetch_life_expectancy, fetch_unemployment,
    fetch_income, fetch_gdp, fetch_education, fetch_ghg, fetch_energy,
    fetch_climate_footprint, fetch_material_flow,
    fetch_water_abstraction, fetch_green_gva, fetch_energy_mix,
    fetch_energy_by_sector,
]


def run_all():
    print("Fetching Denmark metrics from Danmarks Statistik...\n")
    ok = 0
    for fn in FETCHERS:
        try:
            if fn():
                ok += 1
        except Exception as e:  # noqa: BLE001 - PoC: report and continue
            print(f"  [ERR] {fn.__name__}: {e}")
    print(f"\nDone. {ok}/{len(FETCHERS)} metrics written to {DATA_DIR}")


def main():
    ap = argparse.ArgumentParser(description="Danmarks Statistik fetcher")
    ap.add_argument("--discover-subject", metavar="ID",
                    help="list tables under a subject id")
    ap.add_argument("--discover-table", metavar="TABLE",
                    help="show variables + value codes for a table")
    args = ap.parse_args()

    if args.discover_subject:
        discover_subject(args.discover_subject)
    elif args.discover_table:
        discover_table(args.discover_table)
    else:
        run_all()


if __name__ == "__main__":
    sys.exit(main())
