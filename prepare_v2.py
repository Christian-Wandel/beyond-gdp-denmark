"""Derive the aggregates the 2.0 decision dashboard reads. No API calls.

Reads data/*.json (incl. data/dst_v2_*.json from fetch_dst_v2.py) and
data/unified/denmark_wide.json. Writes data/v2/{eco,edu,soc,indicators}.json.

    python prepare_v2.py          # build
    python prepare_v2.py --test   # self-tests on the calc helpers
"""

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent
DATA = ROOT / "data"
OUT = DATA / "v2"

TARGET_YEAR = 2030
KLIMALOVEN_CUT = 0.70  # 70 % below 1990, territorial incl. LULUCF
TREND_YEARS = 10


# ── Calc helpers (pure) ─────────────────────────────────────────────────────

def norm_score(val, direction, a):
    """Port of js/zones.js normScore. 0-100, None for neutral/missing."""
    if val is None:
        return None
    if direction == "higher_better":
        if val <= a["bad"]:
            return 0.0
        if val <= a["mid"]:
            return 50 * (val - a["bad"]) / (a["mid"] - a["bad"])
        if val <= a["good"]:
            return 50 + 50 * (val - a["mid"]) / (a["good"] - a["mid"])
        return 100.0
    if direction == "lower_better":
        if val <= a["good"]:
            return 100.0
        if val <= a["mid"]:
            return 50 + 50 * (a["mid"] - val) / (a["mid"] - a["good"])
        if val <= a["bad"]:
            return 50 * (a["bad"] - val) / (a["bad"] - a["mid"])
        return 0.0
    return None


def score_level(score):
    if score is None:
        return "gray"
    return "green" if score >= 67 else "amber" if score >= 33 else "red"


def cagr(v0, v1, years):
    """Compound annual rate, as a fraction (−0.05 = −5 %/yr)."""
    if years <= 0 or v0 is None or v1 is None or v0 <= 0 or v1 <= 0:
        return None
    return (v1 / v0) ** (1 / years) - 1


def pace(series, target, target_year=TARGET_YEAR, trend_years=TREND_YEARS):
    """Required vs actual pace toward a target.

    Returns the compound rate needed from the latest year to the target year,
    the trailing compound rate, their ratio, and a linear projection at the
    trailing rate.
    """
    ys = sorted(int(y) for y in series)
    y1 = ys[-1]
    y0 = max(y for y in ys if y <= y1 - trend_years) if ys[0] <= y1 - trend_years else ys[0]
    v1, v0 = series[str(y1)], series[str(y0)]
    req = cagr(v1, target, target_year - y1)
    act = cagr(v0, v1, y1 - y0)
    projected = v1 * (1 + act) ** (target_year - y1) if act is not None else None
    # Ratio only makes sense when both go the same direction.
    factor = req / act if req and act and (req * act) > 0 else None
    return {
        "latest_year": y1, "latest": v1, "trend_from": y0,
        "target": target, "target_year": target_year,
        "required_rate": req, "actual_rate": act,
        "acceleration": factor, "projected_at_target_year": projected,
        "required_path": {str(y): v1 * (1 + req) ** (y - y1)
                          for y in range(y1, target_year + 1)} if req is not None else {},
    }


def annual_changes(series):
    """Year-on-year % changes, keyed by the later year."""
    ys = sorted(int(y) for y in series)
    out = {}
    for a, b in zip(ys, ys[1:]):
        if b == a + 1 and series[str(a)]:
            out[str(b)] = 100 * (series[str(b)] / series[str(a)] - 1)
    return out


def share_at_least(changes, required_pct):
    """How many past years moved as fast as required (same sign direction)."""
    vals = list(changes.values())
    if required_pct < 0:
        hit = sum(1 for v in vals if v <= required_pct)
    else:
        hit = sum(1 for v in vals if v >= required_pct)
    return hit, len(vals)


def histogram(values, n_bins=12, lo=None, hi=None):
    lo = min(values) if lo is None else lo
    hi = max(values) if hi is None else hi
    w = (hi - lo) / n_bins or 1
    counts = [0] * n_bins
    for v in values:
        counts[min(int((v - lo) / w), n_bins - 1)] += 1
    return [{"from": lo + i * w, "to": lo + (i + 1) * w, "count": c}
            for i, c in enumerate(counts)]


def _logmean(a, b):
    if a == b:
        return a
    return (a - b) / (math.log(a) - math.log(b))


def lmdi(c0, c1, factors0, factors1):
    """Additive LMDI-I. C = product of factors. Terms sum to c1 - c0 exactly."""
    L = _logmean(c1, c0)
    return {k: L * math.log(factors1[k] / factors0[k]) for k in factors0}


def waterfall(start, end, parts):
    """Start bar, one bar per part, a residual so bars close on end."""
    resid = end - start - sum(parts.values())
    steps = dict(parts)
    if abs(resid) > 1e-9:
        steps["other_residual"] = resid
    return {"start": start, "end": end, "steps": steps}


# ── IO ──────────────────────────────────────────────────────────────────────

def load(name):
    return json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))


def dnk(name):
    return load(name)["data"]["DNK"]


def write(name, obj):
    OUT.mkdir(parents=True, exist_ok=True)
    obj = {"_generated": datetime.now(timezone.utc).strftime("%Y-%m-%d"), **obj}
    (OUT / f"{name}.json").write_text(
        json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  [ok] data/v2/{name}.json")


def r(x, sig=6):
    """Round floats to significant figures (rates are small fractions)."""
    if isinstance(x, dict):
        return {k: r(v, sig) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [r(v, sig) for v in x]
    if isinstance(x, float) and x != 0 and math.isfinite(x):
        return round(x, sig - 1 - int(math.floor(math.log10(abs(x)))))
    return x


def first_year(key):
    """'2024:2025' -> '2024' (HISBR cohort keys)."""
    return key.split(":")[0]


# ── Ecological limits ───────────────────────────────────────────────────────

def energy_supply():
    """Domestic energy supply, PJ, without the crude-oil double count.

    ENE2HO lists crude oil (refinery input) and the refined products made
    from it, so the published total counts that oil twice. Crude is dropped.
    """
    bd = dnk("dst_energy_mix")["breakdown"]
    fossil, ren, crude = bd["fossil_total"], bd["renewable_total"], bd["by_fuel"]["crude_oil"]
    supply, share = {}, {}
    for y in fossil:
        f = fossil[y] - crude.get(y, 0.0)
        total = f + ren.get(y, 0.0)
        if total > 0:
            supply[y] = total / 1e6
            share[y] = 100 * ren.get(y, 0.0) / total
    return supply, share


def energy_co2(year):
    """CO2 from fuel use (Mt) with fixed DEA 2024 coefficients, crude excluded."""
    coef = load("emission_coefficients")["coefficients"]
    fuels = dnk("dst_energy_mix")["breakdown"]["by_fuel"]
    t = 0.0
    for f, s in fuels.items():
        if f == "crude_oil" or f not in coef:
            continue
        if coef[f].get("fuel_type") == "fossil":
            t += s.get(year, 0.0) * coef[f]["tCO2e_per_GJ"]
    return t / 1e6


def build_eco():
    mro = dnk("dst_v2_mro2")
    items = mro["breakdown"]["by_item_gas"]
    terr = {y: v / 1000 for y, v in items["TOTLULU"]["GHGEXBIO"].items()}  # Mt
    base = terr["1990"]
    target = base * (1 - KLIMALOVEN_CUT)
    latest_y = max(terr, key=int)
    reduction = {y: 100 * (1 - v / base) for y, v in terr.items()}

    p = pace(terr, target)
    changes = annual_changes(terr)
    req_pct = 100 * p["required_rate"]
    hit, n = share_at_least(changes, req_pct)

    def bridge(y):
        g = lambda k: items[k]["GHGEXBIO"][y] / 1000
        return {"national_accounts": g("DSTTOTAL"), "abroad_bunkers": -g("BUNKSUM"),
                "abroad_ships": -g("BUNKSKIB"), "abroad_planes": -g("BUNKFLY"),
                "abroad_road": -g("BUNKLAND"), "other_transport_diff": -g("ANTRANS"),
                "territorial": g("DKTOTAL"), "lulucf": g("LULUCF"),
                "territorial_incl_lulucf": g("TOTLULU")}

    gases = {g: {y: v / 1000 for y, v in items["DKTOTAL"][g].items()}
             for g in ["CO2UBIO", "CH4", "N2O", "FGAS"]}

    dr = dnk("dst_v2_drivhus2")["breakdown"]
    sectors = {g: {y: v / 1000 for y, v in s.items()} for g, s in dr["by_group"].items()}
    mtot = {y: v / 1000 for y, v in dnk("dst_v2_drivhus2")["series"].items()}
    # Danish ships and planes abroad sit in transport (VH). Split them out with
    # MRO2 so the sector chart is not dominated by international shipping.
    abroad = {y: (items["BUNKSKIB"]["GHGEXBIO"][y] + items["BUNKFLY"]["GHGEXBIO"][y]) / 1000
              for y in items["BUNKSKIB"]["GHGEXBIO"]}
    sectors["transport"] = {y: v - abroad[y] for y, v in sectors["transport"].items() if y in abroad}
    sectors["ships_planes_abroad"] = abroad
    home = {y: mtot[y] - abroad[y] for y in abroad}
    sector_wf = waterfall(home["1990"], home[latest_y],
                          {g: s[latest_y] - s["1990"] for g, s in sectors.items()
                           if g != "ships_planes_abroad"})

    # Kaya-lite: energy CO2 = GDP x (E/GDP) x (CO2/E), LMDI 1990 -> 2024.
    gdp = dnk("dst_gdp")["series"]
    supply, ren_share = energy_supply()
    kaya = {}
    for y0, y1 in [("1990", "2024"), ("2015", "2024")]:
        f = {}
        for y in (y0, y1):
            c, e, q = energy_co2(y), supply[y], gdp[y]
            f[y] = {"c": c, "gdp": q, "energy_intensity": e / q, "carbon_intensity": c / e}
        terms = lmdi(f[y0]["c"], f[y1]["c"],
                     {k: f[y0][k] for k in ("gdp", "energy_intensity", "carbon_intensity")},
                     {k: f[y1][k] for k in ("gdp", "energy_intensity", "carbon_intensity")})
        kaya[f"{y0}-{y1}"] = {"co2_start": f[y0]["c"], "co2_end": f[y1]["c"],
                              "terms": terms, "factors": f}

    sc = load("scenarios")
    gap = terr[latest_y] - target
    levers = sorted(
        ({"id": k, "label": v["label"], "mt": -v["delta_tco2e"] / 1e6,
          "share_of_gap": -v["delta_tco2e"] / 1e6 / gap}
         for k, v in sc.items() if k != "klimaloven_2030_combined"),
        key=lambda x: -x["mt"])
    combined = sc["klimaloven_2030_combined"]

    fp = dnk("dst_climate_footprint")
    write("eco", r({
        "hero": {
            "label": "Territorial GHG incl. LULUCF vs the Klimaloven 70 % target",
            "unit": "Mt CO2-eq", "base_year": 1990, "base": base,
            "target": target, "target_year": TARGET_YEAR,
            "latest_year": int(latest_y), "latest": terr[latest_y],
            "reduction_pct": reduction[latest_y], "target_reduction_pct": 100 * KLIMALOVEN_CUT,
            "gap_mt": gap, "series": terr, "reduction_series": reduction,
            "source": "DST MRO2 (TOTLULU, GHGEXBIO)",
        },
        "pace": {**p, "required_pct": req_pct, "actual_pct": 100 * p["actual_rate"],
                 "annual_changes": changes, "years_as_fast": hit, "years_total": n,
                 "histogram": histogram(list(changes.values()), 10)},
        "bridge": {"1990": bridge("1990"), latest_y: bridge(latest_y),
                   "note": "National accounts include Danish ships and planes abroad; "
                           "the Klimaloven target counts territory only."},
        "gases": {"series": gases, "latest": {g: s[latest_y] for g, s in gases.items()},
                  "basis": "territorial excl. LULUCF (MRO2 DKTOTAL)"},
        "sectors": {"series": sectors, "total": mtot, "total_excl_abroad": home,
                    "waterfall_1990_2024": sector_wf,
                    "basis": "national-accounts basis, direct emissions (DST DRIVHUS2); "
                             "ships and planes abroad split out with MRO2"},
        "kaya": {**kaya, "basis": "energy CO2 from DST ENE2HO fuels x DEA 2024 "
                 "coefficients, crude oil excluded, power imports not counted"},
        "renewable_share": ren_share, "energy_supply_pj": supply,
        "footprint_pc": _wide_series("climate_footprint_pc"),
        "footprint_split": fp.get("breakdown"),
        "levers": {"items": levers, "gap_mt": gap,
                   "combined": {"label": combined["label"],
                                "mt": -combined["delta_tco2e"] / 1e6},
                   "missing": "No lever covers agricultural methane and nitrous oxide.",
                   "basis": "scenarios.json, energy-use model, 2024 fuel mix"},
    }))


# ── Education ───────────────────────────────────────────────────────────────

def build_edu():
    neet = dnk("dst_v2_neet4")
    rs = neet["breakdown"]["by_region_sex"]
    latest = max(neet["series"], key=int)
    p = pace(neet["series"], 6.0)
    changes = annual_changes(neet["series"])
    hit, n = share_at_least(changes, 100 * p["required_rate"])

    sh = dnk("dst_education_share")
    tert = sh["series"]
    up = sh["breakdown"]["upper_secondary_plus_share"]
    attain = {y: {"below_upper_secondary": 100 - up[y],
                  "upper_secondary": up[y] - tert[y], "tertiary": tert[y]}
              for y in tert if y in up}

    # Funding per pupil = spend / pupils (real). Log split of the change.
    fb = dnk("dst_folkeskole_funding")["breakdown"]
    spend = {y: fb["spend_mio_kr_nominal"][y] * fb["deflator_to_2024"][y]
             for y in fb["spend_mio_kr_nominal"] if y in fb["deflator_to_2024"]}
    pupils = fb["public_grundskole_pupils"]
    ys = sorted(set(spend) & set(pupils), key=int)
    y0, y1 = ys[0], ys[-1]
    pp0, pp1 = spend[y0] * 1e6 / pupils[y0], spend[y1] * 1e6 / pupils[y1]
    split = lmdi(pp0, pp1, {"more_money": spend[y0], "fewer_pupils": 1 / pupils[y0]},
                 {"more_money": spend[y1], "fewer_pupils": 1 / pupils[y1]})

    write("edu", r({
        "hero": {"label": "NEET rate, 16-24", "unit": "percent", "good": 6.0,
                 "latest_year": int(latest), "latest": neet["series"][latest],
                 "series": neet["series"], "source": "DST NEET4 (ages 16-24 summed)"},
        "pace": {**p, "required_pct": 100 * p["required_rate"],
                 "actual_pct": 100 * p["actual_rate"] if p["actual_rate"] else None,
                 "annual_changes": changes, "years_as_fast": hit, "years_total": n,
                 "target_note": "Target = 'good' anchor (6 %); 2030 horizon is illustrative."},
        "regions": {"latest_year": int(latest),
                    "names": {"000": "Denmark", "084": "Hovedstaden", "085": "Sjælland",
                              "083": "Syddanmark", "082": "Midtjylland", "081": "Nordjylland"},
                    "values": {a: {s: v[latest] for s, v in sx.items()} for a, sx in rs.items()},
                    "series": rs},
        "attainment": {"series": attain, "latest": attain[max(attain, key=int)]},
        "funding_split": {"from": int(y0), "to": int(y1), "per_pupil_start": pp0,
                          "per_pupil_end": pp1, "terms": split,
                          "unit": "DKK per pupil, 2024 prices"},
    }))


# ── Societal foundations ────────────────────────────────────────────────────

SOC_COMPONENTS = ["life_expectancy", "income", "gini", "unemployment", "health", "social_trust"]
SOC_GOOD = 67.0  # lower edge of the green band of the summary index (not a target)


def _wide():
    return load("unified/denmark_wide")


def _wide_series(ind):
    w = _wide()
    return {y: row[ind] for y, row in w.items() if row.get(ind) is not None}


def deflate(series, cpi, base_year):
    """Nominal -> real in base_year prices. Years without a CPI value drop out."""
    return {y: v * cpi[base_year] / cpi[y] for y, v in series.items() if y in cpi}


def real_income():
    """INDKP101 is nominal; the income anchors are fixed kr, so score in real kr."""
    inc = _wide_series("income")
    return deflate(inc, dnk("dst_v2_cpi")["series"], max(inc, key=int))


def full_year_unemployment():
    """AKU111K is quarterly; the wide table averages partial years too. Keep 4-quarter years."""
    q = {}
    for k, v in dnk("dst_unemployment")["series"].items():
        q.setdefault(k[:4], []).append(v)
    return {y: sum(v) / 4 for y, v in q.items() if len(v) == 4}


def series_for(ind):
    if ind == "income":
        return real_income()
    if ind == "unemployment":
        return full_year_unemployment()
    return _wide_series(ind)


def component_scores(meta, ids):
    out = {}
    for i in ids:
        s = series_for(i)
        out[i] = {y: norm_score(v, meta[i]["direction"], meta[i]["anchors"]) for y, v in s.items()}
    return out


def mean_score(comp, ids, min_n):
    years = set().union(*(comp[i].keys() for i in ids))
    out = {}
    for y in years:
        sc = [comp[i][y] for i in ids if comp[i].get(y) is not None]
        if len(sc) >= min_n:
            out[y] = {"score": sum(sc) / len(sc), "n": len(sc)}
    return dict(sorted(out.items(), key=lambda kv: int(kv[0])))


def build_soc():
    meta = load("indicator_meta")["indicators"]
    comp = component_scores(meta, SOC_COMPONENTS)
    composite = mean_score(comp, SOC_COMPONENTS, 4)
    hy = max((y for y, v in composite.items() if v["n"] == len(SOC_COMPONENTS)), key=int)

    gm = dnk("dst_v2_gini_municipal")["breakdown"]
    latest = max(dnk("dst_v2_gini_municipal")["series"], key=int)
    names = gm["names"]
    mun = {c: s[latest] for c, s in gm["by_municipality"].items()
           if c != "000" and latest in s}
    vals = list(mun.values())

    dec = dnk("dst_v2_income_deciles")["breakdown"]["by_decile"]
    dlat = max(dec["1DC"], key=int)

    le = dnk("dst_v2_life_exp_region")["breakdown"]
    lk = max(le["by_region_sex"]["000"]["TOT"], key=lambda k: int(first_year(k)))

    write("soc", r({
        "hero": {"label": "Societal foundations score (0-100)",
                 "components": SOC_COMPONENTS, "series": composite,
                 "latest_year": int(hy), "latest": composite[hy]["score"], "good": SOC_GOOD,
                 "component_scores": {i: comp[i][hy] for i in SOC_COMPONENTS},
                 "bands": {"red": [0, 33], "amber": [33, 67], "green": [67, 100]},
                 "note": "Mean of normalised components available that year (min 4). "
                         "Income in real kr (CPI PRIS113, latest-year prices)."},
        "components": {"scores": comp},
        "income": {"nominal": _wide_series("income"), "real": real_income(),
                   "base_year": int(max(_wide_series("income"), key=int)),
                   "deflator": "CPI, DST PRIS113 annual mean"},
        "gini_municipal": {
            "year": int(latest), "national": gm["by_municipality"]["000"][latest],
            "good": meta["gini"]["anchors"]["good"],
            "values": {names.get(c, c): v for c, v in mun.items()},
            "histogram": histogram(vals, 10), "n": len(vals),
            "min": min(mun.items(), key=lambda kv: kv[1]),
            "max": max(mun.items(), key=lambda kv: kv[1])},
        "income_deciles": {"year": int(dlat), "values": {k: s[dlat] for k, s in dec.items()},
                           "top_bottom_ratio": dec["10DC"][dlat] / dec["1DC"][dlat]},
        "life_expectancy_region": {
            "period": lk, "names": le["names"],
            "values": {a: {s: v[lk] for s, v in sx.items()}
                       for a, sx in le["by_region_sex"].items()}},
    }))


# ── All indicators: status x momentum ───────────────────────────────────────

THEMES = {
    "ecological": ["climate_footprint_pc", "material_flow_pc", "water_abstraction", "green_gva"],
    "societal": ["life_expectancy", "income", "gini", "unemployment", "health", "social_trust"],
    "education": ["neet", "learning_outcomes", "life_satisfaction", "transition",
                  "class_size", "education_share", "folkeskole_funding"],
}
MOMENTUM_YEARS = 5


def build_indicators():
    meta = load("indicator_meta")["indicators"]
    out = []
    for theme, inds in THEMES.items():
        for i in inds:
            s = series_for(i)
            if i == "neet":  # NEET4 adds 2024
                s = {**s, **dnk("dst_v2_neet4")["series"]}
            if not s:
                continue
            m = meta[i]
            y1 = max(s, key=int)
            prev = [y for y in s if int(y) <= int(y1) - MOMENTUM_YEARS]
            y0 = max(prev, key=int) if prev else min(s, key=int)
            sc1 = norm_score(s[y1], m["direction"], m["anchors"])
            sc0 = norm_score(s[y0], m["direction"], m["anchors"])
            out.append({
                "id": i, "theme": theme, "label": m["label"],
                "unit": "DKK, latest-year prices" if i == "income" else m["unit"],
                "direction": m["direction"], "anchors": m["anchors"],
                "latest_year": int(y1), "latest": s[y1], "score": sc1,
                "level": score_level(sc1), "momentum_from": int(y0),
                "momentum": (sc1 - sc0) if sc1 is not None and sc0 is not None else None,
                "series": s,
            })
    # Renewable share is new in 2.0 and has no meta anchors; kept out of scoring.
    write("indicators", r({"indicators": out, "momentum_years": MOMENTUM_YEARS}))


# ── Self-tests ──────────────────────────────────────────────────────────────

def _test():
    # LMDI terms sum exactly to the total change.
    t = lmdi(100.0, 60.0, {"a": 10, "b": 2, "c": 5}, {"a": 14, "b": 1.5, "c": 2.857142857})
    assert abs(sum(t.values()) - (60.0 - 100.0)) < 1e-6, t
    # Waterfall closes on the end value.
    w = waterfall(50, 40, {"x": -6, "y": -3})
    assert abs(w["start"] + sum(w["steps"].values()) - w["end"]) < 1e-9
    # Pace: halve in 6 years from latest.
    p = pace({"2014": 100.0, "2024": 80.0}, 40.0)
    assert abs((1 + p["required_rate"]) ** 6 - 0.5) < 1e-9
    assert abs(p["required_path"]["2030"] - 40.0) < 1e-9
    assert abs((1 + p["actual_rate"]) ** 10 - 0.8) < 1e-9
    # Scoring matches zones.js thresholds.
    a = {"good": 6, "mid": 10, "bad": 18}
    assert norm_score(6, "lower_better", a) == 100 and norm_score(18, "lower_better", a) == 0
    assert norm_score(10, "lower_better", a) == 50 and score_level(66.9) == "amber"
    hit, n = share_at_least({"1": -5, "2": -1, "3": 2}, -3)
    assert (hit, n) == (1, 3)
    # Deflating keeps the base year and lowers earlier years when prices rose.
    d = deflate({"2020": 100.0, "2024": 120.0}, {"2020": 80.0, "2024": 100.0}, "2024")
    assert d["2024"] == 120.0 and abs(d["2020"] - 125.0) < 1e-9
    # Composite mean respects the minimum component count.
    m = mean_score({"a": {"1": 40.0, "2": 60.0}, "b": {"2": 80.0}}, ["a", "b"], 2)
    assert list(m) == ["2"] and m["2"]["score"] == 70.0
    print("prepare_v2 self-tests: all passed")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", action="store_true")
    if ap.parse_args().test:
        _test()
        return
    build_eco()
    build_edu()
    build_soc()
    build_indicators()


if __name__ == "__main__":
    sys.exit(main())
