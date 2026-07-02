# Phase 3 — per-source extraction log

Raw NotebookLM answers, one section per source. Verbatim (lightly trimmed of UI cruft
like `more_horiz` footnote markers). Query template used for each source:

> For the source [FILENAME] specifically (not other sources), tell me: (1) the headline
> effect size and its exact unit, (2) the causal identification design (RCT / natural
> experiment / IV / DiD / RDD / 2SLS / OLS / descriptive gradient — be precise), (3) the
> population and country studied, (4) any stated lag or time horizon between cause and
> effect, (5) whether this is directly relevant to Denmark or a proxy from elsewhere.
> Be concise and quote the actual number(s).

Status: COMPLETE. All 21 sources in the notebook extracted (18 numbered sections above; #3 and
#12 each cover 2 sources; #17-18 reviewed and excluded as off-cascade/not-DK-relevant).

**Tooling note:** the notebooklm skill (`~/.claude/skills/notebooklm/scripts/ask_question.py`)
had a bug where it selected the "newest" answer by DOM array order (`elements[-1]`), but
NotebookLM does not render/recycle answer bubbles in DOM order — verified via direct probing
that the true newest answer is whichever bubble has the highest `bounding_box().y` (bottom of
scroll). Fixed by sorting candidates by `y` position instead of array index, and adding a
Submit-button click as a fallback to the Enter keypress. Fix verified against multiple probes
before this extraction round began.

---

## 1. THE EFFECTS OF SCHOOL SPENDING ON EDUCATIONAL Outcomes.pdf

**Edge:** funding → learning_outcomes (also touches income, poverty_rate)

Jackson, Johnson & Persico (2016). Natural experiment: event-study + 2SLS/DiD exploiting
court-mandated US school finance reforms. Sample: 15,353 individuals, 1,409 school districts,
all 50 US states + DC, cohorts born 1955-1985.

- **10% increase in per-pupil spending for all 12 school years (ages 5-17)** →
  - +0.31 completed years of education (all); +0.46 years for low-income families
  - +7% higher wages (7.74% preferred model); +9.6% for low-income families
  - −3.2 percentage points annual adult poverty incidence; −6.1pp for low-income families
- **Lag:** childhood spending (ages 5-17) → adult outcomes measured ages 20-45 (~10-30y horizon,
  not a single lag)
- **DK relevance:** proxy from the US. Cited within the notebook's Danish source (gymnasier
  working paper) as the key example of "reform-induced exogenous variation" literature.

## 2. working_paper_gymnasier.pdf

**Edge:** funding → learning_outcomes — **DK-DIRECT, HIGH-QUALITY IV DESIGN**

Kaarsen & Rizvanovic. IV design exploiting a 2008 Danish reform standardizing gymnasium (upper
secondary) subsidies; pre-reform (2007) funding levels used as instrument for exogenous funding
change. Population: Danish public gymnasier (almene gymnasier), cohorts entering 2004-2016.
Reform phased in fully by 2012.

- **Finding: NO SIGNIFICANT EFFECT.** Per 10,000 DKK funding increase: completion −0.001
  (SE 0.001), GPA +0.003 (SE 0.003), further-education transition −0.001 (SE 0.001). All
  statistically indistinguishable from zero.
- Outcomes measured: completion within 4y of entry, GPA, further-education transition within 2y
  of graduation. Robustness checks (elective choices, alternate GPA measures) also null.
- **Important — this directly contradicts the literature-only draft strength (0.4) currently on
  `folkeskole_funding → learning_outcomes`.** Caveat: this study is gymnasium (upper secondary,
  ages ~16-19), not folkeskole (primary/lower-secondary, ages 6-16) — the cascade's lever node is
  folkeskole funding specifically. Directionally still the single cleanest DK-specific
  identification available and should pull the edge's strength down / confidence down, but is not
  a perfect population match.

## 3. childresearch-au-dk-en-signature-project-read...national-tests.pdf (both DK national-test docs)

**Edges:** income → learning_outcomes (proxy via parental education); funding/personnel → learning_outcomes

DK descriptive study, national test data 2010-2014, grades 2/3/4/6/7/8, ~50,000 students/year/
cohort/test (reading, math, English, sciences). Not itself causal, but cites the Danish
Co-teacher Experiment as a causal illustration.

- **SES gradient (proxy for income→learning_outcomes):** children of mothers with only
  compulsory schooling score **0.25 SD below** children of vocationally-trained mothers, and
  **>1 SD below** children of tertiary-educated mothers. **Caveat: this is parental EDUCATION,
  not parental INCOME** — usable as a proxy for the income→learning_outcomes edge but must be
  flagged explicitly as an education-gradient proxy, not a direct income estimate (matches the
  gap already flagged in the session log from the Perplexity round).
- **Causal intervention (funding/personnel proxy):** a teaching-assistant/co-teacher intervention
  (14 lessons/week, 6th grade) **closes half the achievement gap** between low- and
  high-educated-parent students. This is the closest causal, DK-specific evidence that
  *targeted* personnel spending (not blanket per-pupil funding) moves learning outcomes — contrasts
  with the null blanket-funding result from working_paper_gymnasier.pdf above.

## 4. Chetty_ INTERGENERATIONAL MOBILITY.pdf

**Edge:** income → learning_outcomes (loop edge) — **DK-DIRECT NUMBER**

Chetty et al. (2014). Descriptive/administrative-tax-data design (not causal — a "portrait" of
mobility, not mechanism identification). Danish sample: 1980-81 birth cohorts.

- **Rank-rank slope, Denmark: 0.180** (vs. US 0.341 — DK is nearly half the US persistence).
- Bottom-quintile→top-quintile mobility ("American Dream" probability): DK 11.7% vs US 7.5%.
- **Lag (DK-specific):** parent income = mean 1997-1999 (child age ~16-19) → child income = mean
  2009-2011 (child age ~28-31). Effective lag ≈ 12-15 years parent-measurement-midpoint to
  child-income-measurement-midpoint.
- Education/test-score intermediate mechanism (10pp parent-income percentile → 6.7pp college
  attendance; test-score gradient) is **US-only in this paper** — the DK numbers are the
  headline rank-rank slope only, not broken into an education-specific sub-effect.
- **Usable as:** anchor for `income → learning_outcomes` rank-rank persistence (DK 0.180), though
  it is a whole-of-life-course mobility slope, not isolated to the learning_outcomes node
  specifically — treat as an upper-bound anchor for the loop edge, note the education-specific
  breakout is a US proxy layered on top of the DK headline number.

## 5. Gregg wage scar + Wage Scar from Youth Unemployment (same study, 2 versions)

**Edge:** neet → income (as youth-unemployment proxy)

Gregg & Tominey (2004 WP / 2005 published). UK, National Child Development Survey, 1958 birth
cohort followed to ages 23/33/42. IV design: local age-16 unemployment rate instruments for
individual youth unemployment (removes unobserved-ability bias).

- **13-21% wage penalty at age 42** per year of youth unemployment (9-11% if repeat unemployment
  avoided). Dependent variable: log wage.
- Youth unemployment = cumulative months unemployed ages 16-23.
- **Persistence:** measured up to 26 years later (age 42). Substantial recovery in first 10 years
  if no repeat spell, but only *partial* recovery by 20 years — "near permanent wage scar."
  Confirms `neet → income` should carry a LONG lag (matches the current draft's lag_years=10,
  arguably supports even longer).
- **Caveat:** studies unemployment specifically, NOT the broader NEET (education+employment+
  training) definition used in the DK cascade — a scope proxy, not an exact match, but the
  closest well-identified anchor found.

## 6. long term scarring.pdf (Andersson, Brännström & Mörtvik 2018 — Sweden)

**Edge:** neet → income — **STRONGEST ANCHOR (twin-pair design)**

Sweden, register data, twin-pair method (isolates family/genetic confounds via intra-twin
comparison) + OLS cross-check. Cohorts: young 20-25, old 46-52, measured 2001; 3,783 young +
4,262 old twin pairs.

- **1 year NEET → 33% lower income** (measured 2011, ~8-10y later) vs. twin sibling.
- **2 years NEET → 40% lower income** (point estimate −0.512, log scale).
- **3 years NEET → 62% lower income** (point estimate −0.980, log scale).
- Dose-response relationship: longer NEET spell → steeper income penalty. Note the log-scale
  point estimates (−0.512, −0.980) are NOT the same as the reported percentages via naive
  conversion — must use `%Δ = (e^b − 1) × 100` when harmonizing (e.g., −0.980 → 1−e^−0.98 ≈ 62.5%,
  consistent with the reported 62%).
- **Lag:** NEET measured 2001-2003, outcome measured 2011 → ~8-10 year lag.
- Does NOT report poverty/welfare-dependency coefficients directly (income only) — notes the
  companion Norway source (#7 below) covers permanent disability benefit reliance instead.
- **This is the single cleanest identification found for any edge in the corpus** — twin-pair
  design controls family confounds better than any other source surveyed.

## 7. A life course perspective on the NEET phenomenon.pdf (Heglum & Nilsen 2024 — Norway)

**Edge:** neet → poverty_rate — descriptive, full-population registry

Norway, full-population administrative registry, 125,804 young adults born 1971-1986 with ≥1
year NEET at ages 22-25, followed 1993-2017 (10-year horizon, age 22→31). Sequence analysis +
multinomial logistic regression — **descriptive, not causal.**

- **~35% of NEET individuals follow "long-term failure" trajectories.**
- Long-term exclusion cluster probability: rose from **19% (1971 cohort) → 33% (1986 cohort).**
- Permanent disability-pension trajectory probability: rose from **7.8% → 11.4%** across cohorts.
- Gender gap in exclusion: 24% (women) vs 14% (men) in 1971 cohort, converged to ~0 in youngest
  cohorts.
- Parental education gradient: low-educated-parent children consistently more exposed across all
  cohorts (stable social disparity, unlike the closing gender gap).
- **No life-satisfaction/wellbeing data** — registry-only (income, education, benefits). Confirms
  this corpus has no direct NEET→life_satisfaction quantification; that edge stays proxy/literature
  (Clark et al. 2018, already in the draft) unless another source surfaces it.
- **Lag:** 10-year window (ages 22→31) is shorter than the current draft's `neet→poverty_rate`
  lag_years=5 — actually supports keeping a shorter lag than neet→income's much longer scarring
  horizon, since poverty risk shows up faster than the full wage-scar effect.

## 8. Educational and income inequalities across diseases in [Denmark].pdf (Pallesen et al. 2024)

**Edge:** income → hale (PROXY ONLY — see caveat) — DK-direct, huge sample

Denmark, 4,541,309 residents aged 30+, register-based Poisson regression, 751 diagnostic codes,
followed 2013-2022 (10y). Descriptive incidence gradient — NOT causal (authors explicitly flag
reverse-causality risk, esp. mental health).

- Largest income gradients (Q1 vs Q4, low vs high income): **schizophrenia IRR 18.4 (men), 10.1
  (women)**; anxiety disorders IRR 5.28 (men).
- Education gradient (low vs high): schizophrenia IRR 4.4 (men), COPD IRR 2.7 (women).
- Common conditions (other digestive diseases): IRR only 1.3-1.5 — most disease categories have
  much smaller gradients than the mental-health extremes.
- **Reversed gradient** for melanoma/skin cancer (IRR 0.5 — high income = higher incidence,
  likely detection/screening-access artifact) and similarly for breast/prostate cancer.
- **Lag:** income measured as 3-year pre-inclusion mean; baseline-to-incident-diagnosis design,
  not a fixed multi-year causal lag.
- **CONFIRMED PROXY-ONLY, per session's existing flag:** this is concurrent disease *incidence*,
  not healthy-life-expectancy (HALE) or life-expectancy. Do not convert an IRR directly into the
  `income→hale` edge strength as if it were a HALE effect size — use only as directional
  supporting evidence (income gradient exists and is disease-specific, driven heavily by mental
  health) alongside the literature `hale` estimate (Marmot), not as a replacement.

## 9. Effects of education on adult mortality.pdf (Balaj et al. 2024, Lancet Public Health)

**Edge:** income → life_expectancy / hale — **CAVEAT: NOT CORPUS-GROUNDED, VERIFY BEFORE USE**

⚠️ NotebookLM explicitly disclosed that this source's actual PDF excerpt was NOT in its
retrievable context for this query, and that the numbers below came from its own general
knowledge / web search, not a grounded read of the uploaded document. Treat as **unverified
until independently checked** (e.g. ask again with the PDF explicitly re-referenced, or look the
paper up directly) — do not write this into `relationships.json` without a second confirming
pass. Recorded here as a candidate pending verification, not as the harmonization stage input.

- Per NotebookLM (external-knowledge answer, not confirmed source-grounded): 1 year education →
  1.9% mortality risk reduction (RR 0.981, 95% CI 0.980-0.982). Primary school (6y) → 18.3%
  reduction (RR 0.817). Secondary (12y) → 34.3% (RR 0.657). Tertiary (18y) → 42.9% (RR 0.571).
  Meta-analysis of 603 studies, 70 countries.
- **Action needed before Step B:** re-query specifically asking NotebookLM to quote text
  verbatim from the PDF itself, or accept this only as a directional sanity-check number, not a
  harmonization input.

## 10. OECD Education at a Glance 2024.pdf

**Edges:** learning_outcomes → unemployment (DK-direct), learning_outcomes → income

Descriptive cross-sectional OECD statistics, not causal. Reference years: attainment/employment
2023, earnings 2022, financial returns 2021.

- **Employment rate by attainment, Denmark, 25-64y, 2023:** below upper-secondary 62%; upper
  secondary 82%; tertiary total 89% (bachelor's 87%, master's 91%, doctoral 95%). **27pp gap**
  between lowest and highest attainment — directly usable, DK-specific, for
  `learning_outcomes → unemployment`.
- **Unemployment rate by attainment, OECD average, 2023:** below-secondary 9.0% (13.2% ages
  25-34); upper-secondary 5.1% (7.0% younger); tertiary 3.4% (4.7% younger). OECD-average only,
  not DK-specific for this metric.
- **IRR tertiary vs upper-secondary, OECD average:** 15% (men), 18% (women).
- **Denmark financial return (NPV, 2% discount):** women USD 224,900, men USD 204,400 — Denmark
  is one of few OECD countries where women's returns exceed men's.

## 11. Goldin_Katz_THE RACE BETWEEN EDUCATION AND TECHNOLOGY.pdf

**Edge:** learning_outcomes → gini — structural elasticity, US-only

Goldin & Katz (2007/2008). Supply-Demand-Institutions (SDI) framework, CES production function +
OLS decomposition. US, 1890-2005 (1915 Iowa census as early baseline), civilian workforce 18-65.

- **Elasticity of substitution (skilled/unskilled) σ = 1.64 → relative wage elasticity −0.61.**
  A 1% (log point) increase in relative supply of college-educated workers → −0.61 log-point
  decrease in the college wage premium. **This is the cleanest convertible elasticity found for
  learning_outcomes→gini** — directly usable in the elasticity-first harmonization step.
  Direction: MORE education supply → LESS wage inequality (consistent with current draft's
  negative direction on this edge).
  60% of the 1973-2005 rise in overall wage-inequality variance is attributed to education-wage
  differential expansion.
- Historical calibration check: 1980-on slowdown in native educational growth → 34.9 log-point
  drop in relative college-equivalent supply → 21.3 log-point rise in college wage premium
  (roughly consistent with the −0.61 elasticity: 34.9 × 0.61 ≈ 21.3, math checks out).
- **US-only, proxy for DK** — no DK-specific elasticity in this source.

## 12. Review education policies OECD (Social & health outcomes) + OECD Life at a Glance

**Edges:** income → life_satisfaction, neet → life_satisfaction, gini → life_satisfaction (partial)

OECD, correlational/descriptive (Gallup World Poll 11-rung ladder + OECD Trust Survey), 38 OECD
+ some partner countries, life-satisfaction/trust data 2021-2022 (comparisons to 2018-19,
2011-12), education/employment reference 2023.

- **Education → life satisfaction (0-10 ladder):** tertiary 6.2 vs below-upper-secondary 5.2 =
  **1.0 point gap.**
- **Income → life satisfaction:** richest 20% = 6.4 vs poorest 20% = 5.8 = **0.6 point gap.**
  Directly usable for `income → life_satisfaction`.
- **Employment/NEET proxy → life satisfaction:** full-time employed 6.5 vs "others" (incl. not in
  labor force) 6.1 = **0.4 point gap.** Directly usable proxy for `neet → life_satisfaction`
  (smallest of the three gaps — employment status matters less than education or income tier
  for this measure, per this source).
- **Trust/inequality-adjacent:** only 41% average trust in national government; trust is 43pp
  higher for those who feel political voice; low education/income → less trust (directional,
  no point estimate). **Denmark specifically: corruption perception under 20%, among lowest in
  OECD** — supports treating DK as a high-trust-baseline outlier, relevant context for the
  `gini → life_satisfaction` edge (currently "contested"/low-confidence in the draft).
- All correlational/descriptive — no causal design. Useful as an anchor for the point-scale
  conversion in harmonization, not as strong causal evidence.

## 13. School funding and pupil outcomes_Literature review.pdf (UK DfE 2017)

**Edge:** funding → learning_outcomes — richest single source, gives a RANGE not a point estimate

UK Department for Education literature review + own regression analysis, panel data 2010-2015.

- **KS2 (primary), £1,000/pupil/year increase:** Gibbons et al. 2011 (natural experiment, local-
  authority-boundary discontinuity, "most robust") → **+0.25 SD**. Holmlund et al. 2010 → only
  +0.051 SD (math), +0.040 SD (English). **Wide disagreement across designs — 5x range.**
- **DfE's own fixed-effects analysis (KS2):** 1% funding change → 0.062-0.071pp change in share
  reaching level 4+. Effects appear within 2 years (1-2 year lags tested).
- **KS4 (secondary/GCSE):** literature range 3% SD (lower-attaining) to 9% SD (highest-attaining)
  per £1,000. **DfE's own analysis found NO statistically significant KS4 effect** — echoes the
  DK gymnasium null result (source #2 above) at the secondary level specifically.
- **Lag:** short-term only (1-2 years) — DfE explicitly caveats their 5-year panel can only
  capture short-term effects, not longer-run learning accumulation.
- **Harmonization implication:** this source alone argues for keeping `strength` on
  funding→learning_outcomes in the LOW-to-MODERATE band (not high), given (a) the range spans
  0.04-0.25 SD depending on identification quality, (b) secondary-level effects are null in two
  independent countries (UK DfE, DK gymnasium), (c) primary-level effects are real but modest and
  short-lag.

## 14. Education and Income Inequality Reconsidered.pdf (Kim 2014)

**Edge:** learning_outcomes → gini — panel fixed-effects, 100 countries, but weak for developed nations

100 countries (21 developed, 79 developing), quinquennial panel 1960-2000. Pooled-OLS + panel
fixed-effects, inverted-U relationship between education Gini and income Gini.

- **Fixed-effects (preferred model): 1-unit ↑ education Gini → 0.170-unit ↑ income Gini** (before
  quadratic dampening term −0.002). Pooled-OLS gives a much larger 0.522 (fixed-effects is more
  credible — controls unobserved country characteristics).
- Inverted-U: relationship peaks at education-Gini≈41-42.5 (≈5-6 years average schooling,
  primary-completion level), i.e. **effect flips/weakens once a country has broadly completed
  primary education** — Denmark is far past this inflection point.
- **Explicit finding: education inequality has a MORE VISIBLE impact on income inequality in
  DEVELOPING countries than developed ones.** This is an important caveat for calibrating the
  DK edge: this source's headline number is likely an OVER-estimate for a fully-industrialized,
  already-low-education-inequality country like Denmark. Should pull `strength` toward the LOW
  end of whatever band is chosen for `learning_outcomes → gini`, not the high end.

## 15. 09-2016-does-money-matter.pdf (Hyman 2016)

**Edge:** funding → learning_outcomes — second US IV estimate, corroborates + narrows source #1

Michigan, IV design (1994 Michigan school-finance-reform "Proposal A" instrument), 518 public
noncharter districts, 1995-2010. Primary-school spending (grades 4-7) → later-life outcomes.

- **10% more spending → +3pp (7%) college enrollment, +2.3pp (11%) postsecondary degree
  completion, +3-5pp high-school graduation.**
- Explicitly smaller than Jackson et al. 2016 (source #1). Mechanism differs: Michigan money went
  to smaller class sizes, "little to no change in teacher salaries" — vs. Jackson et al. where
  spending raised teacher salaries too. Suggests the *channel* funding takes (class size vs. pay)
  matters for effect size, not just the dollar amount.
- Confirms funding→learning_outcomes real but modest effect in a second well-identified US
  natural experiment; narrows the plausible range down from Jackson et al.'s more optimistic
  numbers rather than contradicting it.

## 16. educational assortative mating and income inequality.pdf (Breen & Andersen 2012)

**Edge:** learning_outcomes → gini — **DK-DIRECT, whole-population register data**

Denmark, whole-population register data, household heads aged 30-65, 1987 vs 2006. Counterfactual
decomposition (Theil index) using Deming-Stephan iterative proportional fitting to separate
"availability" (education distribution shifts) from "sorting" (partner-choice propensity).

- **Assortative mating counterfactually explains ~40% of Denmark's 1987→2006 inequality
  increase** (i.e., if educational sorting patterns had stayed fixed, 2006 inequality would have
  been 40% lower than observed).
- Driven almost entirely by shifts in the **availability/distribution of education** (would alone
  have generated +16% inequality), NOT by changing partner-choice preferences — sorting behavior
  itself actually *dampened* the rise (16%→~10% net).
- Homogamous-household share fell from 31.16% → 23.52% over the period.
- **This is a genuinely DK-direct, high-quality estimate for how education-distribution changes
  propagate into household-level income inequality** — a different mechanism than the individual
  wage-compression channel (Goldin & Katz), but a real and large DK-specific number. Supports
  keeping `learning_outcomes → gini` in the MODERATE-to-HIGH band for the DK context
  specifically, contrasting with source #14's caution that the cross-country panel effect is
  weak for developed nations — this DK-direct mechanism suggests the household/family-formation
  channel is actually still substantial in Denmark, separate from the individual-wage channel.

## 17. Education and Crime over the Life Cycle - Gallipoli (Fella & Gallipoli).pdf

**Edge:** none of the 13 — off-cascade, reviewed and excluded

Structural model (high-school-completion subsidy policy simulation), Mexico/Colombia/US. Focuses
on crime participation, incarceration, adult earnings, aggregate consumption — confirmed via
direct query that it does **not** report an education→unemployment coefficient. No edge in this
cascade uses crime as a node. Reviewed for completeness per the one-query-per-source plan; no
harmonization action needed.

## 18. UNESCO study reveals correlation between poverty and education.pdf

**Edge:** none directly usable — global developing-country context, not DK-relevant

UNAA 2017 press-style summary, global 2015 data, correlational. "2 more years schooling → 60M
people out of poverty" globally. Population is overwhelmingly Sub-Saharan Africa/South Asia
out-of-school children — a fundamentally different regime (access/enrollment) than Denmark's
context (near-universal enrollment; the DK question is quality/funding, not access). Not usable
as a quantitative anchor for any DK cascade edge; recorded for completeness only.

