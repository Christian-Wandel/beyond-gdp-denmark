"""Beyond GDP Denmark — folkeskole cascade LEVER fetcher (session 2026-07-01).

Fetches the folkeskole-funding LEVER and its bonus cascade tables from DST,
reusing the locked fetch_dst.py helpers (CLAUDE.md: do not modify fetch_dst.py —
so this lives in .tmp/ and imports rather than editing the fetcher).

Decisions locked with user this session:
  - Deflator: offentligt forbrug PL-index, derived from NAHC1
    (FORBRUGSART=P3S13 current V vs 2020-chained LAN), rebased to latest year.
  - LEVER scope: PUBLIC grundskole total. Numerator = UOE1 H10 × EJER=200
    (offentlige uddannelsesinstitutioner). Denominator = public grundskole
    pupils = UDDAKT20 GRUNDSKOL in {folkeskoler, kommunale ungdomsskoler,
    specialskoler for børn} — the public institution types, matching the
    "offentlige" spend scope. UDDANNELSE=TOT (all klassetrin).

Outputs (data/):
  dst_folkeskole_funding.json   real kr/elev LEVER (headline series + parts)
  dst_class_size.json           KVOTIEN folkeskole class size
  dst_transition.json           FORLOB10 grundskole→continued-education path
"""

import sys
from pathlib import Path

# Import the locked helpers from the sibling project root.
ROOT = Path(__file__).resolve().parent.parent  # .../Beyond GDP Denmark
sys.path.insert(0, str(ROOT))

from fetch_dst import fetch_table_data, write_json  # noqa: E402


# ── deflator ────────────────────────────────────────────────────────────────

def build_public_consumption_deflator(base_year):
    """Return {year: factor} to convert nominal -> real (base_year) kr.

    Implicit public-consumption deflator = current-price / chained-volume,
    from NAHC1 FORBRUGSART=P3S13 (offentlige forbrugsudgifter). Rebased so
    the base year factor is exactly 1.0. Multiply a nominal value by the
    factor for its year to express it in base_year kr.
    """
    cur = _series_nahc1("V")    # løbende priser
    real = _series_nahc1("LAN")  # 2020-priser, kædede værdier
    # index_y = cur_y / real_y  (an implicit price level, arbitrary scale)
    index = {y: cur[y] / real[y] for y in cur if y in real and real[y]}
    if str(base_year) not in index:
        raise ValueError(f"base year {base_year} missing from deflator index")
    base = index[str(base_year)]
    return {y: base / index[y] for y in index}  # nominal_y * factor -> base kr


def _series_nahc1(prisenhed):
    rows = fetch_table_data("NAHC1", [
        {"code": "FORBRUGSART", "values": ["P3S13"]},
        {"code": "PRISENHED", "values": [prisenhed]},
        {"code": "Tid", "values": ["*"]},
    ])
    out = {}
    for row in rows:
        period = (row.get("TID") or "").strip()
        val = (row.get("INDHOLD") or "").strip()
        if not period:
            continue
        try:
            out[period] = float(val.replace(",", "."))
        except ValueError:
            continue
    return out


# ── LEVER: folkeskole funding (real kr/elev) ────────────────────────────────

# Public grundskole institution types in UDDAKT20.GRUNDSKOL that match the
# "offentlige uddannelsesinstitutioner" (EJER=200) spend scope in UOE1.
PUBLIC_GRUNDSKOL = ["1012", "1014", "1015"]  # folkeskoler, komm. ungdomsskoler, specialskoler


def fetch_lever():
    base_year = 2024  # rebase real kr to latest full year in UOE1

    # numerator: public grundskole spend, Mio. kr. (UOE1 H10 × EJER=200)
    spend_rows = fetch_table_data("UOE1", [
        {"code": "UDDNIV", "values": ["H10"]},
        {"code": "UDTYPE", "values": ["TOT"]},
        {"code": "EJER", "values": ["200"]},
        {"code": "Tid", "values": ["*"]},
    ])
    spend_mio = _one_per_year(spend_rows)          # Mio. kr. nominal
    spend_kr = {y: v * 1_000_000 for y, v in spend_mio.items()}

    # denominator: public grundskole pupils (sum the public institution types)
    pupil_rows = fetch_table_data("UDDAKT20", [
        {"code": "UDDANNELSE", "values": ["TOT"]},
        {"code": "ALDER", "values": ["TOT"]},
        {"code": "HERKOMST", "values": ["TOT"]},
        {"code": "HERKOMST1", "values": ["TOT"]},
        {"code": "KØN", "values": ["10"]},
        {"code": "GRUNDSKOL", "values": PUBLIC_GRUNDSKOL},
        {"code": "BOPOMR", "values": ["000"]},
        {"code": "FSTATUS", "values": ["B"]},  # B = Elever pr. 1. oktober (enrolled headcount)
        {"code": "Tid", "values": ["*"]},
    ])
    pupils = _sum_per_year(pupil_rows)

    # deflator -> real 2024 kr
    deflator = build_public_consumption_deflator(base_year)

    years = sorted(set(spend_kr) & set(pupils) & set(deflator))
    real_kr_per_pupil, nominal_kr_per_pupil = {}, {}
    for y in years:
        if not pupils[y]:
            continue
        nominal = spend_kr[y] / pupils[y]
        nominal_kr_per_pupil[y] = round(nominal, 2)
        real_kr_per_pupil[y] = round(nominal * deflator[y], 2)

    breakdown = {
        "nominal_kr_per_pupil": nominal_kr_per_pupil,
        "spend_mio_kr_nominal": {y: round(spend_mio[y], 1) for y in spend_mio},
        "public_grundskole_pupils": {y: int(pupils[y]) for y in pupils},
        "deflator_to_2024": {y: round(deflator[y], 5) for y in deflator if y in years},
    }
    return write_json(
        "folkeskole_funding", "UOE1+UDDAKT20+NAHC1",
        "Public grundskole spend per pupil (real, 2024 kr)",
        "DKK per pupil (2024 prices)", real_kr_per_pupil, breakdown=breakdown)


# ── bonus cascade tables ────────────────────────────────────────────────────

def fetch_class_size():
    # KVOTIEN: klassekvotient, folkeskoler, hele landet, all klassetrin.
    rows = fetch_table_data("KVOTIEN", [
        {"code": "OMRÅDE", "values": ["000"]},
        {"code": "KLASSE", "values": ["0000"]},
        {"code": "SKTPE", "values": ["ANTAL1012"]},
        {"code": "Tid", "values": ["*"]},
    ])
    series = _one_per_year(rows)
    return write_json("class_size", "KVOTIEN",
                      "Average class size, folkeskoler (all grades)",
                      "pupils per class", series)


def fetch_transition():
    # FORLOB10: share of a grundskole afgangsårgang NOT started in education
    # 15 months (1 year) after leaving = the NEET-feeding "ej påbegyndt" path.
    # Fetch counts for status 4 (ej påbegyndt) and TOT to derive a share.
    def _counts(uddstat):
        rows = fetch_table_data("FORLOB10", [
            {"code": "AFGAARG", "values": ["*"]},
            {"code": "AFGKLAS", "values": ["TOT"]},
            {"code": "AFGREG", "values": ["000"]},
            {"code": "UDDSTAT", "values": [uddstat]},
            {"code": "STATUSTID", "values": ["015"]},  # 1 year after
        ])
        return _one_per_year(rows, tid_key="AFGAARG")

    not_started = _counts("4")
    # total across all statuses per årgang for the denominator
    all_rows = fetch_table_data("FORLOB10", [
        {"code": "AFGAARG", "values": ["*"]},
        {"code": "AFGKLAS", "values": ["TOT"]},
        {"code": "AFGREG", "values": ["000"]},
        {"code": "UDDSTAT", "values": ["*"]},
        {"code": "STATUSTID", "values": ["015"]},
    ])
    total = _sum_per_year(all_rows, tid_key="AFGAARG")

    not_started_share = {}
    for y in sorted(set(not_started) & set(total)):
        if total[y]:
            not_started_share[y] = round(100 * not_started[y] / total[y], 2)

    breakdown = {
        "not_started_count": {y: int(v) for y, v in not_started.items()},
        "cohort_total": {y: int(v) for y, v in total.items()},
    }
    return write_json("transition", "FORLOB10",
                      "Grundskole leavers not started in education after 1 yr",
                      "percent of afgangsårgang", not_started_share,
                      breakdown=breakdown)


# ── small local aggregators (period key may be Tid or AFGAARG) ───────────────

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


if __name__ == "__main__":
    print("Fetching folkeskole cascade LEVER + bonuses from DST...\n")
    for fn in (fetch_lever, fetch_class_size, fetch_transition):
        try:
            fn()
        except Exception as e:  # noqa: BLE001
            print(f"  [ERR] {fn.__name__}: {e}")
