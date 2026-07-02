# Beyond GDP Denmark

Single-country spin-off of the Beyond GDP project. Uses Denmark's own national
statistics from **Danmarks Statistik (DST)** instead of multi-country
international APIs.

> The original multi-country `Beyond GDP Project/` is **archived** — do not edit it.
> This is an independent project that iterates on the same idea for Denmark only.

## Current state (sprint 3: folkeskole cascade card, coefficients hardened)

Sprint 1 (`fetch_dst.py`) and sprint 2 (unified dataset builder, `data/unified/`) are complete.
Sprint 3's dashboard shell is built: `js/cascade.js` renders `data/relationships.json` as an
ECharts directed node-graph (the folkeskole underfunding cascade, dark+light themes verified).
Coefficient hardening for that cascade went through 3 phases (2026-07-01, see
`docs/coefficient_methodology.md` for full detail):
- **Phase 1:** fetched 5 additional DK outcome-node time series from DST (`education_share`,
  `neet`, `gini`, `health`, `social_trust`), replacing single-point HLEG benchmarks.
- **Phase 2:** attempted empirical DK calibration on edges with both endpoints measured; 2 were
  data-starved, 1 (`income→life_expectancy`) was trend-confounded and deliberately not inflated.
- **Phase 3:** hardened literature-only edges via a 21-source NotebookLM corpus. 3 of 13 edges
  resolved (`draft` dropped); 10 remain draft but all carry real per-edge literature reasoning.
  Raw extractions: `.tmp/phase3_extractions.md`. Harmonization: `.tmp/phase3_harmonization.md`.

**Built (2026-07-01):** an interactive what-if simulator consuming `relationships.json`'s
`strength`/`direction`/`lag_years` to ripple a real-kr funding-lever push through the folkeskole
cascade. Propagation engine is extracted into `js/cascade-engine.js` (pure, no DOM/fetch,
deterministic topological order, invariant-tested via `tests/test_cascade_engine.js` — run
`node tests/test_cascade_engine.js`); UI (slider, presets, node encoding, ranked results panel)
lives in `js/cascade.js`. Design docs: `docs/simulator_plan.md` (build plan), `docs/simulator_roadmap.md`
(WELA-facing vision, Phase 2-5). Phase 4 (data transparency: node drawer + CSV export,
`data/data_dictionary.json`) and Phase 5 (human-legible real-unit statements for income/
unemployment/life satisfaction: `js/cascade-translate.js` + `data/unit_translations.json`,
tested via `tests/test_translate.js`, literature dose-response scaled by lever %, gated ±20%,
engine stays unitless — see `docs/wela_unit_translation_note.md`) built 2026-07-02.
Phase 2 (lag-aware animation) and Phase 3 (monitoring) not yet built — see roadmap doc.

**Dormant code (do not wire in or delete without a decision):** `js/scenarios.js`,
`compute_scenarios.py`, `data/scenarios.json`, `data/emission_coefficients.json`, and
`data/dst_energy_by_sector.json` together form a complete energy-scenario comparator
(sector × fuel swap → GHG delta), but it is NOT referenced by `index.html` — no `<script>`
tag, no `#scenario-panel` container, `initScenarios()` is never called. Fate deferred by
the owner (2026-07-02).

## Structure

```
fetch_dst.py              Raw fetcher — DST StatBank API (do not modify)
build_denmark_dataset.py  Unified dataset builder (reads data/, writes data/unified/)
data/
  dst_<metric>.json       7 raw DST series (written by fetch_dst.py)
  indicator_meta.json     Per-indicator: label, unit, direction, anchors, source
  relationships.json      Edge-list schema (ships empty; fill with IPCC theory)
  unified/
    denmark_long.json     Tidy: [{indicator, year, value, value_norm, unit}, ...]
    denmark_wide.json     Matrix: {year: {indicator: raw_value}}
    denmark_wide_norm.json Matrix: {year: {indicator: 0-100_norm}}
    benchmarks.json       HLEG single-point DNK context (separate from time series)
    manifest.json         Index: per-indicator id, label, unit, year range, coverage
.tmp/dst_cache/           Raw API cache (7-day TTL, regeneratable)
```

## Second data source: uddannelsesstatistik.dk (education statistics)

Børne- og Undervisningsministeriet's education-statistics warehouse — carries data DST
does NOT (grades, student wellbeing, absence, national tests). Fetcher: `fetch_uddx.py`.
Writes `data/uddx_*.json` in the same shape as `dst_*.json` (the unified builder reads both
prefixes). Currently fetches 2 series: `uddx_learning_outcomes.json` (9th-grade averages) and
`uddx_life_satisfaction.json` (student wellbeing) — both promoted from single-point HLEG
benchmarks to real DK time series in `indicator_meta.json`.

- Base: `https://api.uddannelsesstatistik.dk`. Bearer auth via `UDDX_API_TOKEN` (workspace-root
  `.env`) — anonymous, read-only, valid to 2029.
- Three endpoints: `POST /Api/v1/skema` (discover taxonomy), `POST /Api/v1/statistik` (pull
  data), `GET /Metadata/v1/DCAT-AP-DK` (catalog). Swagger at `/swagger/v1/swagger.json`.
- Data model is a hierarchical OLAP cube: `område` → `emne` → `underemne`, then request
  `nøgletal` (measures) split by `detaljering` (dimensions), optional `filtre`.
  Grundskolen = `område=GS`; grades = `KARA/KARAGNS`, wellbeing = `TRIV/TRIVIND`.
- **Gotcha 1 — measure naming:** `/statistik` wants the BARE measure name
  (`"Gennemsnit - Bundne prøver"`), NOT the bracketed form `/skema` lists it under
  (`"[Measures].[Gennemsnit - Bundne prøver]"`). `detaljering` DOES want full bracket form
  (`"[Skoleår].[Skoleår]"`). (Cracked from the site's `QueryBuilder.js`, which strips measures
  to their last bracket segment before POSTing.)
- **Gotcha 2 — encoding:** Danish chars in the JSON keys (`område`, `nøgletal`, `tomme_rækker`)
  crash cp1252 stdout on Windows. `export PYTHONIOENCODING=utf-8` before any run that prints
  API output. Values come back Danish-formatted (`"7,3"`, `"100,0 %"`); school years as
  `"2023/2024"` → normalised to the ending year (2024).
- Explore other topics: `python fetch_uddx.py --discover GS` then `--schema GS KARA KARAGNS`.
  Grundskolen has ~15 topics still unfetched (tests, absence, SocRef, teacher competence, economy).

## DST API notes (learned the hard way)

- Base: `https://api.statbank.dk/v1/` — no auth (CC 4.0 BY).
- `/data` does **not** accept `format=JSON` (returns 400). Use `format=CSV`
  (semicolon-delimited, `TID;INDHOLD` columns). `/tableinfo` does accept JSON.
- Responses carry a UTF-8 BOM — decode with `utf-8-sig`.
- Many tables lack an "all"/total category for a dimension. Where missing, the
  fetcher requests `*` and aggregates per period (`_sum_by_period`,
  `_mean_by_period`).
- Some old table IDs are frozen (e.g. AKU1 ends 2011) — use the current
  equivalent (AKU111K for unemployment rate).

## Metrics + source tables

| File | Table | Metric | Unit |
|------|-------|--------|------|
| dst_population | FOLK1A | Population, start of quarter | persons |
| dst_life_expectancy | HISB8 | Life expectancy at birth (avg of sexes) | years |
| dst_unemployment | AKU111K | Unemployment rate (LFS) | percent |
| dst_income | INDKP101 | Avg disposable income per person | DKK |
| dst_gdp | NAN1 | Real GDP (2020 chained prices, TRANSAKT=B1GQK/PRISENHED=LAN_M) | DKK billion |
| dst_education | HFUDD11 | Population 15-69 by highest education (total) | persons |
| dst_ghg | DRIVHUS | GHG emissions (excl. biomass CO2) | 1000 t CO2-eq |
| dst_energy | ENE2HO | Total energy supply | GJ |

## Usage

```bash
# Sprint 1 — fetch fresh data from DST
python fetch_dst.py --discover-subject 9     # list tables in a subject
python fetch_dst.py --discover-table DRIVHUS # show variable + value codes
python fetch_dst.py                          # fetch all → data/

# Sprint 2 — rebuild unified dataset (re-run after any fetch)
python build_denmark_dataset.py              # → data/unified/ (5 files)
python build_denmark_dataset.py --test       # run year-normalisation self-tests
python build_denmark_dataset.py --verbose    # show per-year detail
```

Build discovery-first: confirm a table's real variable/value codes with
`--discover-table` before wiring a new `fetch_*` function.

## Year-normalisation rules (build_denmark_dataset.py)

DST series use three period-key formats; all collapsed to integer year:

| Format | Example | Rule |
|--------|---------|------|
| Annual | `"2024"` | direct cast |
| Quarterly | `"2024K1"` | year extracted; population=year_end (Q4), unemployment=mean |
| Biennial cohort | `"2024:2025"` | first year used (`2024`) |

Missing cells → `null` (no interpolation — simulator must not invent observations).

## Normalization (0–100)

`norm_high(val, bad, mid, good)` / `norm_low(val, good, mid, bad)` ported from
HLEG `js/core.js`. Anchors live in `data/indicator_meta.json` — edit there, not
in the script. Neutral indicators (population, education, energy) are not normalized.

## Relationship graph schema

`data/relationships.json` ships with `edges: []` and `_examples` showing the shape.
Each edge: `{from, to, direction, strength, lag_years, confidence, source, note}`.
Fill from IPCC/theory tables in sprint 3. No modeling code consumes this yet.

## Future sprints (not yet built)

- **Sprint 3 (dashboard):** ECharts shell reading `data/unified/` — trends, not gauges.
- **Sprint 3+ (simulator):** What-if engine reading `relationships.json`; shows ripple
  effects when a user pushes an indicator.
- **Sprint 4 (refinements):** Education by attainment level; renewable energy share;
  historical backfill of selected HLEG indicators (Gini, HALE) from World Bank/WHO for
  trend depth on currently snapshot-only benchmarks.

## Output schema

```json
{
  "meta": {"source": "...", "table": "FOLK1A", "label": "...",
           "unit": "persons", "fetched": "2026-06-16", "latest_year": "2026K1"},
  "data": {"DNK": {"name": "Denmark", "value": 6025603.0,
                   "year": "2026K1", "series": {"2008K1": 5475791.0, ...}}}
}
```

Single `DNK` key (DST is Denmark-only). `series` carries the full time series —
the point of this project is trend depth.

