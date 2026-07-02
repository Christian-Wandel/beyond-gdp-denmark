"""Beyond GDP Denmark — uddannelsesstatistik.dk (education-statistics) data retrieval.

Fetches Grundskolen (primary-school) series the folkeskole cascade needs but that
Danmarks Statistik does NOT carry: grade averages (learning_outcomes node) and student
wellbeing (a real DK proxy for the life_satisfaction node). Second data source alongside
fetch_dst.py; writes cleaned JSON to data/ in the same dst_*.json shape so the unified
builder consumes it identically.

Source: Børne- og Undervisningsministeriet's education-statistics warehouse.
API model is a hierarchical OLAP cube — område → emne → underemne, then request
nøgletal (measures) split by detaljering (dimensions).

Auth: Bearer token from UDDX_API_TOKEN (workspace-root .env). Anonymous, read-only.

Two gotchas learned the hard way:
  1. /statistik wants BARE measure names ("Gennemsnit - Bundne prøver"), NOT the
     bracketed form the /skema catalog lists ("[Measures].[Gennemsnit - Bundne prøver]").
     detaljering, by contrast, DOES want full bracket form ("[Skoleår].[Skoleår]").
  2. Danish chars in the JSON keys (område, nøgletal, tomme_rækker) crash cp1252 stdout
     on Windows — run with PYTHONIOENCODING=utf-8 before any print of API output.

Usage:
    export PYTHONIOENCODING=utf-8
    python fetch_uddx.py --discover GS            # list topics under Grundskolen
    python fetch_uddx.py --discover GS KARA       # list subtopics under a topic
    python fetch_uddx.py --schema GS KARA KARAGNS # show measures + dimensions
    python fetch_uddx.py                          # fetch all → data/
"""

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API_BASE = "https://api.uddannelsesstatistik.dk"
ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"
CACHE_DIR = ROOT / ".tmp" / "uddx_cache"
CACHE_TTL_DAYS = 7

UA = "BeyondGDP-Denmark/0.1 (data retrieval PoC)"


# ── Token loading ────────────────────────────────────────────────────────────

def _load_token() -> str:
    """UDDX_API_TOKEN from env, or parsed from the workspace-root .env."""
    tok = os.environ.get("UDDX_API_TOKEN")
    if tok:
        return tok.strip()
    # Walk up to the workspace root (holds the shared .env)
    for parent in [ROOT, *ROOT.parents]:
        env = parent / ".env"
        if env.exists():
            for line in env.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith("UDDX_API_TOKEN="):
                    return line.split("=", 1)[1].strip()
    print("ERROR: UDDX_API_TOKEN not found in env or .env", file=sys.stderr)
    sys.exit(1)


# ── HTTP helpers ─────────────────────────────────────────────────────────────

def _request(endpoint: str, body: dict) -> str:
    url = f"{API_BASE}/{endpoint}"
    headers = {
        "User-Agent": UA,
        "Authorization": f"Bearer {_load_token()}",
        "Content-Type": "application/json; charset=utf-8",
    }
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8")


def cached_post(endpoint: str, body: dict) -> str:
    """POST with a 7-day disk cache, keyed by md5 of endpoint+body."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = hashlib.md5((endpoint + json.dumps(body, sort_keys=True)).encode("utf-8")).hexdigest()
    cache_file = CACHE_DIR / f"{key}.json"
    if cache_file.exists():
        age_days = (datetime.now().timestamp() - cache_file.stat().st_mtime) / 86400
        if age_days < CACHE_TTL_DAYS:
            return cache_file.read_text(encoding="utf-8")
    raw = _request(endpoint, body)
    cache_file.write_text(raw, encoding="utf-8")
    return raw


def skema(body: dict):
    return json.loads(cached_post("Api/v1/skema", body))


def statistik(body: dict):
    return json.loads(cached_post("Api/v1/statistik", body))


# ── Discovery helpers (dev tools) ────────────────────────────────────────────

def discover(area=None, topic=None):
    """List områder / emner / underemner at the given depth."""
    body = {}
    if area:
        body["område"] = area
    if topic:
        body["emne"] = topic
    for row in skema(body):
        print(f"  {row['ID']:<12} {row.get('Name', '')}")


def show_schema(area, topic, subtopic):
    """Print the measures (nøgletal) and dimensions (detaljer) for a dataset."""
    j = skema({"område": area, "emne": topic, "underemne": subtopic})
    print(f"\n{area}/{topic}/{subtopic}")
    print("\nNøgletal (measures — pass the BARE name to /statistik):")
    for ng in j.get("nøgletal", []):
        print(f"  {ng}")
    print("\nDetaljer (dimensions — pass full [Dim].[Level] form):")
    for d in j.get("detaljer", []):
        print(f"  {d['name']:<60} count={d['count']}")


# ── Value / year parsing ─────────────────────────────────────────────────────

_RE_SCHOOLYEAR = re.compile(r"^(\d{4})/(\d{4})$")


def _school_year_to_int(sy: str) -> int | None:
    """'2023/2024' → 2024 (ending year, matching the builder's cohort rule)."""
    m = _RE_SCHOOLYEAR.match(sy.strip())
    return int(m.group(2)) if m else None


def _parse_value(v: str) -> float | None:
    """Danish-formatted number → float. Handles '7,3', '100,0 %', '4,1'."""
    if v is None:
        return None
    s = str(v).replace("%", "").replace("\xa0", " ").strip()
    s = s.replace(".", "").replace(",", ".")  # da-DK: '.' thousands, ',' decimal
    try:
        return float(s)
    except ValueError:
        return None


def _year_key(row: dict) -> str | None:
    """Find the Skoleår column in a flat /statistik row (key name varies)."""
    for k in row:
        if k.endswith("[Skoleår]"):
            return k
    return None


# ── Output ───────────────────────────────────────────────────────────────────

def _write_series(filename, meta, series):
    series = {str(y): series[y] for y in sorted(series)}
    latest = max(series) if series else None
    out = {
        "meta": {**meta, "fetched": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                 "latest_year": latest},
        "data": {"DNK": {
            "name": "Denmark",
            "value": series[latest] if latest else None,
            "year": latest,
            "series": series,
        }},
    }
    path = DATA_DIR / filename
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  wrote {filename}  ({len(series)} years, latest {latest} = {out['data']['DNK']['value']})")


# ── Fetchers ─────────────────────────────────────────────────────────────────

def fetch_grades():
    """National 9th-grade average, bundne prøver, by school year → learning_outcomes."""
    rows = statistik({
        "område": "GS", "emne": "KARA", "underemne": "KARAGNS",
        "nøgletal": ["Gennemsnit - Bundne prøver"],
        "detaljering": ["[Skoleår].[Skoleår]"],
        "indlejret": False, "tomme_rækker": False, "formattering": "json", "side": 1,
    })
    series = {}
    yk = _year_key(rows[0]) if rows else None
    for r in rows:
        y = _school_year_to_int(r[yk])
        val = _parse_value(r.get("Gennemsnit - Bundne prøver"))
        if y is not None and val is not None:
            series[y] = val
    _write_series("uddx_learning_outcomes.json", {
        "source": "uddannelsesstatistik.dk (GS/KARA/KARAGNS)",
        "table": "Gennemsnit - Bundne prøver, 9. klasse",
        "label": "Grade average, 9th-grade bound exams (7-trins-skala)",
        "unit": "grade_points",
    }, series)


def fetch_wellbeing():
    """National general-wellbeing mean score (1-5) by school year → life_satisfaction proxy."""
    rows = statistik({
        "område": "GS", "emne": "TRIV", "underemne": "TRIVIND",
        "nøgletal": ["Indikatorsvar - Landstal"],
        "detaljering": ["[Skoleår].[Skoleår]", "[Trivselsindikator].[Trivselsindikator]"],
        "indlejret": False, "tomme_rækker": False, "formattering": "json", "side": 1,
    })
    ik = "[Trivselsindikator].[Trivselsindikator].[Trivselsindikator]"
    series = {}
    yk = _year_key(rows[0]) if rows else None
    for r in rows:
        if r.get(ik) != "Generel trivsel":
            continue
        y = _school_year_to_int(r[yk])
        val = _parse_value(r.get("Indikatorsvar - Landstal"))
        if y is not None and val is not None:
            series[y] = val
    # Filename matches the indicator id (life_satisfaction) so the unified
    # builder's uddx_{id}.json lookup finds it — this is the DK proxy for that node.
    _write_series("uddx_life_satisfaction.json", {
        "source": "uddannelsesstatistik.dk (GS/TRIV/TRIVIND)",
        "table": "Indikatorsvar - Landstal, 'Generel trivsel'",
        "label": "Student wellbeing, general (mean score 1-5)",
        "unit": "score_1_5",
    }, series)


def main():
    p = argparse.ArgumentParser(description="Fetch education-statistics series for Beyond GDP Denmark.")
    p.add_argument("--discover", nargs="*", metavar="ID", help="list taxonomy: [område [emne]]")
    p.add_argument("--schema", nargs=3, metavar=("OMR", "EMNE", "UNDEREMNE"),
                   help="show measures + dimensions for a dataset")
    args = p.parse_args()

    if args.schema:
        show_schema(*args.schema)
        return
    if args.discover is not None:
        discover(*(args.discover[:2]))
        return

    print("Fetching from uddannelsesstatistik.dk …")
    fetch_grades()
    fetch_wellbeing()
    print("Done.")


if __name__ == "__main__":
    main()
