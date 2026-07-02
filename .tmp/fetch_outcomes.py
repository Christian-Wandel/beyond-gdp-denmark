"""Beyond GDP Denmark — outcome-node fetcher (Phase 1, session 2026-07-01).

Fetches DK time series for the five outcome nodes still running on single-point
HLEG benchmarks: education attainment share (1b), NEET (1d), gini (1e),
self-rated health (1f), and social trust (JOB 2). Follows the same pattern as
.tmp/fetch_folkeskole.py — imports the locked fetch_dst.py helpers rather than
editing that file (CLAUDE.md: do not modify fetch_dst.py).

Discovery already done this session via --discover-table / --discover-subject:
  - HFUDD11: tertiary = H40+H50+H60+H70+H80; upper-secondary+ = TOT minus H10 minus H90
  - NEET1: STATUSNEET 10=NEET / 00=total, KØN=TOT, BOPOMR=000, SOCIO=TOT
  - IFOR41: ULLIG=70 (Gini-koefficient), KOMMUNEDK=000, annual since 1987
  - SILC60: SPORG=PH010 (dårligt/meget dårligt helbred), ENHED=AND (percent), BAGOPL=TOT
  - SILC52: ENHED=GNS (average trust score), BAGOPL=TOT — only 2021-2025 (EU-SILC ad-hoc)

Outputs (data/):
  dst_education_share.json   HFUDD11 tertiary + upper-secondary+ share
  dst_neet.json               NEET1 16-24 share
  dst_gini.json                IFOR41 Gini coefficient
  dst_health.json              SILC60 self-rated poor health share
  dst_social_trust.json        SILC52 average trust-in-strangers score
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # .../Beyond GDP Denmark
sys.path.insert(0, str(ROOT))

from fetch_dst import fetch_table_data, write_json  # noqa: E402


def _one_per_year(rows, tid_key="TID"):
    out = {}
    for row in rows:
        period = (row.get(tid_key) or row.get("TID") or "").strip()
        val = (row.get("INDHOLD") or "").strip()
        if not period:
            continue
        try:
            out[period] = float(val.replace(",", "."))
        except ValueError:
            continue
    return out


def _sum_per_year(rows, tid_key="TID"):
    out = {}
    for row in rows:
        period = (row.get(tid_key) or row.get("TID") or "").strip()
        val = (row.get("INDHOLD") or "").strip()
        if not period:
            continue
        try:
            out[period] = out.get(period, 0.0) + float(val.replace(",", "."))
        except ValueError:
            continue
    return out


# ── 1b. education attainment share (HFUDD11, broken out) ───────────────────

TERTIARY_CODES = ["H40", "H50", "H60", "H70", "H80"]
UPPER_SEC_PLUS_CODES = ["H20", "H30", "H35", "H40", "H50", "H60", "H70", "H80"]


def fetch_education_share():
    total_rows = fetch_table_data("HFUDD11", [
        {"code": "BOPOMR", "values": ["000"]},
        {"code": "HERKOMST", "values": ["TOT"]},
        {"code": "HFUDD", "values": ["TOT"]},
        {"code": "ALDER", "values": ["TOT"]},
        {"code": "KØN", "values": ["TOT"]},
        {"code": "Tid", "values": ["*"]},
    ])
    total = _one_per_year(total_rows)

    tertiary_rows = fetch_table_data("HFUDD11", [
        {"code": "BOPOMR", "values": ["000"]},
        {"code": "HERKOMST", "values": ["TOT"]},
        {"code": "HFUDD", "values": TERTIARY_CODES},
        {"code": "ALDER", "values": ["TOT"]},
        {"code": "KØN", "values": ["TOT"]},
        {"code": "Tid", "values": ["*"]},
    ])
    tertiary = _sum_per_year(tertiary_rows)

    upper_rows = fetch_table_data("HFUDD11", [
        {"code": "BOPOMR", "values": ["000"]},
        {"code": "HERKOMST", "values": ["TOT"]},
        {"code": "HFUDD", "values": UPPER_SEC_PLUS_CODES},
        {"code": "ALDER", "values": ["TOT"]},
        {"code": "KØN", "values": ["TOT"]},
        {"code": "Tid", "values": ["*"]},
    ])
    upper = _sum_per_year(upper_rows)

    years = sorted(set(total) & set(tertiary) & set(upper))
    tertiary_share, upper_share = {}, {}
    for y in years:
        if not total[y]:
            continue
        tertiary_share[y] = round(100 * tertiary[y] / total[y], 2)
        upper_share[y] = round(100 * upper[y] / total[y], 2)

    breakdown = {
        "upper_secondary_plus_share": upper_share,
        "population_15_69_total": {y: int(total[y]) for y in years},
    }
    return write_json(
        "education_share", "HFUDD11",
        "Tertiary education attainment share, population 15-69",
        "percent", tertiary_share, breakdown=breakdown)


# ── 1d. NEET (NEET1, 16-24) ──────────────────────────────────────────────

def fetch_neet():
    def _status(code):
        rows = fetch_table_data("NEET1", [
            {"code": "STATUSNEET", "values": [code]},
            {"code": "KØN", "values": ["TOT"]},
            {"code": "BOPOMR", "values": ["000"]},
            {"code": "SOCIO", "values": ["TOT"]},
            {"code": "Tid", "values": ["*"]},
        ])
        return _one_per_year(rows)

    neet_count = _status("10")
    total = _status("00")
    years = sorted(set(neet_count) & set(total))
    share = {y: round(100 * neet_count[y] / total[y], 2) for y in years if total[y]}

    breakdown = {
        "neet_count": {y: int(neet_count[y]) for y in years},
        "population_16_24_total": {y: int(total[y]) for y in years},
    }
    return write_json("neet", "NEET1",
                      "NEET share, population 16-24",
                      "percent", share, breakdown=breakdown)


# ── 1e. Gini coefficient (IFOR41) ────────────────────────────────────────

def fetch_gini():
    rows = fetch_table_data("IFOR41", [
        {"code": "ULLIG", "values": ["70"]},
        {"code": "KOMMUNEDK", "values": ["000"]},
        {"code": "Tid", "values": ["*"]},
    ])
    series = _one_per_year(rows)
    return write_json("gini", "IFOR41",
                      "Gini coefficient, equivalised disposable income",
                      "index (0-100)", series)


# ── 1f. self-rated poor health (SILC60) ──────────────────────────────────

def fetch_health():
    rows = fetch_table_data("SILC60", [
        {"code": "SPORG", "values": ["PH010"]},
        {"code": "BAGOPL", "values": ["TOT"]},
        {"code": "ENHED", "values": ["AND"]},
        {"code": "Tid", "values": ["*"]},
    ])
    series = _one_per_year(rows)
    return write_json("health", "SILC60",
                      "Share of population (16+) reporting bad or very bad health",
                      "percent (lower_better)", series)


# ── JOB 2. social trust (SILC52) ─────────────────────────────────────────

def fetch_social_trust():
    rows = fetch_table_data("SILC52", [
        {"code": "BAGOPL", "values": ["TOT"]},
        {"code": "ENHED", "values": ["GNS"]},
        {"code": "Tid", "values": ["*"]},
    ])
    series = _one_per_year(rows)
    return write_json("social_trust", "SILC52",
                      "Average trust-in-strangers score, population 16+",
                      "score (0-10, higher_better)", series)


if __name__ == "__main__":
    print("Fetching outcome-node series from DST...\n")
    for fn in (fetch_education_share, fetch_neet, fetch_gini, fetch_health, fetch_social_trust):
        try:
            fn()
        except Exception as e:  # noqa: BLE001
            print(f"  [ERR] {fn.__name__}: {e}")
