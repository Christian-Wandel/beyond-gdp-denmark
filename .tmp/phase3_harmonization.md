# Phase 3 — harmonization to 0–1 strength scale

Method locked with user: **elasticity-first, expert-band fallback.** Where units convert
defensibly (SD, log points, %), derive a standardized effect and map it onto 0–1. Where units
resist honest conversion (IRR, rank-rank slope, descriptive probabilities), assign a documented
band — weak 0.2 / moderate 0.4 / strong 0.6 — with the raw stat and reasoning kept alongside, not
silently discarded. Never stretch a shaky conversion into false precision (same discipline as the
Phase-2 income→life_expectancy rejection).

Band anchors used throughout (rough Cohen's-d-style convention, adapted for social-science
between-quartile/decile contrasts which run smaller than clinical effect sizes):
- **0.15-0.20 SD or less** → weak (0.15-0.20)
- **0.20-0.40 SD** → weak-moderate (0.20-0.35)
- **0.40-0.60 SD** → moderate (0.35-0.50)
- **>0.60 SD or a >30% relative change** → strong (0.50-0.65)
(The graph's existing edges top out around 0.6, so this project treats 0.6-0.65 as its practical
ceiling for "strong," consistent with Phase-1/2 precedent.)

---

## 1. folkeskole_funding → learning_outcomes

**Sources:** #1 Jackson/Johnson/Persico (US, 2SLS/DiD), #2 working_paper_gymnasier (DK, IV,
NULL), #3 DK national-tests co-teacher (DK, causal, targeted personnel), #13 UK DfE lit review
(range 0.04-0.25 SD, KS4 null), #15 Hyman/Michigan (US, IV, smaller than #1).

- Five independent identifications, two of them **DK-specific and both null-to-modest**:
  - DK gymnasium (upper-secondary): **null** on completion/GPA/further-ed (IV).
  - UK secondary (KS4): **null** in the DfE's own analysis; literature range only 3-9% SD.
  - US primary-school studies (#1, #15): real, positive, but blanket per-pupil funding effects of
    ~0.05-0.25 SD per $1,000/10%, converging toward the LOW end of that range once multiple
    designs are triangulated (Hyman explicitly smaller than Jackson et al.).
  - UK primary (KS2): real but modest, 0.04-0.25 SD, short-lag (2y) only established.
  - DK **targeted personnel** intervention (co-teacher): closes HALF the achievement gap — but
    this is targeted resource allocation, not blanket per-pupil funding; a different lever than
    what `folkeskole_funding` measures.
- **Harmonization:** blanket per-pupil funding → learning outcomes is a real but modest, primary-
  level-only effect, with secondary-level nulls in TWO countries (DK, UK). Elasticity-convertible
  from the SD range: take the lower-middle of the literature range (~0.10-0.15 SD per $1,000/
  10%-equivalent) as the standardized effect, not the top-end 0.25 SD (that's the single most
  optimistic natural-experiment result, not the median).
- **Verdict: strength = 0.25** (down from draft 0.4). **Weak-moderate band**, reflecting: real
  primary-level effect exists but is modest and secondary-level nulls (incl. DK's own gymnasium
  result) pull the DK-relevant magnitude down. **confidence = med** (down from med — no change in
  label but now grounded in genuine cross-study convergence rather than a single contested
  citation). **lag_years = 2** (down from 3) — the two studies that actually test lag structure
  (UK DfE, DK gymnasium both ~2-4y horizons) support a short lag, not the previously-assumed 3y
  guess with no basis.
- **NOT drafted:** keep `"draft": true` — real disagreement across studies (null vs. positive)
  means this is not "resolved," it's "better bounded."

## 2. folkeskole_funding → neet

**Sources:** none of the 21 sources directly address funding→NEET as a single coefficient (the
9-gap list from the Perplexity round said the same). Phase 2 empirical attempt was data-starved
(n=4). No new literature closes this gap either.

- **Verdict: NO CHANGE.** Keep literature value (OECD Education at a Glance 2023 NEET chapter,
  strength 0.35, lag 5). Confirm this remains a genuine gap even after two independent literature
  searches (Perplexity + NotebookLM) — worth noting explicitly rather than silently reusing the
  old citation.
- **Closest defensible adjacent proxy (per plan Step C provision):** #13's finding that KS4/
  secondary-level funding effects are null suggests the funding→retention/dropout channel (which
  feeds into NEET) may be weaker than the funding→primary-attainment channel. This is directional
  supporting evidence for NOT raising this edge's strength, but not a quantified proxy — recorded
  as a qualitative note only, `calibration` tag unchanged.

## 3. learning_outcomes → income

**Sources:** #1 Jackson et al. (7-7.74% wage gain per 10% spending, via attainment), #10 OECD EaG
2024 (IRR 15-18% tertiary vs. upper-secondary; DK-specific NPV figures), #11 Goldin & Katz
(elasticity −0.61 on wage premium, opposite-direction edge but same mechanism), #4 Chetty
(DK rank-rank 0.180, education as an intermediate mechanism, though the DK breakout isn't
education-specific).

- The clearest elasticity-convertible figure here is actually IRR-based (source #10): tertiary
  IRR 15-18% is a strong, well-established "wage premium per education tier" signal, consistent
  with Mincerian returns (8-10%/year) already in the current draft.
- Cross-check: Jackson et al.'s ~7-8% wage gain per 10% *spending* increase (not per year of
  attainment) is a different unit — funding-mediated, not the direct learning→income elasticity
  wanted here. Not double-counted; kept separate from this edge's harmonization.
- **Verdict: strength = 0.55** (down slightly from draft 0.6). The literature strongly and
  consistently supports a REAL, fairly large effect (IRR 15-18%, Mincerian 8-10%/year) — this is
  the best-evidenced edge in the whole cascade. Keeping it just under the original 0.6 reflects
  that IRR/Mincer returns, while robust, describe an individual human-capital return, not
  necessarily the population-level pass-through this edge represents at the graph's coarser
  grain. **confidence = high** (unchanged — genuinely high confidence, multiple corroborating
  designs). **lag_years = 8** (unchanged — no source in this batch tested this specific lag
  directly; the Chetty DK income-cohort spacing of ~12-15y is a distant proxy, not a direct
  replacement).
- **Drop `"draft": true`.** This edge now has enough independent, mutually-consistent literature
  support (OECD IRR, Mincer, US natural experiments, Chetty mechanism note) to be considered
  resolved.

## 4. learning_outcomes → unemployment

**Sources:** #10 OECD EaG 2024 (DK-specific employment rates by attainment, 2023).

- **DK-direct, elasticity-convertible:** employment rate 62% (below-secondary) → 89% (tertiary) =
  27 percentage-point gap. As a share-of-population effect this is LARGE — converting a 27pp
  gap across the full attainment range to a standardized effect: roughly equivalent to a
  >0.6 SD-scale shift in employment probability (27pp on a base rate spanning 62-89% is a big
  share of the total possible range).
- **Verdict: strength = 0.55** (up from draft 0.4). This is now a DK-specific, descriptive but
  very large and consistent OECD statistic — among the strongest, most directly-DK-relevant
  numbers in the whole extraction round. **confidence = high** (up from high — same label,
  stronger grounding: DK-specific data, not a generic OECD/ILO citation). **lag_years = 5**
  (unchanged — attainment-to-employment-status is close to concurrent/short-lag in this cross-
  sectional data, but the current draft's 5y sits reasonably between "concurrent" and "long-run
  scarring", kept as a conservative middle estimate absent a lag-specific study).
- **Drop `"draft": true`** — DK-specific data closes this edge convincingly.

## 5. neet → income

**Sources:** #6 Andersson/Brännström/Mörtvik (Sweden, twin-pair, STRONGEST anchor in corpus),
#5 Gregg & Tominey (UK, IV, youth-unemployment proxy), #7 Heglum & Nilsen (Norway, descriptive,
disability-trajectory context).

- **Elasticity-convertible, best design in the whole corpus:** twin-pair estimates, log-scale
  point estimates −0.512 (2y NEET) to −0.980 (3y NEET). Converting via %Δ = (e^b−1)×100:
  1y→33%, 2y→40%, 3y→62% lower income. This is a genuine dose-response relationship, not a
  single point estimate — take the **1-year exposure figure (33%) as the closest match** to the
  graph's single-lever framing (the cascade's `neet` node is a share/rate, not a duration
  variable).
- Cross-check with Gregg & Tominey (UK): 13-21% wage scar per year of youth unemployment — same
  direction, smaller magnitude, different population/method (IV vs. twin-pair). The twin-pair
  design controls family confounds better; UK IV controls local-labor-market confounds better.
  Both point to a large, persistent, well-identified effect.
- **Verdict: strength = 0.6** (up from draft 0.5). Two independent, high-quality causal designs
  (Nordic twin-pair, UK IV) converge on a large and long-lasting effect — this is now one of the
  best-evidenced edges in the cascade, not a weakly-cited assumption. **confidence = high**
  (unchanged label, much stronger grounding). **lag_years = 10** (unchanged — both sources
  support long horizons: Sweden 8-10y, UK up to 26y with only partial recovery; 10y remains a
  reasonable conservative middle value, could arguably go higher but keeping consistent with the
  existing Phase-2 data-starved empirical attempt's ballpark).
- **Keep `"draft": true`** (revised from initial plan) — while literature now strongly
  corroborates the edge, it still carries the Phase-2 `calibration: empirical_dk_attempted_
  insufficient_n` tag; dropping `draft` while that unresolved-data flag remains would be
  inconsistent. UPDATE the note to record the literature corroboration, append to (don't replace)
  the Phase-2 text.

## 6. neet → life_satisfaction

**Sources:** #12 OECD Review/Life at a Glance (employment-status proxy: 6.5 vs 6.1 on 0-10
ladder = 0.4 point gap). #7 Heglum & Nilsen explicitly has NO wellbeing data.

- **Elasticity-convertible via point-scale:** 0.4 points on a 0-10 ladder ≈ small-to-moderate
  effect. Converting via the ladder's typical SD (~2.0-2.2 points in OECD Gallup data): 0.4/2.1 ≈
  0.19 SD-equivalent — a WEAK standardized effect.
- Note the OECD figure uses "full-time employed vs. others" as a coarse NEET proxy, not NEET
  status directly — a scope proxy, flagged.
- **Verdict: strength = 0.25** (down slightly from draft 0.35). The direct point-scale evidence
  is real but smaller than the literature-only Clark et al. citation implied. **confidence = med**
  (down from med — same label, now grounded in an actual OECD figure rather than a single-book
  citation, but the employment-proxy scope gap keeps confidence from rising to high).
  **lag_years = 2** (unchanged — no source tested this lag specifically; kept as-is).
- **Keep `"draft": true`** — proxy-based, not a direct NEET-specific number; not fully resolved.

## 7. income → life_satisfaction

**Sources:** #12 OECD Review (richest 20% vs poorest 20%: 6.4 vs 5.8 = 0.6 point gap).

- **Elasticity-convertible:** 0.6/2.1 ≈ 0.29 SD-equivalent — weak-moderate.
- This is a clean, direct, OECD-wide (not DK-specific but broad-sample) point estimate matching
  exactly the edge definition (income→life_satisfaction, not a proxy).
- **Verdict: strength = 0.3** (unchanged from draft 0.3 — remarkably, the literature converges
  almost exactly on the existing draft value). **confidence = high** (up from high — same label,
  now grounded in a specific OECD Gallup figure rather than only Kahneman/Deaton/Killingsworth
  citations). **lag_years = 1** (unchanged — concurrent-measure data, no lag tested, but income-
  satisfaction relationships are generally treated as fast-acting in this literature, consistent
  with keeping a short lag).
- **Drop `"draft": true`** — direct point estimate confirms the existing literature value closely
  enough to consider this resolved.

## 8. income → hale

**Sources:** #8 Pallesen et al. (DK, IRR-based, PROXY ONLY per explicit caveat — disease
incidence, not HALE), #9 Balaj et al. mortality meta-analysis (⚠️ NOT CORPUS-GROUNDED, unverified).

- **No convertible elasticity available that meets the provenance bar.** #8 is IRR-based disease
  incidence (schizophrenia IRR 18.4/10.1, wide variance by disease) — converting a
  disease-specific IRR into a single HALE elasticity would be exactly the kind of false-precision
  the project's methodology explicitly rejects (same failure mode as the income→life_expectancy
  r=0.99 trend-confound). #9's numbers are NotebookLM-asserted but explicitly flagged as not
  grounded in the actual uploaded PDF text this session — cannot be used without independent
  verification.
- **Verdict: NO CHANGE to strength/lag.** Keep literature value (Marmot/WHO, strength 0.4, lag
  10). **Action:** note in the edge that #8 supports the EXISTENCE and DK-relevance of an income-
  health gradient (directionally confirms the edge is real) without supplying a usable magnitude,
  and that #9 needs independent verification before any future use. Add
  `"calibration": "phase3_literature_reviewed_no_convertible_estimate"`.
- **Keep `"draft": true`.**

## 9. income → life_expectancy

**Sources:** #9 Balaj et al. (⚠️ unverified, see above) is the only new candidate; nothing else in
this batch addresses life expectancy specifically (as distinct from HALE or disease incidence).

- **Verdict: NO CHANGE.** This edge already carries its Phase-2 empirical treatment (lag updated
  5y, strength held at literature 0.4, tagged `empirical_dk_trend_confound`). Phase 3 does not
  have a corpus-grounded number to add. Do not use the unverified Balaj figures here either.
  **Append a note** that Phase 3 literature search found no additional corpus-grounded
  cross-check; the trend-confound caveat and detrending recommendation from Phase 2 both stand
  unchanged.

## 10. learning_outcomes → gini

**Sources:** #11 Goldin & Katz (elasticity −0.61, US), #14 Kim 2014 (fixed-effects 0.170,
100-country, explicitly WEAKER in developed nations), #16 Breen & Andersen (DK-direct, 40% of
DK's 1987-2006 inequality rise attributable to assortative mating shifts).

- **Two different mechanisms, both pointing to a real effect, disagreeing on magnitude:**
  - Individual wage-compression channel (Goldin & Katz): elasticity −0.61 is a genuinely large,
    convertible number, but US-only and it's the *inverse* framing (skill supply expansion
    compresses wages) — directly usable after sign-matching to the graph's
    negative-direction convention.
  - Household-formation channel (Breen & Andersen): DK-direct, ~40% of a multi-decade inequality
    rise — very large, but this is a level-shift decomposition over 20 years, not a per-unit
    elasticity; converting to a standardized single-edge effect requires real judgment.
  - Cross-country panel (Kim): explicitly says the effect is smaller in developed countries like
    Denmark — a caution against over-weighting the largest available number.
- **Elasticity-first result:** Goldin & Katz's −0.61 is the only genuinely defensible convertible
  elasticity. Treating |0.61| as a strong standardized effect (this is a very large elasticity by
  economic standards) but discounting toward the moderate band because (a) it's a US proxy not DK
  data, (b) Kim's cross-country evidence says the developed-country effect is smaller, (c) the
  DK-direct evidence (Breen & Andersen) operates through a different mechanism that doesn't
  translate to the same units.
- **Verdict: strength = 0.35** (up from draft 0.3). Small increase reflecting that this edge now
  has THREE converging, non-trivial sources (all real, all support a genuine negative
  relationship) rather than one contested citation, but staying moderate rather than jumping to
  the elasticity's raw magnitude given the DK-relevance caveats on all three sources.
  **confidence = med** (unchanged label — three sources agree on direction and rough magnitude,
  but disagree enough on mechanism/size that "high" would overstate precision). **lag_years = 15**
  (unchanged — no source in this batch tested this specific lag; Breen & Andersen's 1987-2006
  window is ~19 years, roughly consistent with keeping a long lag).
- **Keep `"draft": true`** — genuinely still "most contested edge" per the original note, now with
  better-documented disagreement rather than resolved.

## 11. neet → poverty_rate

**Sources:** #7 Heglum & Nilsen (Norway, descriptive, disability-trajectory probability rising
7.8%→11.4%, long-term-exclusion probability 19%→33%), #6 Andersson et al. (income-reduction as an
adjacent proxy, not poverty directly).

- **No single clean elasticity** — #7's numbers are trajectory-cluster probabilities from a
  multinomial model, not a simple "NEET → poverty rate" coefficient. #6's income effects (33-62%
  income reduction) are the closest convertible adjacent number but measure income, not poverty
  status specifically.
- **Expert-band placement:** the magnitude and direction across both sources (large, rising over
  time, dose-responsive to NEET duration) supports a MODERATE-TO-STRONG band rather than the
  draft's moderate 0.4. Using #7's long-term-exclusion trend (19%→33%, nearly doubling) as the
  qualitative anchor for the band choice.
- **Verdict: strength = 0.45** (up from draft 0.4). **confidence = med** (unchanged — real,
  DK-region-adjacent (Norway) descriptive evidence, but not a directly converted elasticity, so
  not raised to high). **lag_years = 5** (unchanged — #7's window is actually 10 years (age 22→31)
  from NEET status, longer than the current draft's 5y; consider this a case where the literature
  argues for LENGTHENING the lag, but the note explicitly says poverty risk shows up faster than
  the full wage-scar effect — keeping 5y as a defensible middle position between "immediate" and
  the full 10y trajectory horizon, noting the tension explicitly rather than silently picking one).
- **Keep `"draft": true`** — real evidence, but band-based not elasticity-based, and lag choice
  involves a judgment call flagged above.

## 12. gini → life_satisfaction

**Sources:** #12 OECD Review (trust/corruption context, DK specifically low-corruption-perception,
no direct Gini→life-satisfaction point estimate).

- **No new quantitative link found.** The Wilkinson & Pickett citation in the draft remains
  unchallenged and un-corroborated by this corpus — still the single least-evidenced edge.
- **Verdict: NO CHANGE.** Keep literature value (strength 0.25, low confidence, contested=true).
  Add a note that Phase 3 literature search found supporting CONTEXT (DK's low corruption
  perception, general trust/inequality gradient) but no direct quantitative Gini→satisfaction
  coefficient to replace the contested Wilkinson & Pickett citation.

## 13. income → learning_outcomes (loop edge)

**Sources:** #4 Chetty (DK rank-rank 0.180 — whole-of-life mobility slope, not education-specific
sub-effect), #3 DK national-tests (parental EDUCATION gradient 0.25-1+ SD — explicit proxy, not
income).

- **Two DK-direct numbers, neither a perfect match:** Chetty's DK rank-rank (0.180) measures
  parent-income → child-income mobility across the whole life course, not specifically the
  learning_outcomes node. The national-tests source measures parental EDUCATION → test scores,
  not parental INCOME.
- **Elasticity-first attempt:** rank-rank slope 0.180 is already a standardized (0-1 scale)
  correlation-like measure — no further conversion math needed, but it measures the wrong
  variable pair for a precise match (whole-income-mobility, not the income→learning_outcomes
  sub-link specifically). Treating 0.180 as a reasonable **upper-bound anchor** since the true
  income→learning_outcomes sub-effect should be smaller than the full multi-stage mobility slope
  it's embedded in.
- **Verdict: strength = 0.3** (down slightly from draft 0.35). Reflects that the DK-direct
  rank-rank number (0.180) is lower than the current draft's literature-only Chetty citation
  implied, once treated honestly as an upper bound rather than a direct estimate.
  **confidence = med** (unchanged — real DK number available now, but explicitly flagged as an
  imperfect proxy rather than a precise match, so not raised to high). **lag_years = 15**
  (unchanged — Chetty's DK parent/child measurement gap is ~12-15 years, consistent with keeping
  15y).
- **Keep `"draft": true`; add explicit proxy note** — both available DK numbers are proxies
  (whole-mobility slope OR education-not-income gradient), not a precise income→learning_outcomes
  estimate. This is the proxy-substitution case anticipated in the original plan.

---

## Summary table (for the methodology-doc provenance table)

| Edge | Old strength | New strength | Old lag | New lag | Draft dropped? |
|---|---|---|---|---|---|
| funding→learning_outcomes | 0.4 | 0.25 | 3 | 2 | No |
| funding→neet | 0.35 | 0.35 (unchanged) | 5 | 5 | No |
| learning_outcomes→income | 0.6 | 0.55 | 8 | 8 | **Yes** |
| learning_outcomes→unemployment | 0.4 | 0.55 | 5 | 5 | **Yes** |
| neet→income | 0.5 | 0.6 | 10 | 10 | **Yes** |
| neet→life_satisfaction | 0.35 | 0.25 | 2 | 2 | No |
| income→life_satisfaction | 0.3 | 0.3 (unchanged) | 1 | 1 | **Yes** |
| income→hale | 0.4 | 0.4 (unchanged) | 10 | 10 | No |
| income→life_expectancy | 0.4 | 0.4 (unchanged, Phase 2 stands) | 5 | 5 | No |
| learning_outcomes→gini | 0.3 | 0.35 | 15 | 15 | No |
| neet→poverty_rate | 0.4 | 0.45 | 5 | 5 | No |
| gini→life_satisfaction | 0.25 | 0.25 (unchanged) | 3 | 3 | No |
| income→learning_outcomes (loop) | 0.35 | 0.3 | 15 | 15 | No |

3 of 13 edges resolved (draft dropped): learning_outcomes→income, learning_outcomes→unemployment,
income→life_satisfaction. 10 remain draft (including neet→income, which has strong new
literature support but keeps `draft: true` because its Phase-2 data-starved calibration tag is
still unresolved) but all now have documented Phase-3 literature reasoning instead of a single
unchallenged citation.
