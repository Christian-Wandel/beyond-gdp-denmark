# From index to kroner: how the simulator's real-unit statements are made

*Beyond GDP Denmark, 2026-07-02. One page for WELA.*

## The problem

The what-if simulator answers "if folkeskole funding rises 10%, what moves?" with an
honest but mute number: "Income up 0.02 (illustrative index)." Technically defensible,
useless for advocacy. A politician needs: *how many kroner, for how many Danes, by when?*

The obvious fix, calibrating the index into real units, was deliberately rejected: the
causal graph's strengths are a qualitative ordering, not measured elasticities, and
dressing them up as kroner would be false precision. So the dashboard now does something
different.

## The method

The funding lever itself IS in real units (kr per pupil). Several links in the cascade
carry published dose-response estimates. So the real-unit statements are computed
directly from those studies' own numbers, scaled by the funding change in percent, and
shown *beside* the simulator, clearly labelled as illustration from cited studies, not
model output. The unitless engine is untouched.

```
funding change in %  ->  cited study's dose-response  ->  kr / people / points
```

All amounts are in kroner: foreign studies contribute percentage effects only, applied
to Danish baselines (avg disposable income 287,682 kr, DST INDKP101 2024; 514,299 public
grundskole pupils, roughly 51,000 per year-group, DST 2024).

## The three statements (at +10% funding per pupil)

The dashboard wording is deliberately voter-plain (readable without an economics
background); the source sits beneath each statement as a footnote. As shown on screen:

**Income.** "More money for schools now means better-paid adults later. Each child would
earn around **20,100 kr more per year** — but the payoff first shows in 15 to 30 years,
when today's pupils are grown."
*Footnote: Based on American school-funding reforms (Jackson, Johnson & Persico 2016,
Quarterly Journal of Economics: +10% spending sustained through schooling -> ~7% higher
adult earnings, 9.6% for low-income pupils). No Danish folkeskole study exists.*

**Unemployment.** "Out of one year's 51,000 school children, about **300-500 more of
them will have a job** when they grow up."
*Footnote: US school-funding studies (Hyman 2016: +3-5pp upper-secondary completion)
combined with OECD's employment figures for Denmark (Education at a Glance 2024: 20pp
employment gap, 62% vs 82%). Chaining two studies compounds uncertainty - shown as a range.*

**Life satisfaction.** "People with a job are happier. Big OECD surveys ask people to
rate their life from 0 to 10 — those in work say **6.5**, those out of work say **6.1**.
So the 300-500 extra people in work get a real lift, and the whole year-group gets a
small lift from the extra pay."
*Footnote: OECD Gallup surveys across many countries, not Danish-specific. Underlying
figures: ~+0.4 points per person moved into employment; ~+0.04 points cohort-wide via
the income channel.*

## What is assumed (and shown in the dashboard's method note)

| Assumption | Why it matters |
|---|---|
| Linear scaling, only within ±10-20% | The studies cover roughly 10-25% spending variation; the dashboard refuses to translate beyond ±20% |
| Symmetric for cuts | The reform literature is mostly about increases; cuts assumed mirror-image |
| Individual estimates scaled to a cohort | Ignores general-equilibrium effects (if everyone earns more, relative returns shift) |
| External validity | Income anchor is US; NEET scarring is Swedish; only the employment gap is Danish |
| 15-30 year lags | The evidence does not support claims on a 5-year horizon; childhood spending pays out in adulthood |
| Life satisfaction in adult Cantril-ladder units | The dashboard's own series for that node is a pupil-wellbeing proxy (1-5 scale); the statement uses the literature's adult 0-10 scale |

## What a Danish-grade version needs (the ask)

1. **A Danish folkeskole spending elasticity.** None exists. The closest Danish causal
   study (Kaarsen & Rizvanovic, gymnasium-level IV) found no effect, at a different
   school level. Danish register data could support a proper study; VIVE, ROCKWOOL
   Fonden and De Økonomiske Råd work has not yet been searched, and folkeskolereform
   evaluations are unexplored. This is the single highest-value gap.
2. **An adult Danish life-satisfaction time series.** The cascade node currently uses
   pupil wellbeing as a proxy; Eurostat/OECD Cantril data for Denmark exists and could
   be fetched.
3. **A direct spending-to-employment estimate.** The current unemployment statement
   chains two studies, which compounds uncertainty; one direct estimate would replace it.
