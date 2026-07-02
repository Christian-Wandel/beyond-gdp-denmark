# Dynamics Theory — Beyond GDP Denmark Policy Simulator

> **Status:** living document. This is the theoretical grounding for the what-if
> engine, written *before* any engine code. It records the decisions, the
> reasoning, and the open questions so the model isn't invented inside the code.
> Refine as theory (IPCC tables, academic sources) arrives.
>
> **Scope guard:** one year only. No time series in the dynamics engine yet. We
> model a single snapshot and the ripple from a single push. Lag is recorded on
> edges as metadata but not simulated across years until we explicitly decide to.

---

## 0. The question we're answering

> "If I push indicator X, how does it ripple to Y and Z?"

Not "is Denmark doing well" (that was the old gauge dashboard). The pivot is to a
**policy simulator**: a causal graph where pushing one node propagates a signed,
weighted change to connected nodes.

---

## 1. The core reframing (from IPCC AR6 WG3, Chapter 5)

The conceptual unlock from Chapter 5 is:

> **People demand *services*, not energy or resources per se.**

An indicator like `energy` is not "GJ burned" — it is *the service that energy
delivers* (mobility, warmth, light). The same service can be delivered by
different **provisioning systems**:

| Service     | Old provisioning | New provisioning | Knock-on effects |
|-------------|------------------|------------------|------------------|
| Mobility    | petrol car       | EV + charge port | ghg ↓, pm25 ↓, energy-security ↑ |
| Warmth      | gas boiler       | heat pump        | ghg ↓, pm25 ↓ |
| Protein     | ruminant meat    | plant-based      | ghg ↓, land use ↓, health ↑ |

This is the **Avoid–Shift–Improve (ASI)** framework:
- **Avoid** — don't demand the service (telework avoids the commute).
- **Shift** — deliver the service a lower-impact way (car → bike/transit).
- **Improve** — same delivery, more efficient (ICE → EV, incandescent → LED).

**Why this matters for the model:** the *ripple* is the swap of provisioning
system, holding the service constant. That is what generates the cross-indicator
effects. The "thing" (GJ, headcount) is a poor node; the *service + provisioning
mix* is the right node. (See §6 — several of our current indicators are still
"things" and must be reframed.)

### The trade-off table (Fig 5.6) is a pre-built edge catalogue

Fig 5.6 (Creutzig et al. 2021b) grades each demand-side **strategy** against each
**wellbeing dimension** on a signed scale (+3 … −2) with a confidence level (dots).
That is *literally* a `{from, to, direction, strength, confidence}` table — the
shape our `relationships.json` already uses.

**Critical caveat:** Fig 5.6 connects **strategy → wellbeing dimension**, NOT
**indicator → indicator**. Its rows are levers ("Electric vehicles", "Compact
city"); its columns are dimensions ("Air", "Health", "Mobility"). Neither
vocabulary is our indicator set. So Fig 5.6 is a catalogue to *mine* for the lever
layer (§3.2), not a graph we can drop in directly. See §4 for why.

---

## 2. The headline result that justifies the whole project

> "Demand-side strategies (Avoid–Shift–Improve) can reduce **40–70% of emissions
> across all sectors** (high confidence)." — IPCC AR6 WG3 Ch5

And: decent living standards for everyone are achievable at **~half** current
energy use (Decent Living Energy model, Rao/Steinberger). The simulator's job is
to let a user *see* these trade-offs and ripples for Denmark, concretely.

---

## 3. Architecture: two layers, built in two phases

A central design decision (confirmed): there are **two distinct graphs**, and we
build the inner one first.

```
  ┌─────────────────────────────────────────────────────────────┐
  │  LEVER LAYER  (Sprint 4 — built on top, later)              │
  │  ASI strategies the user picks: "ramp EV", "plant-based"    │
  │  Source: Fig 5.6 + Ch5 prose, translated to our vocabulary  │
  │            │  lever → indicator  (hand-authored translation) │
  └────────────┼────────────────────────────────────────────────┘
               ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  INDICATOR LAYER  (Sprint 3 — built FIRST)                  │
  │  The ripple engine: indicator → indicator                  │
  │  Nodes = the things we have data for (ghg, pm25, hale…)     │
  │  Source: well-evidenced physical chains first              │
  └─────────────────────────────────────────────────────────────┘
```

### 3.1 Indicator layer (build first)

- **Nodes:** our actual indicators (the `nodes` list in `relationships.json`).
- **Edges:** indicator → indicator, signed, weighted, with lag metadata.
- **User action (Sprint 3):** push an indicator directly ("cut ghg 20%"), watch
  the ripple.
- **Edge sourcing (decided):** start with **only well-evidenced physical chains**
  — the high-confidence, physically grounded edges. Softer social/wellbeing edges
  are deferred to a later pass. This keeps v1 small and defensible.

### 3.2 Lever layer (build on top, later)

- **Nodes:** ASI strategies (EV adoption, plant-based shift, compact city…).
- **Edges:** lever → indicator (e.g. `ev_adoption → ghg (−)`, `ev_adoption → pm25 (−)`).
- **User action (Sprint 4):** push a *lever*; engine translates to indicator
  deltas, then **reuses the Sprint-3 ripple** to propagate.
- **Edge sourcing:** this is where Fig 5.6 gets mined. Each Fig 5.6 cell becomes a
  lever→indicator edge once we map its wellbeing dimension to one of our indicators
  (Air→pm25, Health→hale, etc. — see §5.3).

Building inner-first means Sprint 3 stands alone and Sprint 4 is purely additive.

---

## 4. Why the two graphs can't be merged naïvely

Three vocabularies are in play and conflating them causes silent bugs:

1. **Strategies / levers** — Fig 5.6 rows. What a policymaker *does*.
2. **Wellbeing dimensions** — Fig 5.6 columns. Human-needs categories.
3. **Indicators** — our nodes. What we have *time series* for.

Fig 5.6 is layer 1 → layer 2. Our ripple engine is layer 3 → layer 3. The bridge
is a hand-authored mapping (layer 2 dimension → layer 3 indicator, §5.3) plus a
lever→indicator authoring pass (§3.2). There is no automatic merge.

---

## 5. Sign conventions — the part that silently corrupts everything

Two different sign systems exist. Pick one for edges; convert only at display.

### 5.1 Two sign spaces

- **Raw-value space:** "raw value of `from` goes up → raw value of `to` goes ___".
  Physical, directly testable against `denmark_wide.json`.
- **Wellbeing space:** "this strategy *improves* this dimension" (Fig 5.6's +2 is
  already direction-corrected — it means "better off", regardless of whether the
  underlying number rose or fell).

**Decision: edges are authored in RAW-VALUE space.** It is the only space we can
check against the data. Wellbeing space is reserved for *display* (coloring a
ripple green/red), computed at render time using each indicator's `direction`.

### 5.2 The edge sign rule (raw-value space)

`direction: "positive"` means: raw `from` ↑ ⇒ raw `to` ↑ (they move together).
`direction: "negative"` means: raw `from` ↑ ⇒ raw `to` ↓ (they move opposite).

This is independent of whether either indicator is "good when high". Example from
the existing `_examples`:

```
pm25 → hale, direction: negative
  raw pm25 up ⇒ raw hale down.
  (pm25 is lower_better, hale is higher_better — but the EDGE doesn't care.
   The display layer reads `direction` per indicator to decide the color.)
```

### 5.3 Wellbeing translation (display + lever mining only)

To convert raw movement → "better/worse" for display, and to map Fig 5.6 columns
to our indicators:

| Fig 5.6 dimension | Our indicator | Notes |
|-------------------|---------------|-------|
| Air               | pm25          | lower_better |
| Health            | hale, lbw, life_expectancy | |
| Energy            | energy (→ renewable share, §6) | |
| Mobility          | *(no direct indicator yet)* | candidate gap (§7) |
| Social cohesion   | *(no direct indicator)* | gap |
| Economic stability| unemployment, income, produced_capital | |
| Material provision| produced_capital | |
| Education         | education (→ attainment share, §6), learning_outcomes | |

Blank cells in this table = **data gaps** worth flagging (§7).

---

## 6. Indicators that must be reframed BEFORE the ripple works

The "service, not the thing" principle is not a sprint-4 nicety — it's a
precondition. Three current nodes are "things" and can't carry ASI logic:

| Node | Current (a "thing") | Must become (a service/mix) | Why |
|------|---------------------|------------------------------|-----|
| `energy` | total supply (GJ), `neutral` | **renewable share (%)**, directional | Can't model "shift gas→renewable" if the node is undifferentiated GJ. |
| `education` | headcount 15-69, `neutral` | **attainment share (% tertiary/secondary)** | Headcount has no good/bad direction; share does, and links to income. |
| `population` | persons, `neutral` | stays a context/scaling variable, not a ripple node | It's a denominator, not a lever target. |

Until `energy` and `education` are reframed, they sit *outside* the ripple graph
(no incoming/outgoing causal edges). That's honest, not broken. Flagged in
`indicator_meta.json` `_note` fields already.

---

## 7. Known data gaps (surfaced by this analysis)

Mining Fig 5.6 reveals wellbeing dimensions we have no indicator for. Candidates
to consider adding (DST or HLEG), in rough priority:

- **Mobility / accessibility** — central to ASI (transport is the single biggest
  CO2 lever in Ch5) yet we have no mobility indicator. High value.
- **Renewable energy share** — see §6; required for the energy node to function.
- **Educational attainment share** — see §6.
- **Social cohesion / participation** — Fig 5.6 columns with no home. Lower
  priority; soft to measure.

These are candidates, not commitments. Add only when a relationship needs them.

---

## 8. Edge schema (already in `relationships.json`)

```json
{
  "from": "pm25",
  "to": "hale",
  "direction": "negative",   // RAW-VALUE space (§5.2)
  "strength": 0.6,           // qualitative ordering 0–1, NOT a coefficient yet
  "lag_years": 1,            // metadata only; not simulated in one-year mode
  "confidence": "high",      // high | med | low — gates what's in v1
  "source": "GBD 2019 …",    // citation — every edge must have one
  "note": "…"                // direction/mechanism explanation
}
```

Conventions:
- **`strength` is ordinal, not calibrated.** Use it to rank edges, not to compute
  precise outputs. A real coefficient comes only with calibration data (future).
- **`confidence` gates v1.** Only `high` (and select `med`) physical edges ship in
  the Sprint-3 graph. `low`/social edges are authored but flagged/held back.
- **Every edge needs a `source`.** No source → it's a hypothesis, parked in a
  separate list, not in `edges`.

---

## 9. Proposed v1 edge set (well-evidenced physical chains)

Starting point — to be reviewed, not final. All raw-value space.

| from | to | dir | conf | source (provisional) | mechanism |
|------|----|-----|------|----------------------|-----------|
| ghg | pm25 | positive | high | Combustion co-emits CO2 + particulates | Fossil combustion drives both. |
| pm25 | hale | negative | high | GBD 2019 ambient PM attributable DALY | Air pollution shortens healthy life. |
| pm25 | lbw | positive | med | Maternal PM exposure ↔ low birthweight | Higher pm25 → more low-birthweight. |
| education | income | positive | high | Mincer earnings; OECD EAG | Attainment → wage premium (lag ~5y). |
| income | life_satisfaction | positive | med | Easterlin / Cantril literature | Up to a threshold; diminishing returns. |
| unemployment | life_satisfaction | negative | high | Well-being literature | Joblessness lowers life satisfaction. |
| ghg | unemployment | positive | med | IPCC Ch4 just-transition | Fossil phase-out → short-term job loss (lag 2y), green jobs offset later. |

This is the seed. Each row needs its `source` firmed up before it lands in
`relationships.json`. Soft social edges (gini→life_satisfaction, etc.) are
deliberately deferred.

---

## 10. One-year engine semantics (keep it simple)

For v1, the engine is a **single-step signed propagation**, not a time
simulation:

1. User sets a delta on one indicator (e.g. ghg −20%).
2. For each outgoing edge, apply `delta_to = delta_from × strength × sign(direction)`.
   (Strength is ordinal, so treat output as *directional + relative magnitude*,
   not a precise number — display arrows/bands, not false decimals.)
3. Propagate one or two hops; mark `lag_years > 0` edges visually as "delayed"
   but do not advance a clock.
4. Stop. No feedback loops resolved across years, no convergence — that's a later,
   explicit decision.

This deliberately under-promises: we show *direction and rough size* of ripples,
honestly labelled as such, not a spurious forecast.

---

## 11. Open questions (for next sessions)

1. **Magnitude vs direction.** Do we ever want real coefficients, or is
   "direction + ordinal size" the honest ceiling without calibration data?
2. **Multi-hop depth.** One hop? Two? Where do we cut off to avoid implying
   precision we don't have?
3. **Feedback loops.** ghg→unemployment→life_satisfaction…→? When (if ever) do we
   let cycles resolve? One-year mode sidesteps this; do we keep sidestepping?
4. **Lever granularity.** Sprint 4: do levers map to *single* indicators or fan out
   to several (EV → ghg AND pm25 AND energy-mix)? Fig 5.6 implies fan-out.
5. **Which gaps to fill (§7).** Mobility indicator seems highest-value — confirm
   before fetching.

---

## 12. Sources

- IPCC AR6 WG3, **Chapter 5** — "Demand, Services and Social Aspects of
  Mitigation" (Creutzig, Roy et al. 2022). The conceptual spine.
- **Fig 5.6** (Creutzig et al. 2021b) — strategy × wellbeing trade-off matrix.
  The edge catalogue for the lever layer.
- Drilled, "2022 IPCC Mitigation Report, Part 1: Debunking Demand" — accessible
  framing; Steinberger interview; Decent Living Energy context.
- Decent Living Energy model (Rao et al., Yale; Steinberger et al., Lausanne).
```

