# Folkeskole Cascade — What-If Simulator (Phase 1 / MVP Build Plan)

**Status:** ready to build · **Drafted:** 2026-07-01 (from a grill-me design session)
**Scope:** MVP, tested behind closed doors (Christian + WELA), not public.
**Extends:** `js/cascade.js` (already loads `cascadeData` from `data/relationships.json`).

---

## 1. Purpose (what an economist can do after using it)

Priority order, settled in the grill:

1. **C — primary:** make the *alongside-GDP* argument visceral. Push the folkeskole
   funding lever and watch the **non-monetary** nodes move (life satisfaction, health,
   inequality, trust) that never appear in a GDP figure. Also serves as reference
   material for the *expected consequence set* (good and bad) of a funding change.
2. **B — important secondary:** ordinal / directional insight for **early-stage policy
   narratives** — "this channel dominates that one," a ranked, data-backed argument
   scaffold.
3. **A — structure legibility:** not a goal; falls out of C and B for free.
4. **D — a defensible forecast number:** **explicitly ruled out.** The tool cites, it
   does not predict.

**Alongside GDP, never supplementing.** The entire point is to see how an economy moves
*other than* money — GDP-proxy nodes move a little, the non-money economy moves too.

---

## 2. The lever

- **Units:** real 2024-kr per pupil. This uses the actual DST series
  `data/dst_folkeskole_funding.json` (2016–2024, 104,351 → 109,471 kr/pupil).
- **Slider default:** latest actual (2024 ≈ 109,471 kr).
- **Historical envelope:** the 2016–2024 real range drawn on the slider track, so the
  user can see where "reality" sits and can't silently drag into fantasy.

### Presets (the onboarding rail)

Presets exist to teach the tool by example — a first-time user is overwhelmed by the
node graph; clicking a preset shows a *meaningful* jump and activates intuition.

**Recalibrated to realistic, policy-sized changes, symmetric around today** — the
cascade's own thesis is about underfunding, so cuts must be as visible as increases.
**±100% illustrative bookends added afterward** (deliberate user addition, 2026-07-01,
same session) purely to make the "education funding has meaningful impact" point
viscerally — these sit at the clamp boundary and are intentionally the most dramatic,
least realistic presets in the set.

| Preset | Value | Role |
|--------|-------|------|
| **-100% funding** | 0 | Illustrative extreme bookend (deliberate user addition 2026-07-01) |
| **-20% funding** | 0.80 × today | Large cut |
| **-10% funding** | 0.90 × today | Moderate cut |
| **Today** | latest actual (2024) | Home base — always returnable, "this is where we stand" |
| **+10% funding** | 1.10 × today | Moderate increase |
| **+20% funding** | 1.20 × today | Large increase |
| **+100% funding** | 2.00 × today | Illustrative extreme bookend (deliberate user addition 2026-07-01) |

Dropped from the grill: "Denmark's peak" (data only goes to 2016, would mislabel) and
"Match Finland" (comparability + sourcing cost). Kept purely in the Danish context. The
original ±25/50/100% draft was replaced — those magnitudes were politically implausible
and saturated the clamped engine (§3), so every preset above +25% produced an identical
maxed-out ripple, erasing the "step up the ripple" onboarding gradient. ±10/20% stays
inside the clamp's linear response zone, so each preset visibly differs from the next.

> **Honest note:** even at ±20% this is a large push relative to the historical
> 2016–2024 swing (~5%). That's fine for illustration (C-primary: "watch how much the
> non-money economy *would* move"), but it
> leans into big deltas — which is *why* the unitless engine (§3) matters more than the
> footer caveat (§6).

---

## 3. Propagation math — the crux

The `strength` field is a **qualitative 0.0–1.0 ordering, NOT a calibrated coefficient**
(stated at the top of `relationships.json`). The input is real kr. Multiplying real kr by
an uncalibrated strength produces a number that *looks* quantitative but is meaningless.
So the output must never pretend to be real units.

### Engine (option A): unitless relative deltas

1. **Normalize the lever push as percent change from today, clamped to ±1.** A push is
   expressed relative to today's real funding level (`(value - today) / today`), not as
   raw kr into the math — the *input* to propagation is already unitless. The clamp
   guards against a push so large it would otherwise imply false precision; the historical
   2016–2024 envelope is deliberately NOT the normalization basis, since it's only ~5%
   wide and would saturate every preset beyond a small push to the same clamped value.
2. **Propagate through edges:** for each edge, `child_delta = parent_delta × strength ×
   direction_sign`, where `direction` gives the sign (reinforcing `+`, tradeoff per the
   edge's `direction` field).
3. **Multiplicative attenuation per hop:** effects naturally decay with distance. A 3-hop
   path (0.35 × 0.55 × 0.60) lands weak — which is correct and honest.
4. **Concavity only where an edge note demands it** (e.g. `income → life_satisfaction` is
   flagged "concave, diminishing returns"). Do **not** build a general nonlinear engine —
   apply a concave transform only on the flagged edges. Match complexity to problem.
5. **The loop** (`income → learning_outcomes`, lag 15, `"loop": true`): in the *static*
   MVP, run propagation as a **single forward pass** (no iteration) so the loop edge
   contributes one hop and cannot compound/oscillate. Loop dynamics are a Phase-2 problem
   (see roadmap).

Output per node = a **unitless relative response** ("moves strongly up / mildly down"),
presented as an illustrative impact index — never "+3,200 kr."

### Partial real-units (provenance, NOT simulation output)

Strong / well-cited edges surface their **cited literature number** as static provenance:

- It is **static** — it does NOT scale with the slider. It's an evidence tooltip / panel
  annotation, not a computed result.
- **Gate:** show a number only where the edge `note`/`source` contains a *convertible
  cited magnitude* with a real source (e.g. `learning_outcomes → income`: "~8–10% wage
  premium per school year, OECD EaG 2024"; `neet → income`: "33% lower income after 1yr
  NEET, Swedish twin-pair"). Not gated purely on `draft` status — several draft edges
  carry strong cited figures, and several notes explicitly say "no convertible estimate."
- **Contested / weak edges show their weakness, not a number** (e.g. `gini →
  life_satisfaction`: "contested — direction only, no reliable magnitude"). Honesty cuts
  both ways.

> **Architectural rule:** the **engine** and the **provenance layer** are two separate
> systems that happen to render on the same graph. The engine must never read a real
> number; the provenance layer must never feed the engine. This separation is what keeps
> the honesty guarantee auditable.

---

## 4. Time dimension — static end-state (C-first)

- Push the lever → show the **fully-propagated final deltas** (single forward pass), all
  at once.
- Each node / edge is **labelled with its time-to-effect** read off `lag_years`
  ("+2y", "+8y", "+15y"), so the *slowness* of the harm is visible without animating it.
  This preserves the "slow-motion, compounds over years, GDP saw nothing this year"
  narrative at a fraction of an animation engine's cost.
- **Lag-aware year-by-year ripple → Phase 2** (see roadmap for the 4 blockers).

---

## 5. Rendering — node encoding + ranked results panel

- **Node encoding (visceral, C-primary):** nodes shift size around a neutral baseline by
  SIGNED delta — grow past neutral for increases, shrink below it for decreases (sqrt-
  curved, since realistic deltas cluster in a narrow 0.05-0.35 band where a linear map was
  visually imperceptible) — and shift on a signed colour ramp (green up / red down,
  intensity = magnitude), animated in place on the existing ECharts graph. Size direction
  must always agree with colour direction; an earlier symmetric `|delta|`-only sizing made
  a node moving down render the same size as one moving up (bug, fixed 2026-07-01 — see
  session log). Must read cleanly in **both light and dark** themes.
- **Ranked results panel (citable, B-secondary):** a compact panel beside the graph,
  reusing the existing `#cascade-findings` pattern, listing moved nodes **ranked by
  |delta|** with sign, time-to-effect, and — where available — the provenance number /
  confidence. This is where the "youth unemployment moves most, then inequality, then
  wellbeing" ordering lives as something an economist can cite.
- **No edge-pulse animation** in the MVP — pulses imply motion-through-time, which we
  deliberately deferred. Using them now would visually promise the Phase-2 ripple.

---

## 6. Caveat — footer (MVP)

- A **single footer disclaimer** under the graph: *"Modelled effects are illustrative,
  based on cited causal directions, not calibrated forecasts."*
- Proportionate because the audience is informed (Christian + WELA already know the math
  is uncalibrated and are actively working it). The screenshot-in-the-wild threat doesn't
  exist yet.
- Note: the footer is only the *warning label*. The honesty in the **numbers** is
  structural (the unitless engine of §3 means nothing masquerades as real units) and stays
  regardless.
- **Tripwire (logged to roadmap):** harden the caveat from footer → self-labelling output
  + mandatory per-node provenance **before any external / public exposure.**

---

## 7. Monitoring / reference mode — OUT of the MVP

- The what-if slider is a *prospective* tool. "Monitor actual outcomes vs. what we
  expected" is a *retrospective* predicted-vs-actual feature — a different job.
- **Out of this build.** Real-measured-series **sparklines** beside nodes (B-minimal) are
  the natural on-ramp and are flagged for Phase 2. Full predicted-vs-actual validation is
  its own future sprint (probably its own grill).

---

## 8. Build checklist

1. **`js/cascade.js`** (extend — it already loads `cascadeData`):
   - [ ] Load the lever series (`data/dst_folkeskole_funding.json`) for default + envelope.
   - [ ] `simulateCascade(leverPush)` — normalize push, single forward pass over edges
         applying `strength × direction` with multiplicative attenuation; concavity only on
         flagged edges; returns `{nodeId: relativeDelta}`.
   - [ ] Provenance layer — separate function reading `note`/`source` for the convertible
         cited numbers; must not touch the engine.
   - [ ] Node encoding — size + signed colour ramp from the deltas, both themes.
   - [ ] Ranked results panel — extend the `#cascade-findings` pattern; rank by |delta|,
         show sign + time-to-effect + provenance/confidence.
2. **`index.html`**:
   - [ ] Real-kr lever slider (default = latest actual, envelope on track).
   - [ ] Preset buttons: -100% / -20% / -10% / Today / +10% / +20% / +100%.
   - [ ] Results panel container + footer caveat.
   - [ ] CSS for slider, presets, panel, footer (light + dark).
3. **Verify:** serve `python -m http.server 8765`, check the Education Cascade section in
   **both themes** via Playwright; confirm presets step up the ripple, panel ranks
   correctly, provenance shows only on gated edges, contested edges show weakness.

## 9. Flags carried into the build

- **+100% preset** leans into big illustrative deltas → the unitless engine is the real
  safeguard, not the footer.
- **WELA meeting Fri 2026-07-03** may reshape priorities. The MVP is scoped so their
  feedback lands on **Phase 2**, not a half-built Phase 1.
- **Engine / provenance separation** is load-bearing for the honesty claim — keep them in
  distinct functions with no cross-calls.
