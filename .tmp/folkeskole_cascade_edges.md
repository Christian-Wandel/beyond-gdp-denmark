# Folkeskole Cascade — Edge Table (DRAFT for review)

**Purpose.** This is the cited evidence base for the education cascade card in the WELA
apparatus. It mirrors WELA's own flagship argument: underfunding the folkeskole produces
consequences that GDP is blind to but that cascade through learning, labour-market
attachment, income, health, wellbeing, and inequality.

**This is Track 1 — the gate.** Nothing lands in `data/relationships.json` until you've
read this and resolved the `NEEDS` rows. Treat every `⚠ NEEDS` as a side-task for you:
either confirm the number from memory/expertise, or hand me the paper (ideally into a
NotebookLM notebook so I can extract the grounded figure without hallucination risk).

**How to read the table.**
- `direction`: `positive` = the two move the same way after sign-harmonisation per the
  `relationships.json` convention (see its `_examples`); `negative` = they move oppositely.
  I've added a plain-language **"effect"** column so the sign convention never bites us —
  trust the plain-language one, I'll encode the JSON sign correctly from it.
- `strength`: qualitative 0–1 ordering only (NOT a calibrated coefficient). 0.2 weak,
  0.5 moderate, 0.8 strong. This is the field most likely to draw a "where's that from?"
  from Ploug/Falkenfleth — so it's deliberately labelled qualitative everywhere.
- `lag_years`: rough years to materially register.
- `confidence`: my confidence in the *existence and direction* of the edge, given established
  literature — `high` = textbook causal consensus, `med` = well-evidenced but contested
  magnitude, `low` = plausible/mechanism-clear but thin direct evidence.
- `⚠ NEEDS`: I'm leaning on recall for the *number* and want it hardened before Friday.

---

## The lever

`folkeskole_funding` is **not yet a node** in `relationships.json` (the 26 nodes are all
measured indicators). For the cascade we introduce it as a **policy-lever node** — the thing
WELA's report is actually about — that feeds the measured nodes. Flagging this as decision
**D1** below.

---

## Core cascade edges (the spine — folkeskole → outcomes)

| # | from | to | effect (plain language) | dir | strength | lag (yrs) | conf | source | flag |
|---|------|-----|------------------------|-----|----------|-----------|------|--------|------|
| 1 | folkeskole_funding | learning_outcomes | More per-pupil funding → higher learning outcomes (test scores) | + | 0.4 | 3 | med | Hanushek & Woessmann, *The Knowledge Capital of Nations* (2015); meta-evidence on funding→achievement is mixed on magnitude but positive when targeted | ⚠ NEEDS exact effect size; funding→achievement magnitude is genuinely contested |
| 2 | folkeskole_funding | neet | Underfunding → weaker support/retention → more youth not in education/employment/training | − | 0.35 | 5 | med | OECD *Education at a Glance 2023*, NEET chapter; mechanism via early-leaving | ⚠ NEEDS DK-specific link if available |
| 3 | learning_outcomes | income | Higher cognitive skills/attainment → higher lifetime earnings (human capital) | + | 0.6 | 8 | high | Mincer earnings function; OECD EaG returns-to-education; ~8–10% wage premium per school year | ⚠ NEEDS confirm the per-year premium figure (Mincer / OECD) |
| 4 | learning_outcomes | unemployment | Higher skills → lower unemployment risk | − | 0.4 | 5 | high | OECD EaG (employment rates by attainment); ILO | — |
| 5 | neet | income | Youth detachment → scarring → persistently lower lifetime income | − | 0.5 | 10 | high | Gregg & Tominey (2005) youth unemployment wage-scarring; Eurofound NEET cost studies | ⚠ NEEDS the scarring magnitude (Gregg/Tominey or Eurofound) |
| 6 | neet | life_satisfaction | Detachment → lower subjective wellbeing | − | 0.35 | 2 | med | Clark et al., *The Origins of Happiness* (2018); unemployment→life-satisfaction is one of the most robust findings in wellbeing economics | ⚠ NEEDS effect size |

## Second-order edges (income/skills → broader wellbeing & equity)

| # | from | to | effect (plain language) | dir | strength | lag (yrs) | conf | source | flag |
|---|------|-----|------------------------|-----|----------|-----------|------|--------|------|
| 7 | income | life_satisfaction | Higher income → higher life satisfaction (diminishing returns) | + | 0.3 | 1 | high | Kahneman & Deaton (2010); Killingsworth (2021); concave, not linear | — |
| 8 | income | hale | Higher income → better health / healthy life expectancy (social gradient) | + | 0.4 | 10 | high | Marmot, *The Health Gap* (2015); WHO social determinants | ⚠ NEEDS DK/Nordic gradient figure if you want it country-specific |
| 9 | income | life_expectancy | Same social gradient, on total life expectancy | + | 0.4 | 10 | high | Marmot; Chetty et al. (2016) income–longevity gradient | — |
| 10 | learning_outcomes | gini | Broad-based education attainment → compresses the wage distribution → lower inequality | − | 0.3 | 15 | med | Goldin & Katz, *The Race between Education and Technology* (2008) | ⚠ NEEDS — this is the most contested edge (education↔inequality direction debated); flag low-ish |
| 11 | neet | poverty_rate | Youth detachment → higher poverty risk | + | 0.4 | 5 | med | Eurofound *NEETs* (2012, 2016) | ⚠ NEEDS DK figure |
| 12 | gini | life_satisfaction | Higher inequality → lower average life satisfaction (society-level) | − | 0.25 | 3 | low | Wilkinson & Pickett, *The Spirit Level* (2009) — influential but contested; keep confidence low | ⚠ NEEDS — contested; decide whether to include (D2) |

## Reinforcing / loop edges (optional — shows it's a system, not a chain)

| # | from | to | effect (plain language) | dir | strength | lag (yrs) | conf | source | flag |
|---|------|-----|------------------------|-----|----------|-----------|------|--------|------|
| 13 | income | learning_outcomes | Higher household income → better child learning outcomes (next generation) → feedback loop | + | 0.35 | 15 | med | Intergenerational mobility; Chetty et al. (2014); the loop that makes underfunding compounding | ⚠ NEEDS — include only if we want the reinforcing loop (D3) |

---

## Decisions I need from you (blocking the JSON populate)

- **D1 — the lever node.** Add `folkeskole_funding` as an explicit policy-lever node (distinct
  styling from measured indicators), OR start the cascade at `learning_outcomes` and treat
  "underfunding" as narrative text only? **My rec: add the lever node** — it's WELA's actual
  subject and makes the "what would we do" legible. Without it the graph starts mid-story.
- **D2 — edge 12 (inequality→life satisfaction).** Contested (*Spirit Level*). Include at low
  confidence with a visible caveat, or cut? **My rec: include, low confidence, dashed** — it's
  exactly the kind of edge WELA will want to argue about, which is the point.
- **D3 — edge 13 (the reinforcing loop).** Include the intergenerational feedback loop, or keep
  the graph a clean DAG for v1? **My rec: include** — "underfunding compounds across generations"
  is a strong WELA-aligned message and visually shows this is a *system*.
- **D4 — country-specificity.** Several edges have Danish/Nordic-specific figures available
  (social gradient, NEET cost). Do you want me to push for DK-specific numbers (more credible to
  this audience, more research load), or ship with general OECD/literature figures labelled as
  such for v1? **My rec: general for v1, DK-specific as the post-meeting hardening pass** — the
  *gaps panel* already says "we'd want DK-calibrated edges," which turns this limitation into part
  of the testing story.

## The 8 ⚠ NEEDS rows — your side-task summary

If you can hand me papers (or drop them in NotebookLM) for these, the card goes from
"plausible" to "cited" for Friday. Priority order:

1. **#3** education→income per-year wage premium (Mincer/OECD) — *highest value, most likely to be challenged*
2. **#5** NEET→income scarring magnitude (Gregg & Tominey / Eurofound)
3. **#1** funding→learning-outcomes effect size (Hanushek/Woessmann) — *contested, worth nailing*
4. **#10** education→inequality (Goldin & Katz) — *most contested direction*
5. **#6** unemployment/NEET→life-satisfaction effect (Clark et al.)
6. **#8** income→health gradient, DK if possible (Marmot/Chetty)
7. **#2, #11** DK-specific NEET links (OECD EaG / Eurofound)

Everything else (#4, #7, #9) I'm confident enough to ship without a hardening pass.
