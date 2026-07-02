# Folkeskole Cascade Simulator — Roadmap & Vision

**Audience:** Tænketanken WELA (discussion, Fri 2026-07-03) · **Drafted:** 2026-07-01
**Purpose of this doc:** direction and vision — what the simulator is for, what we build
first, where it goes next, and the honest gates we won't cross prematurely.

---

## The idea in one paragraph

The folkeskole cascade shows how underfunding one policy lever ripples through the
economy — not just to wages, but to health, inequality, youth detachment, and wellbeing.
The simulator turns that static picture into something you can **push on**: change the
funding level and watch the cascade respond. The point is never to forecast a number.
The point is to make visible how an economy moves **other than through money** — the
*alongside-GDP* argument, made tangible. GDP would see almost nothing the year funding
changes; the simulator shows what was actually set in motion.

---

## What it is for (three uses, in priority order)

1. **See what GDP misses (primary).** Push the lever; the money nodes move a little, but
   life satisfaction, health, inequality, and trust move too — and none of those show up
   in a GDP figure. It's the alongside-GDP thesis you can *feel*. Doubles as reference
   material for the expected consequence set (positive and negative) of a funding change.
2. **Guide early-stage policy narratives (secondary).** A ranked, directional read:
   "which channel dominates?" Data-backed scaffolding for building an argument before the
   detailed modelling exists — "underfunding hits youth detachment harder than it hits
   average grades, and the inequality effect is real but slow."
3. **Make the structure legible (byproduct).** Just seeing the whole web light up teaches
   that education is a health and inequality lever, not only a wage lever.

**What it is deliberately NOT:** a forecast engine. Every arrow is a *cited* causal claim,
not a calibrated coefficient. The tool cites; it does not predict. This restraint is the
credibility — the moment it prints a fake "+3,200 kr," an economist dismantles it.

---

## Phase 1 — MVP (building now)

A what-if slider on the education cascade card. Detailed build plan in
[`simulator_plan.md`](simulator_plan.md). In brief:

- **Real-kr lever** (actual DST per-pupil funding series), with a historical envelope and
  onboarding presets: **-100% / -20% / -10% / Today / +10% / +20% / +100%** — realistic,
  policy-sized, symmetric core (±10/20%) so underfunding cuts are as visible as increases,
  plus ±100% illustrative bookends added the same session to make the impact viscerally
  clear at the clamp boundary.
- **Unitless relative-delta engine** — effects propagate through each edge's qualitative
  strength and direction, decaying with distance, in deterministic topological order.
  Honest by construction: nothing masquerades as a real forecast number. Lives in
  `js/cascade-engine.js`, covered by invariant tests in `tests/test_cascade_engine.js`.
- **Partial real-units as provenance** — the strong, well-cited edges surface their
  *literature* figure (e.g. "~8–10% wage premium per school year, OECD EaG 2024") as a
  static citation, not a simulated output. Weak/contested edges show their weakness.
- **Static end-state** with time-to-effect labels ("+2y", "+15y") so the *slowness* of the
  harm is visible without animating it.
- **Node encoding** — nodes shift size around a neutral baseline by SIGNED delta (grow for
  increases, shrink for decreases, sqrt-curved) plus a signed colour ramp, for the visceral
  hit; a **ranked results panel** for the citable ordering.
- **Footer caveat**; behind-closed-doors MVP for an informed audience.

**Why this scope:** it's a complete, coherent tool that fully serves uses 1 and 2, and it's
deliberately small so WELA's feedback lands on Phase 2 rather than on a half-built Phase 1.

---

## Phase 2 — the "time and motion" release (vision, NOT yet built)

A single coherent theme: **make the cascade move over time.** Four features that belong
together because they all show *change*:

1. **Lag-aware timeline.** Instead of one static end-state, ripple the effect year by year
   using each edge's `lag_years`. Push funding in year 0; learning moves at year 2,
   unemployment ~7, income ~10, inequality ~17+. You *watch* the non-money economy move in
   slow motion, long after the budget line is forgotten. This is the most visceral version
   of the alongside-GDP argument.
2. **Before/after overlay.** Toggle baseline vs. simulated to see exactly what changed.
3. **Animated edge pulses.** Pulses travelling lever → node → node, reinforcing that it
   *cascades*.
4. **Real-series sparklines (monitoring on-ramp).** Show each node's *actual* measured DK
   trend beside its simulated delta — grounding the picture in real data, and the first
   step toward monitoring.

### Why we're not building Phase 2 yet — the honest gates

The lag-aware animation is the most impressive and most *useful* version. It's also the
most *dismantlable*: smooth motion reads as confidence, and we don't yet have the
calibration to justify that confidence. We build it once these are resolved, not before:

1. **Lag-composition is undefined.** Along a multi-hop path, does the effect fire at
   lag₁ + lag₂ (cumulative), or at each edge's own lag from its own trigger? This changes
   every timeline and has no obvious right answer yet.
2. **In-window behaviour is undefined.** What is a node's value *between* its cause firing
   and its lag elapsing — zero then a step? a linear ramp? A modelling choice we haven't
   made.
3. **The reinforcing loop** (`income → learning_outcomes`, 15-year lag) can compound or
   oscillate over time. A time engine needs an explicit iteration count and damping rule,
   or it will invent dynamics the literature never claimed.
4. **Calibration honesty.** Animation visually *implies* magnitudes-over-time that the
   qualitative strengths can't support. Phase 2 needs either explicit "the shape is
   illustrative" framing, or real per-edge dynamics we don't yet have.

**Discussion for WELA:** do we want the genuine time-ripple (Phase 2 as above, with the
gates resolved), or is the static-end-state MVP with time labels already enough for the
argument you want to make? That answer shapes how much we invest here.

---

## Phase 3 — monitoring & validation (further out, likely its own design session)

The most *economist-credible* extension, and the opposite of a forecast: **predicted vs.
actual.** Overlay what the cascade *expected* against what the measured DK data actually
did. "We under-funded in period X — did the grades / NEET / income cascade we predicted
actually show up?" This is testable and falsifiable, which is its strength. It's a research
instrument, a bigger build than the slider, and probably deserves its own dedicated design
pass before we commit.

---

## Phase 4 — data transparency layer (identified 2026-07-01, not yet scoped)

Using the MVP surfaced the question any economist will ask first: **what exactly is
this variable, where does it come from, and can I check it myself?** Right now that
information exists (every edge carries a `source`, every node's real series has a
fetcher and a DST/uddannelsesstatistik.dk table ID) but it's scattered across
`relationships.json` notes, `indicator_meta.json`, and code comments — not surfaced to
the user in one place.

**What this phase should cover, per variable/node:**
- Exact definition (what is actually being measured — e.g. "9th-grade bundne-prøver
  grade average, 7-trins-skala," not just "learning outcomes").
- Source: table ID, API, and a **direct hyperlink** the user can click to verify against
  the origin (DST StatBank table page, or the uddannelsesstatistik.dk query/topic).
- **CSV export** of the underlying series, so an economist can pull the numbers into
  their own analysis rather than trusting the dashboard's rendering of them.

This deserves its own **shareable documentation artifact** (a data dictionary / provenance
page), separate from this roadmap, since its audience is "anyone auditing a number" rather
than "WELA deciding what to build next." Not scoped in detail yet — flagging it here so
it isn't lost, and because it's a strong complement to the Phase 1 footer caveat: today
the caveat says "don't take this as a forecast," but it doesn't yet make it *easy* to go
check the real data behind any given node. Closing that gap is likely as valuable to
economist credibility as the simulator itself.

---

## Phase 5 — translating outcomes into human-legible statements (identified 2026-07-01,
## SCOPED AND BUILT 2026-07-02 — see "What was built" below)

> **What was built (2026-07-02):** a display-only real-unit layer for three nodes the
> owner prioritized (income, unemployment, life satisfaction), shipped for the WELA
> meeting. Approach: statements are computed from the cited literature's own
> dose-response figures, scaled by the **lever percent** (which is in real kr/pupil),
> never from the engine's unitless index — so the Q3 decision stands untouched.
> Gated to |lever| ≤ 20% (the studies cover ~10-25% spending variation; the ±100%
> bookends show a refusal message instead). Linear-within-gate and symmetric-for-cuts
> are stated as assumptions in the UI's method note. All money in DKK: foreign studies
> contribute percentage effects only, applied to Danish baselines.
> Pieces: `data/unit_translations.json` (config), `js/cascade-translate.js` (pure module,
> tested via `tests/test_translate.js`), "In real terms" block in the results panel,
> and `docs/wela_unit_translation_note.md` (1-page methodology + data-gap ask for WELA).
> The original scoping caveat below is retained because it explains WHY the layer is
> built this way.

Using the MVP surfaced a second gap, distinct from Phase 4: the results panel shows
"Income ▲0.02" — technically correct, but meaningless to a reader. The ask: turn that
into something like *"1,000 more Danes would earn 500kr more per month."* This is a real
and valuable idea, but it is **not a units-conversion task** — it sits right on top of
the Q3 decision the grill already made, and needs to be scoped carefully so it doesn't
silently reopen it.

**Why this is harder than "add units":** the 0.02 is deliberately unitless — an
*ordering*, not a coefficient (`relationships.json`'s own header: strength is
qualitative, NOT calibrated). Converting it directly into "500kr/month/1,000 people"
would require inventing a real elasticity that doesn't exist in the data. That is
exactly the false-precision failure mode Q3 ruled out (option B, "real units via
calibrated coefficients") and that the project's own methodology doc has repeatedly
refused to do elsewhere (e.g. declined to convert a disease IRR into a HALE effect
size). **Do not translate the simulated 0.02 index itself into a real-world statement.**

**What IS honestly possible — and is the actual scope for this phase:** the 4 edges
that already carry a cited literature magnitude (`CASCADE_PROVENANCE` in `js/cascade.js`
— e.g. "33% lower income after 1yr NEET... Andersson et al. 2018") already contain a
real-world number. Today it's shown as a passive citation string. This phase turns it
into an **active, human-readable sentence built from the citation's own number**, e.g.:
*"The literature suggests each year of youth detachment (NEET) is associated with
roughly 33% lower income the following year (Andersson et al. 2018, Sweden twin-pair)"* —
grounded in the cited study, not in the simulator's own propagated index. Scope options
to work out next session: which of the 4 gated edges can support a natural sentence
without overstating the study's actual population/conditions; whether to attempt DK
population-scale framing ("X thousand Danes") only where the source itself provides a
usable base rate, or whether that's still overreach; and whether uncited/contested edges
should get an explicit "no real-world magnitude available" statement instead of silence.

**First step next session:** re-read each of the 4 `CASCADE_PROVENANCE` citations closely
and check, per edge, whether its cited study actually supports a population-scale
DK-specific sentence, or only a directional/percentage one — this determines how far the
"1,000 more Danes" framing can honestly go before the same false-precision problem creeps
back in through a different door.

---

## Cross-cutting: the honesty commitment

The apparatus only ever **cites**. Its credibility with an economist audience rests on
never overclaiming. Two standing rules:

- **Numbers stay unitless in the engine.** Real figures appear only as *cited provenance*,
  never as simulated output — until edges are genuinely calibrated.
- **Caveat hardens with exposure.** The MVP's footer disclaimer is right for a closed
  internal test. **Before any external or public exposure**, harden it: self-labelling
  output ("Illustrative Impact Index") plus mandatory per-node confidence/provenance, so
  even a decontextualised screenshot carries its own caveats.

---

## The one-line ask for Friday

Phase 1 (build now) shows you the **structure and the ranked consequences**. Phase 2 makes
it **move over time**. Where should we invest — is the static MVP enough to make WELA's
alongside-GDP argument, or is the slow-motion time-ripple the thing that makes it land?
