# DST Data Wishlist — DK-specific series for the folkeskole cascade

**Purpose.** This is a directive for an agent tasked with mining **Danmarks Statistik (DST)
StatBank** for Denmark-specific data to harden the education cascade (and feed future
cascades). The cascade currently runs on general OECD/literature figures; every series found
here replaces a generic edge with a DK-calibrated one — which is what makes it credible to
WELA (Ploug & Falkenfleth) and to Danish statisticians.

**Three jobs, in priority order:**
1. **Fill cascade NODES with DK trends** — turn snapshot-only / proxy nodes into real Danish
   time series (the card's named data-gaps).
2. **Find DK series for the MISSING node** — social trust / cohesion, which DST may carry
   via the *Medborgerskab* / national-account satellite work.
3. **Surface candidate series for the 3 reserve cards** (green transition, inequality/cohesion,
   care economy) so the next deep cascade has a DK data spine ready.

---

## How to query DST (do this first — don't guess table IDs)

Base: `https://api.statbank.dk/v1` — no auth (CC 4.0 BY). Use the existing helpers in
`fetch_dst.py`. Workflow per candidate:

```bash
# 1. List tables in a subject area (subject codes below)
python fetch_dst.py --discover-subject <N>

# 2. Inspect a specific table's variables + value codes BEFORE wiring a fetch
python fetch_dst.py --discover-table <TABLE_ID>
```

Gotchas (learned the hard way — see CLAUDE.md):
- `/data` rejects `format=JSON` (400). Use `format=CSV` (semicolon-delimited, `TID;INDHOLD`).
- Responses carry a UTF-8 BOM → decode `utf-8-sig`.
- Many tables lack an "all/total" category → request `*` and aggregate per period.
- Some old table IDs are frozen (e.g. AKU1 ends 2011) → find the current equivalent.

**Relevant DST subject areas to discover within** (VERIFIED against `/subjects` API
2026-07-01 — the earlier codes below were WRONG guesses; these are the real top-level IDs):
- Subject **1** — Borgere (citizens: population, elections)
- Subject **2** — Arbejde og indkomst (labour, earnings, income — AKU, INDKP, gini/IFOR)
- Subject **3** — Økonomi (economy — national accounts, **public finances**, municipal
  regnskaber, **education expenditure UOE1/UOE2**)
- Subject **5** — Uddannelse og forskning (**education** — grundskole, elever, transitions)
- Subject **6** — Erhvervsliv (business sector)
- Subject **8** — Kultur og fritid (culture & leisure)
- Subject **9** — Miljø og energi (environment, energy — green accounts)
- Subject **19** — Om Danmarks Statistik (meta)

> ⚠️ CORRECTION: the original wishlist assumed 4=education, 13=public finances, 5=labour.
> All wrong. Real: **education = 5**, **public finances = under 3 (Økonomi)**,
> **labour/income = 2**. The `/subjects` endpoint returns empty `desc` fields in the
> recursive shape — query `dst_get('subjects',{'format':'JSON'})` for top-level labels,
> then `dst_get('tables',{'subjects':'<id>','format':'JSON'})` and grep the `text` field.

---

## Already wired (do NOT re-fetch — confirm coverage only)

| Node | DST table | Metric |
|------|-----------|--------|
| population | FOLK1A | Population |
| life_expectancy | HISB8 | Life expectancy at birth |
| unemployment | AKU111K | Unemployment rate (LFS) |
| income | INDKP101 | Avg disposable income per person |
| education | HFUDD11 | Population 15-69 by highest education (total) |
| ghg | DRIVHUS | GHG emissions |
| energy | ENE2HO | Total energy supply |

Plus green-accounts already fetched: AFTRYK1 (climate footprint), MRM2 (material flow),
VANDRG1 (water), GRON1 (green GVA).

Plus folkeskole cascade (fetched 2026-07-01, via `.tmp/fetch_folkeskole.py`):
UOE1+UDDAKT20+NAHC1 (folkeskole_funding LEVER), KVOTIEN (class_size), FORLOB10 (transition).

Plus outcome nodes (fetched 2026-07-01, via `.tmp/fetch_outcomes.py`):
HFUDD11 re-query (education_share), NEET1 (neet), IFOR41 (gini), SILC60 (health),
SILC52 (social_trust). See JOB 1b/1d/1e/1f/2 below for full detail per node.

**Side finding (not fetched, noted for later):** `STATUSU7` (subject 5) carries a variable
literally named "gns. grundskolekarakter for dansk og matematik" — but it's a *population
count by grade-bucket* (18-25 year-olds cross-tabbed into 4 coarse grade ranges: <2, 2-4.99,
5-8.99, 9+), not a continuous grade-average time series. Does not overturn JOB 1c's
"learning_outcomes confirmed absent" finding, but could feed a coarse proxy later
(e.g. "% of cohort with grundskole grade average <5") if the cascade ever wants one.

---

## Discovery results — folkeskole tables FOUND (2026-07-01, not yet fetched)

Confirmed to exist in StatBank via `dst_get('tables',...)` + keyword grep. Table IDs
verified; variable codes confirmed only for UOE1 so far. Fetch = next session.

| Candidate node | DST table | What it gives | Subject |
|---|---|---|---|
| **folkeskole_funding** (numerator) | **UOE1** | Udgifter til uddannelse; UDDNIV=H10=Grundskoler; 2016–2024 | 3 |
| **folkeskole_pupils** (denominator) | **UDDAKT20** / SPECIAL1 | Uddannelsesaktivitet/elever i grundskolen | 5 |
| class_size (bonus) | **KVOTIEN** | Klassekvotienter i grundskolen | 5 |
| transition_rate (feeds 1d) | **FORLOB10** | Fra grundskole til fortsat uddannelse | 5 |
| institutions (context) | **INST10** | Grundskoler (institution counts) | 5 |
| special-ed share (optional) | SPECIAL1/2/3, LIGEUI4 | Specialundervisning i grundskolen | 5 |

Also seen (not cascade-critical): LABY23/23A (activity), LABY47 (distance to school),
LIGEUI5 (frafald indicator). Full economy-expenditure sibling: **UOE2**.

**Confirmed ABSENT:** exam grades (see JOB 1c) — 0 real hits across all 2,316 tables.

---

## JOB 1 — Harden cascade nodes (HIGHEST PRIORITY)

These map directly to the cascade's three named data-gaps and to the `⚠ NEEDS` edges in
`.tmp/folkeskole_cascade_edges.md`.

### 1a. THE LEVER — folkeskole funding  ✅ FETCHED + WIRED 2026-07-01

```
node_id:        folkeskole_funding
dst_table:      UOE1 (spend) + UDDAKT20 (pupils) + NAHC1 (deflator)
metric:         Public grundskole spend per pupil, real 2024 kr
unit:           DKK per pupil (2024 prices)   direction: higher_better (context-dependent)
year_range:     2016-2024        coverage: annual, 9 points
dimension_note: numerator = UOE1 UDDNIV=H10 x UDTYPE=TOT x EJER=200 (offentlige institutioner).
                denominator = UDDAKT20 UDDANNELSE=TOT, GRUNDSKOL in {1012,1014,1015} (public
                institution types: folkeskoler, kommunale ungdomsskoler, specialskoler for
                børn), BOPOMR=000, FSTATUS=B (elever pr. 1. oktober — required dims, easy to
                miss: omitting BOPOMR/FSTATUS throws HTTP 400). deflator = NAHC1
                FORBRUGSART=P3S13, PRISENHED V/LAN ratio, rebased to 2024=1.0.
status:         FOUND, fetched, derived, written to data/dst_folkeskole_funding.json
api_note:       UDDAKT20's Folkeskoler pupil count has a scope/methodology break between
                2006 (117,623) and 2007 (588,177) — roughly 5x jump, smooth trend either
                side. Does not affect this series (starts 2016) but do not extend the
                pupil series back past ~2010 without investigating the break first.
result:         real kr/pupil rose ~104,351 (2016) -> 109,471 (2024), +4.9%. Over the same
                window public-grundskole pupil headcount FELL ~8% (560,947 -> 514,299) —
                so part of the nominal spend growth is serving a shrinking cohort, not a
                genuine real increase in per-pupil investment. Useful nuance for the WELA
                framing: the lever moved less than the topline nominal-kr number suggests.
```

**Sanity check (2026-07-01, user-requested):** re-pulled NAHC1 P3S13 current (`V`) vs
2020-chained (`LAN`) directly, independent of `fetch_folkeskole.py`, and recomputed the
2024-rebased deflator from scratch in a standalone script. Result matched the deflator
column already in `data/dst_folkeskole_funding.json` exactly (2016: 1.22997, 2021: 1.11116,
2024: 1.0, etc.) — see `.tmp/nahc1_deflator_sanity_check.csv`. Bonus check: 2020 current =
2020 chained = 576,101 Mio. kr. exactly, index = 1.0 — correct by construction since DST's
chained series is benchmarked to 2020 prices. Deflator confirmed independently correct.

Fetcher: `.tmp/fetch_folkeskole.py` (kept out of `fetch_dst.py` per CLAUDE.md "do not modify";
imports its helpers instead). Also fetched in the same run:

```
node_id:        class_size (bonus)
dst_table:      KVOTIEN
metric:         Average class size, folkeskoler, all grades, hele landet
status:         FOUND, fetched -> data/dst_class_size.json (17 pts, latest 2025)

node_id:        transition (bonus, feeds NEET path / JOB 1d)
dst_table:      FORLOB10
metric:         Share of grundskole-leaver cohort not started in further education,
                1 year after leaving (UDDSTAT=4 "ej påbegyndt" / cohort total)
status:         FOUND, fetched -> data/dst_transition.json (19 pts, latest 2024)
```

<details><summary>Original resolution note (2026-07-01, pre-fetch)</summary>

✅ RESOLVED 2026-07-01
The whole cascade hangs off `folkeskole_funding`. **FOUND — cleaner than expected.**
- **Numerator (kroner): `UOE1` — Udgifter til uddannelse** (Mio. kr., 2016–2024, subject 3).
  Dimension **UDDNIV** breaks out **`H10 = Grundskoler`** — folkeskole spend ISOLATED, not
  bundled. Further splittable by UDTYPE (løn/drift/investeringer) and EJER (offentlige vs
  private institutioner). NO municipal-accounts derivation needed. (Finer detail available if
  ever wanted: `REGK31` kommunernes regnskaber på funktioner — publicly pullable, but UOE1
  makes it unnecessary.)
- **Denominator (pupils): `UDDAKT20`** (Uddannelsesaktivitet i grundskolen) or **`SPECIAL1`**
  (Elever, grundskolen), subject 5.
- **Derive:** kr/elev = UOE1[H10] ÷ grundskole pupil count, deflated to real kr.
- **Caveat:** UOE1 starts 2016 → 9-year window. Acceptable for the card.
- **Output node:** `folkeskole_funding` (real kr/elev) — promotes the lever from qualitative
  box to measured trend.

</details>

### 1b. education → attainment SHARE (not headcount)  ✅ FETCHED + WIRED 2026-07-01

```
node_id:        education_share
dst_table:      HFUDD11 (re-queried, attainment dim broken out)
metric:         Tertiary education attainment share, population 15-69
unit:           percent          direction: higher_better
year_range:     2008-2025        coverage: annual, 18 points
dimension_note: tertiary = HFUDD in {H40,H50,H60,H70,H80} (KVU/MVU/BACH/LVU/Ph.d.) summed;
                denominator = HFUDD=TOT. Also computed upper_secondary_plus_share (HFUDD in
                {H20,H30,H35,H40,H50,H60,H70,H80}) as a breakdown field. BOPOMR=000,
                HERKOMST=TOT, ALDER=TOT, KØN=TOT.
status:         FOUND, fetched, written to data/dst_education_share.json
result:         tertiary share rose 25.25% (2008) -> 38.57% (2025) — steady rising trend,
                consistent with known DK attainment growth. Existing dst_education.json
                (raw HFUDD11 total headcount) left unchanged; this is a new file.
```

### 1c. learning_outcomes — DK trend  ❌ CONFIRMED ABSENT from DST 2026-07-01
- **Want:** DK learning proxy — folkeskole afgangsprøve / 9.-klasse karaktergennemsnit.
- **Result:** searched all **2,316** StatBank tables for karakter/afgangsprøve/9.-klasse/
  eksamen/testresultat → **zero real hits** (only false positives:
  `virksomhedskarakteristika` in foreign-trade TEC tables). Grade data is NOT in DST.
- **Where it actually lives:** Børne- og Undervisningsministeriet's own portal
  **uddannelsesstatistik.dk** (+ Styrelsen for IT og Læring datavarehus) — outside StatBank,
  no DST API.
- **WELA framing value:** this is a *good* gap to surface — "the core learning-outcome series
  sits OUTSIDE the national statistics apparatus." Exactly the modelapparatus hole WELA's
  report is about. Keep the node, label it as an external-source dependency, don't fake a series.
- **Fallback options:** (1) scrape/import uddannelsesstatistik.dk grade export manually;
  (2) OECD PISA-DK waves as a coarse proxy (3-year cadence). Both external to this pipeline.

### 1d. neet — DK trend  ✅ FETCHED + WIRED 2026-07-01

```
node_id:        neet
dst_table:      NEET1
metric:         NEET share, population 16-24
unit:           percent          direction: lower_better
year_range:     2008-2023        coverage: annual, 16 points
dimension_note: STATUSNEET=10 (Ikke-aktive/NEET) / STATUSNEET=00 (total) ratio. KØN=TOT,
                BOPOMR=000 (hele landet), SOCIO=TOT.
status:         FOUND, fetched, written to data/dst_neet.json
result:         9-10% range across the window (10.01% 2008 -> 9.64% 2023), broadly flat with
                cyclical bumps — matches published OECD DK NEET figures. Replaces the
                single-point 2024 HLEG benchmark.
```

Note: subject 2 (Arbejde og indkomst), not subject 5 as originally guessed — NEET1 lives with
the AKU/labour-market family, not the education tables.

### 1e. gini / inequality — DK trend  ✅ FETCHED + WIRED 2026-07-01

```
node_id:        gini
dst_table:      IFOR41
metric:         Gini coefficient, equivalised disposable income, hele landet
unit:           index (0-100)    direction: lower_better
year_range:     1987-2024        coverage: annual, 38 points
dimension_note: ULLIG=70 (Gini-koefficient — the table also carries S80/20 code 72 and
                P90/10 code 73 as alternative inequality measures, not fetched this pass).
                KOMMUNEDK=000 (hele landet).
status:         FOUND, fetched, written to data/dst_gini.json
result:         22.07 (1987) -> 30.43 (2024), a clear long rising trend — matches DK's
                well-documented post-1990s inequality increase. Much longer and more useful
                series than the single-point 2023 HLEG benchmark it replaces.
```

Note: subject 2 (Arbejde og indkomst), not subject 3 — IFOR-family income-distribution
tables live alongside INDKF, not under Økonomi.

### 1f. health nodes — DK trend  ✅ PARTIAL — FETCHED 2026-07-01 (proxy, not true HALE)

```
node_id:        health
dst_table:      SILC60
metric:         Share of population (16+) reporting bad or very bad self-rated health
unit:           percent          direction: lower_better
year_range:     2021-2025        coverage: annual, 5 points
dimension_note: SPORG=PH010 (dårligt/meget dårligt helbred), ENHED=AND (percent of
                population), BAGOPL=TOT. EU-SILC ad-hoc module — lives under subject 4
                (Sociale forhold), not subject 3 as originally guessed.
status:         PARTIAL. FOUND as a self-rated-health proxy, but NOT a true HALE
                (healthy-life-expectancy-years) series — DST does not appear to carry HALE
                itself; Den Nationale Sundhedsprofil (self-rated health survey, larger N) is
                a non-DST alternative, not pulled here to stay DST-pure per this session's
                scope decision.
api_note:       only 5 annual points (2021-2025) — SILC ad-hoc modules are short-lived by
                design, not a deep trend like IFOR41. Treat any calibration off this series
                as data-starved regardless of lag.
result:         8.1% (2025), improved slightly from 9.2% (2021). Replaces nothing directly —
                the `hale` node stays on its single-point HLEG benchmark; this is a NEW node
                (`health`) added alongside it as the best DST-native health trend available.
```

---

## JOB 2 — The MISSING node: social trust / cohesion  ✅ FOUND — RETRACTS prior "absent" claim

The card's claim that social trust **findes slet ikke i DST** is **WRONG** — corrected 2026-07-01.

```
node_id:        social_trust
dst_table:      SILC52
metric:         Average trust-in-strangers score, population 16+
unit:           score (0-10, higher_better)
year_range:     2021-2025        coverage: annual, 5 points
dimension_note: BAGOPL=TOT, ENHED=GNS (Gennemsnit for befolkningen). Table literally titled
                "Tillid til fremmede" (Trust in strangers) — subject 4 (Sociale forhold),
                EU-SILC ad-hoc trust/wellbeing module, exactly the SILC family the wishlist
                flagged as a candidate.
status:         FOUND, fetched, written to data/dst_social_trust.json
api_note:       only 5 annual points (2021-2025), same short-lived SILC ad-hoc caveat as
                JOB 1f — do not treat as a deep trend, and flag any calibration off it as
                data-starved.
result:         5.8 (2021) -> 5.7 (2025), essentially flat/slightly down. Closes the
                gini→life_satisfaction contested edge with real DK trust data — though the
                short window limits how much movement it can explain.
```

**Correction note:** the previous session's wishlist framed the *absence* of social trust
data as itself evidence for WELA's "gaps in the national statistics apparatus" argument.
That framing does not hold for this node — DST does carry it, just recently and briefly
(2021+, EU-SILC ad-hoc module). Update any card copy that stated social trust is absent.

---

## JOB 3 — Spine series for the 3 reserve cards

Lower priority — only if Jobs 1–2 are exhausted. Just confirm *existence* + table ID; don't
build full cascades yet.

### Reserve A — Grøn omstilling / just transition
- Green jobs / green-sector employment over time → **GRON1** (already have turnover; want
  employment dimension). Sectoral GHG (DRIVHUS by industry). Energy mix renewable share
  (ENE-family). Just-transition needs *employment by fossil-exposed sector* — Subject 8/9.

### Reserve B — Ulighed og social sammenhængskraft
- Overlaps Job 1e (gini) + Job 2 (trust). Add: poverty rate trend (lavindkomst, **IFOR**
  family), regional inequality (income by kommune/region).

### Reserve C — Omsorgsøkonomi / det usynlige arbejde
- **Tidsanvendelse** (time-use survey — likely sparse/old in DST; note vintage). Unpaid care
  proxy via part-time/leave statistics, **barsel** (parental leave), female labour participation
  by presence of children. Subject 5 + Subject 2.

---

## Deliverable from the mining agent

For each candidate, report back in this shape so it drops straight into the pipeline:

```
node_id:        education_tertiary_share
dst_table:      HFUDD11
metric:         % of 25-69 with tertiary education
unit:           percent          direction: higher_better
year_range:     2008–2025        coverage: annual
dimension_note: filter HFUDD11 on attainment level code <X>; do not sum
status:         FOUND | PARTIAL | ABSENT
api_note:       any gotcha (frozen table, missing total, etc.)
```

Anything marked **ABSENT** is as valuable as a FOUND — it lets the card say "we checked DST
and the data does not exist," which is exactly the data-gap evidence WELA wants to see.
