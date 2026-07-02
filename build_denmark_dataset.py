"""Beyond GDP Denmark — Unified dataset builder.

Reads the seven dst_*.json series files + HLEG benchmark snapshots and produces
a unified, annually-aligned dataset ready for the policy simulator.

Usage:
    python build_denmark_dataset.py             # build all → data/unified/
    python build_denmark_dataset.py --test      # run self-tests only
    python build_denmark_dataset.py --verbose   # show per-year detail

Outputs (data/unified/):
    denmark_long.json        tidy list: [{indicator, year, value, value_norm, unit}]
    denmark_wide.json        {year: {indicator: value}} matrix (raw)
    denmark_wide_norm.json   {year: {indicator: value_norm}} matrix (0-100)
    benchmarks.json          HLEG single-point benchmarks for DNK (separate from spine)
    manifest.json            per-indicator metadata + coverage stats
"""

import argparse
import json
import re
import sys
from pathlib import Path

ROOT       = Path(__file__).parent
DATA_DIR   = ROOT / "data"
OUT_DIR    = DATA_DIR / "unified"
META_FILE  = DATA_DIR / "indicator_meta.json"
HLEG_DATA  = ROOT.parent / "Beyond GDP HLEG" / "data"

# ── Year-key normalisation ───────────────────────────────────────────────────

_RE_ANNUAL   = re.compile(r"^\d{4}$")
_RE_QUARTERLY = re.compile(r"^(\d{4})K([1-4])$")
_RE_COHORT   = re.compile(r"^(\d{4}):\d{4}$")


def _period_to_year(key: str) -> int | None:
    """Map a DST period key to an integer year, or None if unrecognised.

    Three formats handled:
      "2024"       → 2024  (annual)
      "2024K1"     → 2024  (quarterly — year extracted, quarter discarded)
      "2024:2025"  → 2024  (biennial cohort — first year used as canonical)
    """
    if _RE_ANNUAL.match(key):
        return int(key)
    m = _RE_QUARTERLY.match(key)
    if m:
        return int(m.group(1))
    m = _RE_COHORT.match(key)
    if m:
        return int(m.group(1))
    return None


def _collapse_quarterly(raw_series: dict, collapse: str) -> dict[int, float]:
    """Aggregate quarterly {period: value} → {year: value}.

    collapse="year_end"  → Q4 value (or last available quarter)
    collapse="mean"      → mean of all quarters present in that year
    """
    by_year: dict[int, list[float]] = {}
    by_year_q: dict[int, dict[int, float]] = {}
    for key, val in raw_series.items():
        m = _RE_QUARTERLY.match(key)
        if not m:
            continue
        yr, q = int(m.group(1)), int(m.group(2))
        by_year.setdefault(yr, []).append(val)
        by_year_q.setdefault(yr, {})[q] = val

    result = {}
    if collapse == "year_end":
        for yr, q_map in by_year_q.items():
            max_q = max(q_map)
            result[yr] = q_map[max_q]
    else:  # mean
        for yr, vals in by_year.items():
            result[yr] = round(sum(vals) / len(vals), 4)
    return result


def _collapse_cohort(raw_series: dict) -> dict[int, float]:
    """Map biennial cohort series → {first_year: value}."""
    result = {}
    for key, val in raw_series.items():
        m = _RE_COHORT.match(key)
        if m:
            result[int(m.group(1))] = val
    return result


def _to_annual(raw_series: dict, granularity: str, collapse: str | None) -> dict[int, float]:
    """Convert any DST series to {year: value}."""
    if granularity == "annual":
        return {int(k): v for k, v in raw_series.items() if _RE_ANNUAL.match(k)}
    if granularity == "quarterly_to_annual":
        return _collapse_quarterly(raw_series, collapse or "mean")
    if granularity == "biennial_cohort":
        return _collapse_cohort(raw_series)
    raise ValueError(f"Unknown granularity: {granularity!r}")


# ── Normalization (ported from HLEG js/core.js normHigh / normLow) ───────────

def norm_high(val, bad, mid, good) -> float | None:
    """Higher values are better. Returns 0-100."""
    if val is None:
        return None
    if val <= bad:
        return 0.0
    if val <= mid:
        return 50.0 * (val - bad) / (mid - bad)
    if val <= good:
        return 50.0 + 50.0 * (val - mid) / (good - mid)
    return 100.0


def norm_low(val, good, mid, bad) -> float | None:
    """Lower values are better. Returns 0-100."""
    if val is None:
        return None
    if val <= good:
        return 100.0
    if val <= mid:
        return 50.0 + 50.0 * (mid - val) / (mid - good)
    if val <= bad:
        return 50.0 * (bad - val) / (bad - mid)
    return 0.0


def normalize(val, direction: str, anchors: dict) -> float | None:
    """Dispatch to norm_high or norm_low based on direction."""
    if direction == "higher_better":
        return norm_high(val, anchors["bad"], anchors["mid"], anchors["good"])
    if direction == "lower_better":
        return norm_low(val, anchors["good"], anchors["mid"], anchors["bad"])
    return None  # neutral — not normalized


def _round_norm(v) -> float | None:
    return round(v, 2) if v is not None else None


# ── Inline self-tests (stdlib assert, --test flag) ───────────────────────────

def _run_self_tests():
    errors = []

    # Year-key normalisation
    cases = [
        ("2024",      2024),
        ("2008",      2008),
        ("2024K1",    2024),
        ("2024K4",    2024),
        ("2019K2",    2019),
        ("2024:2025", 2024),
        ("1981:1982", 1981),
        ("badkey",    None),
        ("2024K5",    None),
    ]
    for key, expected in cases:
        got = _period_to_year(key)
        if got != expected:
            errors.append(f"_period_to_year({key!r}) = {got}, want {expected}")

    # Quarterly collapse — year_end
    raw_q = {"2020K1": 10.0, "2020K2": 11.0, "2020K3": 12.0, "2020K4": 13.0,
             "2021K1": 14.0, "2021K2": 15.0}
    ye = _collapse_quarterly(raw_q, "year_end")
    if ye.get(2020) != 13.0:
        errors.append(f"year_end 2020 = {ye.get(2020)}, want 13.0")
    if ye.get(2021) != 15.0:
        errors.append(f"year_end 2021 = {ye.get(2021)}, want 15.0")

    # Quarterly collapse — mean
    mn = _collapse_quarterly(raw_q, "mean")
    if abs(mn.get(2020, 0) - 11.5) > 0.01:
        errors.append(f"mean 2020 = {mn.get(2020)}, want 11.5")

    # Biennial cohort
    raw_c = {"1981:1982": 74.41, "2024:2025": 82.08}
    coh = _collapse_cohort(raw_c)
    if coh.get(1981) != 74.41:
        errors.append(f"cohort 1981 = {coh.get(1981)}, want 74.41")
    if coh.get(2024) != 82.08:
        errors.append(f"cohort 2024 = {coh.get(2024)}, want 82.08")

    # norm_high
    assert abs(norm_high(50, 0, 50, 100) - 50.0) < 0.01, "norm_high midpoint"
    assert norm_high(-1, 0, 50, 100) == 0.0, "norm_high below bad"
    assert norm_high(200, 0, 50, 100) == 100.0, "norm_high above good"

    # norm_low
    assert abs(norm_low(50, 0, 50, 100) - 50.0) < 0.01, "norm_low midpoint"
    assert norm_low(-1, 0, 50, 100) == 100.0, "norm_low below good"
    assert norm_low(200, 0, 50, 100) == 0.0, "norm_low above bad"

    if errors:
        for e in errors:
            print(f"  FAIL: {e}", file=sys.stderr)
        sys.exit(1)
    print("All self-tests passed.")


# ── Data loading ─────────────────────────────────────────────────────────────

def load_meta() -> dict:
    return json.loads(META_FILE.read_text(encoding="utf-8"))


def load_dst_series(meta: dict) -> dict[str, dict[int, float]]:
    """Load all DST files → {indicator_id: {year: value}}.

    Skips derived indicators (e.g. climate_footprint_pc, material_flow_pc) that
    have no source file; those are computed by derive_per_capita() afterward.
    """
    result = {}
    for ind_id, ind_meta in meta["indicators"].items():
        if ind_meta.get("source", "").endswith("(derived)"):
            continue  # skip derived — populated by derive_per_capita()
        # Series files carry a source prefix: dst_ (Danmarks Statistik) or
        # uddx_ (uddannelsesstatistik.dk). Try both.
        path = DATA_DIR / f"dst_{ind_id}.json"
        if not path.exists():
            path = DATA_DIR / f"uddx_{ind_id}.json"
        if not path.exists():
            print(f"  [warn] dst_/uddx_{ind_id}.json not found — skipping {ind_id}", file=sys.stderr)
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        raw_series = data["data"]["DNK"].get("series", {})
        annual = _to_annual(raw_series, ind_meta["granularity"], ind_meta.get("collapse"))
        result[ind_id] = annual
    return result


def derive_per_capita(series: dict[str, dict[int, float]]) -> dict[str, dict[int, float]]:
    """Compute per-capita derived indicators from loaded series.

    Requires 'population' and the base total series to already be loaded.
    Returns a dict of new derived series to merge into the main series.
    """
    derived = {}
    pop = series.get("population", {})
    if not pop:
        print("  [warn] population series not loaded; cannot derive per-capita indicators",
              file=sys.stderr)
        return derived

    # climate_footprint_pc: tonnes CO2-eq / person
    if "climate_footprint" in series:
        pc = {}
        for yr, total in series["climate_footprint"].items():
            if yr in pop and pop[yr]:
                pc[yr] = round(total / pop[yr], 4)
        derived["climate_footprint_pc"] = pc
        print(f"  [derived] climate_footprint_pc  {len(pc)} years")

    # material_flow_pc: tonnes DMC / person
    if "material_flow" in series:
        pc = {}
        for yr, total in series["material_flow"].items():
            if yr in pop and pop[yr]:
                pc[yr] = round(total / pop[yr], 4)
        derived["material_flow_pc"] = pc
        print(f"  [derived] material_flow_pc      {len(pc)} years")

    return derived


def load_hleg_benchmarks(meta: dict) -> dict:
    """Load HLEG single-point DNK values for benchmark indicators."""
    benchmarks = {}
    for ind_id, ind_meta in meta["benchmark_indicators"].items():
        fname = ind_meta["source"].replace("HLEG ", "").replace(".json", "") + ".json"
        path = HLEG_DATA / fname
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        dnk = data.get("data", {}).get("DNK")
        if dnk is None:
            continue
        value_field = ind_meta.get("value_field", "value")
        # Compute global median from all country values for context
        all_vals = [e[value_field] for e in data["data"].values()
                    if isinstance(e, dict) and e.get(value_field) is not None]
        all_vals.sort()
        n = len(all_vals)
        global_median = all_vals[n // 2] if n else None

        score = normalize(dnk[value_field], ind_meta["direction"], ind_meta["anchors"])
        benchmarks[ind_id] = {
            "label": ind_meta["label"],
            "unit": ind_meta["unit"],
            "direction": ind_meta["direction"],
            "value": dnk[value_field],
            "year": dnk.get("year"),
            "value_norm": _round_norm(score),
            "global_median": round(global_median, 4) if global_median else None,
            "country_count": n,
            "source": ind_meta["source"],
        }
    return benchmarks


# ── Assembly ──────────────────────────────────────────────────────────────────

def assemble(series: dict[str, dict[int, float]], meta: dict, verbose: bool = False):
    """Build wide and long tables from the aligned annual series."""
    all_years = sorted({yr for s in series.values() for yr in s})

    wide = {}        # {year: {indicator: raw_value | None}}
    wide_norm = {}   # {year: {indicator: norm_value | None}}
    long = []

    for yr in all_years:
        wide[yr] = {}
        wide_norm[yr] = {}
        for ind_id, annual in series.items():
            val = annual.get(yr)
            ind_meta = meta["indicators"][ind_id]
            direction = ind_meta.get("direction", "neutral")
            anchors = ind_meta.get("anchors", {})
            norm = normalize(val, direction, anchors) if val is not None else None
            wide[yr][ind_id] = val
            wide_norm[yr][ind_id] = _round_norm(norm)
            long.append({
                "indicator": ind_id,
                "year": yr,
                "value": val,
                "value_norm": _round_norm(norm),
                "unit": ind_meta["unit"],
            })

        if verbose:
            row_strs = [f"{k}={wide[yr][k]}" for k in series if wide[yr][k] is not None]
            print(f"  {yr}: {', '.join(row_strs[:4])}{'...' if len(row_strs) > 4 else ''}")

    return long, wide, wide_norm


def build_manifest(series: dict, meta: dict, benchmarks: dict) -> list:
    entries = []
    for ind_id, annual in series.items():
        ind_meta = meta["indicators"][ind_id]
        years = sorted(annual.keys())
        entries.append({
            "id": ind_id,
            "label": ind_meta["label"],
            "unit": ind_meta["unit"],
            "direction": ind_meta["direction"],
            "anchors": ind_meta.get("anchors"),
            "source": ind_meta["source"],
            "granularity_raw": ind_meta["granularity"],
            "year_min": years[0] if years else None,
            "year_max": years[-1] if years else None,
            "coverage": len([v for v in annual.values() if v is not None]),
            "type": "time_series",
        })
    for ind_id, b in benchmarks.items():
        entries.append({
            "id": ind_id,
            "label": b["label"],
            "unit": b["unit"],
            "direction": b["direction"],
            "anchors": meta["benchmark_indicators"][ind_id].get("anchors"),
            "source": b["source"],
            "year_min": b["year"],
            "year_max": b["year"],
            "coverage": 1,
            "type": "benchmark_snapshot",
        })
    return entries


# ── Write ─────────────────────────────────────────────────────────────────────

def write_outputs(long, wide, wide_norm, benchmarks, manifest, verbose):
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    def _write(name, obj):
        path = OUT_DIR / name
        path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
        size = path.stat().st_size
        print(f"  [ok] {name:<30} {size:,} bytes")

    _write("denmark_long.json",      long)
    _write("denmark_wide.json",      wide)
    _write("denmark_wide_norm.json", wide_norm)
    _write("benchmarks.json",        benchmarks)
    _write("manifest.json",          manifest)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Build unified Denmark dataset")
    parser.add_argument("--test",    action="store_true", help="Run self-tests and exit")
    parser.add_argument("--verbose", action="store_true", help="Print per-year detail")
    args = parser.parse_args()

    if args.test:
        _run_self_tests()
        return

    print("Loading indicator metadata…")
    meta = load_meta()

    print("Loading DST time series…")
    series = load_dst_series(meta)
    print(f"  Loaded {len(series)} raw indicators")

    print("Deriving per-capita indicators…")
    derived = derive_per_capita(series)
    series.update(derived)
    print(f"  Total indicators: {len(series)}")

    print("Loading HLEG benchmarks…")
    benchmarks = load_hleg_benchmarks(meta)
    print(f"  Loaded {len(benchmarks)} benchmark snapshots")

    print("Assembling unified annual dataset…")
    long, wide, wide_norm = assemble(series, meta, verbose=args.verbose)

    manifest = build_manifest(series, meta, benchmarks)

    years = sorted(wide.keys())
    print(f"  Year range: {years[0]}–{years[-1]}  ({len(years)} years)")
    print(f"  Indicators: {list(series.keys())}")
    print(f"  Long rows:  {len(long)}")

    print("Writing outputs…")
    write_outputs(long, wide, wide_norm, benchmarks, manifest, args.verbose)

    print("Done. Next steps:")
    print("  - Review data/indicator_meta.json anchors when IPCC theory arrives")
    print("  - Fill data/relationships.json edges from theory tables")
    print("  - Sprint 3: dashboard shell reading data/unified/")


if __name__ == "__main__":
    main()
