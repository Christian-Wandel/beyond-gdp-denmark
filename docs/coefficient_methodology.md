# Coefficient methodology log

**Purpose.** Records, per cascade edge, how its `strength`/`lag_years` in
`data/relationships.json` were derived — and in what order. The project's provenance
principle: **coefficients are data-driven first, literature is the sanity-check second**,
never the other way round. This log is the evidence trail that makes that ordering
verifiable, edge by edge.

Three-phase framing (see `.claude/plans` history / project session logs):
- **Phase 1** (2026-07-01) — fetch DK node time series from DST, replacing single-point
  HLEG benchmarks. Covers `folkeskole_funding`, `neet`, `gini`, `education_share`,
  `health`, `social_trust`, `class_size`, `transition`.
- **Phase 2** (2026-07-01, this log) — for edges where BOTH endpoints are now measured DK
  series, estimate `strength`/`lag_years` empirically from the data itself.
- **Phase 3** (not started — blocked on user's NotebookLM source) — for edges into
  unmeasured/external nodes (`learning_outcomes`, `life_satisfaction`, `hale`,
  `poverty_rate`), harden from literature. Literature will also revisit the Phase-2
  edges below as a cross-check, not a replacement.

## Method (Phase 2)

For each candidate edge: align the two DK series at the edge's stated `lag_years` (and a
small window of nearby lags), standardize both (z-score), and take the Pearson
correlation `r` of the standardized series as the empirical support for `strength`. Best
lag = whichever candidate lag maximizes `|r|`. Script: `.tmp/calibrate_edges.py`
(reproducible — reads `data/dst_*.json` directly, no hand-typed numbers).

**Data-starvation rule:** if the aligned sample after lag-shifting has `n < 8` annual
points, the edge is flagged data-starved. An empirical estimate on that few points is not
trustworthy enough to override a literature figure — record the attempt, keep the
literature `strength`, and defer real calibration to when more years of DK data exist (or
to Phase 3 literature cross-check as the primary source instead).

## Edges classified as both-ends-measured (of 13 total education-cascade edges)

Only 3 of 13 edges have both endpoints as real DK time series after Phase 1 — the rest
touch `learning_outcomes`, `life_satisfaction`, `hale`, or `poverty_rate`, which remain
single-point HLEG benchmarks or (for `learning_outcomes`) confirmed absent from DST. Those
stay `"draft": true` pending Phase 3.

### 1. `folkeskole_funding → neet` (lag_years=5 in current draft)

- **Series:** `data/dst_folkeskole_funding.json` (2016-2024, 9 pts) x `data/dst_neet.json`
  (2008-2023, 16 pts).
- **Result:** best-supported lag = 4y, r = 0.4524, **n = 4** overlapping points.
- **Verdict: DATA-STARVED.** The LEVER series only starts in 2016; shifting by any lag
  leaves at most 4-5 usable pairs. Not enough to trust over the literature figure.
- **Action:** `strength`/`lag_years` left at literature value (OECD Education at a Glance
  2023). `relationships.json` edge tagged `"calibration": "empirical_dk_attempted_insufficient_n"`.
- **Phase 3 status:** still needs literature hardening — will be revisited when
  NotebookLM source arrives.

### 2. `neet → income` (lag_years=10 in current draft)

- **Series:** `data/dst_neet.json` (2008-2023, 16 pts) x `data/dst_income.json`
  (1987-2024, 38 pts).
- **Result:** best-supported lag = 12y, r = 0.2485, **n = 5** overlapping points.
- **Verdict: DATA-STARVED** and weak. A 10-12y lag on a 16-year NEET series leaves almost
  nothing to fit.
- **Action:** `strength`/`lag_years` left at literature value (Gregg & Tominey 2005;
  Eurofound). Tagged `"calibration": "empirical_dk_attempted_insufficient_n"`.
- **Phase 3 status:** needs literature hardening.

### 3. `income → life_expectancy` (lag_years was 10, now 5)

- **Series:** `data/dst_income.json` (1987-2024, 38 pts) x `data/dst_life_expectancy.json`
  (1981-2024, 44 pts, biennial-cohort keys collapsed to first year per project convention).
- **Result:** best-supported lag = 5y, r = 0.9886, **n = 33** overlapping points.
- **Verdict: NOT data-starved by point-count — but flagged for a different reason.**
  r = 0.99 is implausibly clean for a social-determinants-of-health effect. Both series
  have strong, near-monotonic secular upward trends over the full 33+ year window (income
  rising with GDP growth, life expectancy rising with medical/public-health progress) —
  this correlation is very likely **trend-confounded**, not evidence of a clean isolated
  causal channel at a 5-year lag. Two independent long-run upward trends will correlate
  highly almost regardless of any real causal link between them.
- **Action:** updated `lag_years` from 10 → 5 (the empirically best-supported value).
  **Did NOT** update `strength` to reflect r=0.99 — that would be false precision dressed
  up as data-driven rigor. `strength` stays at the literature value (0.4, Marmot; Chetty et
  al. 2016). Tagged `"calibration": "empirical_dk_trend_confound"`.
- **Honest next step (not done here):** a detrended re-estimate (e.g. first-differencing
  both series, or regressing out a linear time trend before correlating residuals) would
  give a cleaner empirical `strength`. Left for a future pass — flagging the need
  explicitly rather than quietly shipping an inflated number.

## Provenance summary

| Edge | strength source | lag_years source | n | Status |
|---|---|---|---|---|
| folkeskole_funding→neet | literature (unchanged) | literature (unchanged) | 4 | data-starved, deferred |
| neet→income | literature (unchanged) | literature (unchanged) | 5 | data-starved, deferred |
| income→life_expectancy | literature (unchanged, r=0.99 not trusted as effect size) | **empirical** (10→5) | 33 | trend-confound flagged |
| all other 10 edges | literature only | literature only | — | endpoints unmeasured, Phase 3 |

No edge in this pass had its `strength` replaced by a raw empirical correlation. The
honest finding of Phase 2: **DK data currently disciplines lag choice more than it
disciplines effect size** — sample sizes are too small (or trend-confounded) to trust a
correlation as a calibrated strength yet. That itself is a useful, logged result, not a
failure of the method.

---

## Phase 3 — literature hardening via NotebookLM (2026-07-01)

> **Resolved vs. draft, at a glance:** 3 of 13 edges are evidence-resolved (`draft` dropped):
> `learning_outcomes→income`, `learning_outcomes→unemployment`, `income→life_satisfaction`. The
> other 10 remain provisional — see per-edge notes below. `neet→income` is deliberately KEPT
> provisional despite strong new literature support, because its Phase-2 data-starved empirical
> calibration tag (`empirical_dk_attempted_insufficient_n`) is still unresolved; literature
> corroboration alone wasn't judged sufficient to call it resolved. This split is intentionally
> NOT drawn on the dashboard graph (all edges render the same way regardless of draft status) —
> it's surfaced instead in the dashboard's "Hvad vi fandt" findings panel and here.

**Source:** a 21-document NotebookLM notebook assembled by the user from a widened Perplexity
literature search (any high-income OECD/European country, ranked by causal-identification
quality, not geography-first). Extraction: one query per source (21 queries), fixed schema
(headline effect + unit, identification design, population/country, lag, DK relevance). Full
raw extractions logged in `.tmp/phase3_extractions.md`; harmonization reasoning in
`.tmp/phase3_harmonization.md`.

**Harmonization method:** elasticity-first, expert-band fallback (locked with user in plan mode).
Where units convert defensibly (SD, log points, %), derive a standardized effect and map onto the
graph's 0–1 `strength` scale using rough Cohen's-d-style band anchors (weak 0.15-0.20, weak-
moderate 0.20-0.35, moderate 0.35-0.50, strong 0.50-0.65 — the corpus's practical ceiling,
consistent with Phase 1/2 precedent). Where units resist honest conversion (IRR, rank-rank slope,
descriptive trajectory probabilities), assign a documented band with the raw stat and reasoning
kept alongside — never stretch a shaky conversion into false precision.

**Tooling note:** this round surfaced and fixed a real bug in the `notebooklm` Claude Code skill
(`~/.claude/skills/notebooklm/scripts/ask_question.py`) — it selected the "newest" answer by DOM
array order (`elements[-1]`), but NotebookLM does not render/recycle answer bubbles in DOM order.
Verified via direct browser probing that answer bubbles can appear out of chronological order in
the DOM NodeList; the reliable "newest" signal is vertical scroll position
(`bounding_box().y`, bottom-most = newest). Fixed by sorting candidates by `y` position and adding
a Submit-button click as a fallback to the Enter keypress. Confirmed working before the real
extraction round began (verified against multiple distinct probe questions).

### Per-edge Phase 3 findings

**folkeskole_funding → learning_outcomes** — 5 sources triangulated (Jackson/Johnson/Persico
2016 US 2SLS/DiD; Hyman 2016 Michigan IV; UK DfE literature review 2017; Kaarsen & Rizvanovic
DK gymnasium IV). Two independent secondary-level NULL results (DK gymnasium completion/GPA/
further-ed all null; UK KS4 null in DfE's own analysis) plus a wide primary-level range (0.04-
0.25 SD per $1,000/10%) across designs. `strength` 0.4→0.25, `lag_years` 3→2. Kept `draft: true`
— genuine disagreement across studies, better-bounded rather than resolved.

**folkeskole_funding → neet** — confirmed genuine gap. No source in the 21-document corpus
quantifies this edge, matching the earlier Perplexity search's finding. Two independent
literature searches (Perplexity, NotebookLM) now agree this is unquantified in available
literature. No change; Phase 2 data-starved empirical tag stands.

**learning_outcomes → income** — cross-checked against OECD Education at a Glance 2024 (tertiary
IRR 15% men / 18% women, Denmark-specific NPV figures) and Jackson et al.'s reform-induced wage
gains (7-7.74% per 10% spending). Converges closely with the existing Mincerian literature value.
`strength` 0.6→0.55 (slight discount for IRR describing individual returns vs. this edge's
population-level framing). **Draft dropped** — best-evidenced edge in the cascade.

**learning_outcomes → unemployment** — DK-specific data found: OECD EaG 2024 employment rate by
attainment, Denmark 2023 (62% below-secondary vs 89% tertiary, 27pp gap). `strength` 0.4→0.55.
**Draft dropped** — DK-specific statistic closes this edge convincingly.

**neet → income** — two independent high-quality causal designs converge: Andersson/Brännström/
Mörtvik (2018) Swedish twin-pair design (1yr NEET → 33% lower income, dose-responsive to 62% at
3yr) and Gregg & Tominey (2005) UK IV design (13-21% wage scar, near-permanent after 20+ years).
Twin-pair design is the single cleanest identification found in the entire corpus (controls
family confounds via intra-twin comparison). `strength` 0.5→0.6. Phase 2's data-starved empirical
tag (`empirical_dk_attempted_insufficient_n`) preserved and its note appended, not replaced —
**kept `draft: true`** despite the strong literature corroboration, since the unresolved
data-starved calibration flag means this edge isn't fully resolved yet.

**neet → life_satisfaction** — OECD 0-10 ladder data (employment-status proxy: full-time employed
6.5 vs "others" 6.1, 0.4pt gap ≈0.19 SD-equivalent) is weaker than the Clark et al. citation
implied. `strength` 0.35→0.25. Kept draft — proxy scope gap (employment status, not NEET
specifically) keeps this unresolved.

**income → life_satisfaction** — OECD Gallup 0-10 ladder data (richest 20% = 6.4 vs poorest 20% =
5.8, 0.6pt gap ≈0.29 SD-equivalent) closely confirms the existing literature value. `strength`
unchanged at 0.3. **Draft dropped** — direct point estimate matches closely enough to consider
resolved.

**income → hale** — Danish disease-incidence gradient study (Pallesen et al. 2024, 4.5M
residents, schizophrenia IRR 18.4 men/10.1 women) confirms the DK-specific gradient exists and is
real, but is disease-specific incidence data, not a HALE effect size. Converting an IRR directly
into this edge's strength would repeat the exact false-precision failure mode already rejected on
`income→life_expectancy`'s r=0.99 — **not done**. A second candidate (Balaj et al. mortality
meta-analysis) could not be verified as grounded in the actual uploaded PDF text this session
(NotebookLM explicitly disclosed the numbers came from its own general knowledge, not a corpus-
grounded read) — flagged, not used without independent verification. No strength/lag change;
tagged `phase3_literature_reviewed_no_convertible_estimate`.

**income → life_expectancy** — no additional corpus-grounded cross-check found (the one candidate,
Balaj et al., is unverified per above). Phase 2's trend-confound caveat and detrending
recommendation stand unchanged.

**learning_outcomes → gini** — three sources triangulated, disagreeing on mechanism/magnitude:
Goldin & Katz (US, elasticity −0.61, individual wage-compression channel — the only convertible
elasticity found); Kim (2014, 100-country panel, fixed-effects 0.170, explicitly weaker in
developed countries like Denmark); Breen & Andersen (2012, DK-direct, whole-population register
data, assortative-mating shifts explain ~40% of Denmark's 1987-2006 inequality rise via a
household-formation channel, different from the wage-compression mechanism). `strength` 0.3→0.35
— small increase reflecting three converging-but-disagreeing sources rather than one contested
citation, kept moderate given DK-relevance caveats on all three. Remains "most contested edge."

**neet → poverty_rate** — Norwegian full-population registry study (Heglum & Nilsen 2024,
125,804 individuals) finds long-term-exclusion trajectory probability rising 19%→33% across
cohorts and disability-pension trajectory rising 7.8%→11.4% — descriptive, DK-region-adjacent.
`strength` 0.4→0.45. Lag tension explicitly flagged: the Norwegian study's window is 10 years,
longer than this edge's 5y, but poverty risk is expected to manifest faster than the full
wage-scarring effect on `neet→income` — 5y kept as a defensible middle estimate, not resolved to
either extreme.

**gini → life_satisfaction** — literature search found supporting context (Denmark's low
corruption perception, general OECD trust/inequality gradient) but no direct quantitative
Gini→satisfaction coefficient. Remains the single least-evidenced edge in the cascade; no change.

**income → learning_outcomes (loop)** — Chetty DK rank-rank slope (0.180, vs US 0.341) treated as
an upper-bound anchor, since it measures whole-of-life-course income mobility, not the
income→learning_outcomes sub-link specifically. A second DK proxy (national-test parental-
EDUCATION gradient, 0.25-1+ SD) is an adjacent-variable substitution, not a direct income
estimate — the proxy-substitution case anticipated in the Phase 3 plan. `strength` 0.35→0.3,
treating 0.180 honestly as an upper bound rather than a direct point estimate.

### Phase 3 provenance summary

| Edge | Phase 3 strength | Phase 3 lag | Draft dropped | Basis |
|---|---|---|---|---|
| folkeskole_funding→learning_outcomes | 0.25 (was 0.4) | 2 (was 3) | No | 5-source triangulation, 2 nulls |
| folkeskole_funding→neet | 0.35 (unchanged) | 5 (unchanged) | No | confirmed gap, 2 searches agree |
| learning_outcomes→income | 0.55 (was 0.6) | 8 (unchanged) | **Yes** | OECD IRR + Jackson et al. |
| learning_outcomes→unemployment | 0.55 (was 0.4) | 5 (unchanged) | **Yes** | DK-specific OECD data |
| neet→income | 0.6 (was 0.5) | 10 (unchanged) | No (Phase-2 flag unresolved) | twin-pair + UK IV converge |
| neet→life_satisfaction | 0.25 (was 0.35) | 2 (unchanged) | No | OECD ladder, employment proxy |
| income→life_satisfaction | 0.3 (unchanged) | 1 (unchanged) | **Yes** | OECD ladder, direct match |
| income→hale | 0.4 (unchanged) | 10 (unchanged) | No | IRR proxy only, not convertible |
| income→life_expectancy | 0.4 (unchanged, Phase 2 stands) | 5 (unchanged) | No | no new corpus-grounded check |
| learning_outcomes→gini | 0.35 (was 0.3) | 15 (unchanged) | No | 3 sources disagree on mechanism |
| neet→poverty_rate | 0.45 (was 0.4) | 5 (unchanged) | No | Norway registry, lag tension flagged |
| gini→life_satisfaction | 0.25 (unchanged) | 3 (unchanged) | No | context only, no coefficient |
| income→learning_outcomes (loop) | 0.3 (was 0.35) | 15 (unchanged) | No | Chetty DK, treated as upper bound |

**3 of 13 edges resolved** (draft dropped) this phase — `learning_outcomes→income`,
`learning_outcomes→unemployment`, `income→life_satisfaction`. **10 remain draft**, including
`neet→income` which has strong new literature support but keeps `draft: true` because its
Phase-2 data-starved calibration tag is still unresolved. All 13 edges now carry documented
Phase 3 literature reasoning instead of a single unchallenged citation. Honest findings carried
forward: (1) `folkeskole_funding→neet` remains a genuine, twice-confirmed literature gap; (2)
`income→hale` and `income→life_expectancy` both had a candidate source that either wasn't
directly convertible (IRR→HALE) or couldn't be verified as corpus-grounded — neither was forced
into a number; (3) `learning_outcomes→gini` and `income→learning_outcomes` both surfaced genuine
proxy-substitution cases (DK-direct data exists but measures an adjacent variable, not the edge's
precise definition) — flagged explicitly rather than presented as direct estimates.

## Current data status (moved from the dashboard side panel, 2026-07-02)

- **Learning outcomes** (9th-grade averages) and **student wellbeing** are now fetched
  from uddannelsesstatistik.dk — data that sits outside Danmarks Statistik, which is
  itself evidence for the argument that core wellbeing data lives outside the national
  statistics apparatus.
- Social trust exists in DST but only as a short window (EU-SILC 2021-2025, 5 points) —
  too short for reliable calibration.
- Primary school funding, NEET, and Gini are all real time series (no longer single-year
  benchmarks).

### Data wishlist → index

- A tertiary/attainment share series would make the funding link measurable over time.
- More years of DK time series (funding, trust) would enable real empirical DK
  calibration — most links are still data-starved today.
- A longer trust series would close the inequality→social cohesion link and feed a
  broader wellbeing index.
