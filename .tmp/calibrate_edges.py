"""Phase 2 — empirical DK edge calibration (session 2026-07-01).

For each cascade edge where BOTH endpoints are now measured DK time series,
estimate an empirical strength/lag from the data itself rather than importing
a literature figure. Literature (Phase 3, NotebookLM-sourced) will later serve
as a sanity-check on these numbers, not their source.

Both-ends-measured edges (of the 13 education-cascade edges, only these 3
qualify — everything else touches learning_outcomes/life_satisfaction/hale/
poverty_rate, which stay single-point HLEG benchmarks and defer to Phase 3):
  - folkeskole_funding -> neet        (lag_years=5 in current draft)
  - neet -> income                    (lag_years=10 in current draft)
  - income -> life_expectancy         (lag_years=10 in current draft)

Method: align the two series at the edge's stated lag (and a small window of
nearby lags), standardize both (z-score), regress the standardized target on
the standardized lagged source, take the slope as the empirical "strength."
Report sample size explicitly — this is a small-N annual dataset, not a
research-grade panel, and every edge here is honestly data-starved by the
plan's own definition (LEVER window is only 9 points; other series are longer
but the lags still eat most of the overlap).
"""

import json
import statistics as stats
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def load_series(fname):
    d = json.loads((DATA_DIR / f"{fname}.json").read_text(encoding="utf-8-sig"))
    s = d["data"]["DNK"]["series"]
    out = {}
    for k, v in s.items():
        # collapse biennial cohort keys like "1981:1982" -> first year
        year = int(k.split(":")[0])
        out[year] = v
    return out


def lagged_pairs(source, target, lag):
    pairs = []
    for y_src, v_src in source.items():
        y_tgt = y_src + lag
        if y_tgt in target:
            pairs.append((v_src, target[y_tgt]))
    return pairs


def zscore(vals):
    m = stats.mean(vals)
    sd = stats.pstdev(vals)
    if sd == 0:
        return [0.0 for _ in vals]
    return [(v - m) / sd for v in vals]


def empirical_strength(source, target, lag_candidates):
    """Try each candidate lag, return the best-supported (highest |r|) fit."""
    best = None
    for lag in lag_candidates:
        pairs = lagged_pairs(source, target, lag)
        if len(pairs) < 4:
            continue
        xs = [p[0] for p in pairs]
        ys = [p[1] for p in pairs]
        zx = zscore(xs)
        zy = zscore(ys)
        n = len(pairs)
        # Pearson correlation on standardized series == the standardized slope
        r = sum(a * b for a, b in zip(zx, zy)) / n if n else 0.0
        if best is None or abs(r) > abs(best["r"]):
            best = {"lag": lag, "r": round(r, 4), "n": n}
    return best


EDGES = [
    ("folkeskole_funding", "neet", [3, 4, 5, 6, 7]),
    ("neet", "income", [5, 8, 10, 12]),
    ("income", "life_expectancy", [5, 8, 10, 12, 15]),
]

FILES = {
    "folkeskole_funding": "dst_folkeskole_funding",
    "neet": "dst_neet",
    "income": "dst_income",
    "life_expectancy": "dst_life_expectancy",
}

if __name__ == "__main__":
    series = {node: load_series(FILES[node]) for node in FILES}
    print("Loaded series year ranges:")
    for node, s in series.items():
        print(f"  {node:20s} {min(s)}-{max(s)}  ({len(s)} pts)")
    print()

    results = {}
    for src, tgt, lags in EDGES:
        result = empirical_strength(series[src], series[tgt], lags)
        results[(src, tgt)] = result
        print(f"{src} -> {tgt}:")
        if result is None:
            print("  INSUFFICIENT DATA (n<4 at every candidate lag) — cannot calibrate")
        else:
            starved = " [DATA-STARVED, n<8]" if result["n"] < 8 else ""
            print(f"  best lag={result['lag']}y  r={result['r']}  n={result['n']}{starved}")
        print()

    Path(__file__).resolve().parent.joinpath("calibration_results.json").write_text(
        json.dumps({f"{s}->{t}": r for (s, t), r in results.items()}, indent=2),
        encoding="utf-8")
    print("Wrote .tmp/calibration_results.json")
