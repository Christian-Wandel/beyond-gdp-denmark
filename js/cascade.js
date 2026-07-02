/**
 * cascade.js — the folkeskole (education) cascade card for the WELA apparatus.
 *
 * Renders data/relationships.json as a directed node-graph (ECharts 'graph' series):
 * a policy lever (folkeskole funding) cascading through measured indicators.
 * Edges carry direction, strength, lag, confidence, and a cited source — the card
 * is built to be argued with, not to forecast.
 *
 * Visual encoding:
 *   strength   → edge width
 *   confidence → edge style (high=solid, med=dashed, low=dotted)
 *   relation   → edge colour (reinforcing=green, tradeoff=red/amber)
 *   lag+source → tooltip on hover
 *
 * Also renders a static "what we found" findings panel (#cascade-findings) summarizing
 * the Phase 3 hardening pass: how many edges are evidence-resolved vs. still draft,
 * the strongest links, and the biggest remaining data gap. Derived live from
 * relationships.json, not hard-coded, so it stays correct as edges get re-hardened.
 *
 * Init is driven from index.html (renderCascade), not auto-run, to coordinate with
 * the loading overlay — same pattern as scenarios.js.
 */

let cascadeData = null;          // parsed relationships.json
let leverSeries = null;          // parsed data/dst_folkeskole_funding.json
let dataDictionary = null;       // parsed data/data_dictionary.json (node drawer)
let unitTranslations = null;     // parsed data/unit_translations.json (Phase 5 real-unit layer)
let benchmarksData = null;       // parsed data/unified/benchmarks.json, fetched lazily on first benchmark-node drawer open
const CASCADE_FOCUS = 'education';

// Simulator state: current lever value in real 2024-kr/pupil. Set once leverSeries loads.
let simLeverValue = null;
let simLastResult = null;        // last simulateCascade() output, for the results panel

// Which direction is the GOOD outcome for each node — used to color nodes by whether
// the simulated push moved them toward or away from what's desirable, not just by raw
// delta sign. E.g. NEET going down is good (green), even though its delta is negative.
const CASCADE_DESIRABLE_DIRECTION = {
  learning_outcomes: 'up',
  income: 'up',
  life_satisfaction: 'up',
  hale: 'up',
  life_expectancy: 'up',
  neet: 'down',
  unemployment: 'down',
  gini: 'down',
  poverty_rate: 'down',
};

// Manual node layout (x,y in a 0..100 grid) so the cascade reads left→right as a
// story rather than a force-directed hairball. Lever on the left, outcomes on the right.
const CASCADE_LAYOUT = {
  folkeskole_funding: { x: 4,  y: 50, label: 'Primary school\nfunding' },
  learning_outcomes:  { x: 26, y: 20, label: 'Learning\n(test scores)' },
  neet:               { x: 26, y: 80, label: 'NEET\n(not in education/work)' },
  income:             { x: 50, y: 38, label: 'Income' },
  unemployment:       { x: 50, y: 94, label: 'Unemployment' },
  gini:               { x: 74, y: 6,  label: 'Inequality (Gini)' },
  life_satisfaction:  { x: 86, y: 50, label: 'Life satisfaction' },
  hale:               { x: 74, y: 66, label: 'Healthy life years' },
  life_expectancy:    { x: 74, y: 88, label: 'Life expectancy' },
  poverty_rate:       { x: 50, y: 2,  label: 'Poverty' },
};

async function loadCascade() {
  cascadeData = await fetch('data/relationships.json').then(r => r.json());
  leverSeries = await fetch('data/dst_folkeskole_funding.json').then(r => r.json());
  dataDictionary = await fetch('data/data_dictionary.json').then(r => r.json());
  unitTranslations = await fetch('data/unit_translations.json').then(r => r.json()).catch(() => null);
  const series = leverSeries?.data?.DNK?.series || {};
  const years = Object.keys(series).map(Number).sort((a, b) => a - b);
  const latestYear = years[years.length - 1];
  simLeverValue = series[latestYear];
}

// ── What-if simulator ──────────────────────────────────────────────────────────
//
// Engine: unitless relative deltas. `strength` is a qualitative 0-1 ordering, NOT a
// calibrated coefficient (see relationships.json header note). The lever push is
// normalized as percent change from today's baseline (clamped +/-1), NOT against the
// lever's historical range — the 2016-2024 envelope is only ~5% wide and would saturate
// every preset beyond a small push to the same clamped value, erasing the "step up the
// ripple" onboarding gradient. Every downstream delta stays unitless — an "illustrative
// impact index", never a fabricated real-unit forecast. Propagation itself lives in
// cascade-engine.js (propagateCascade), extracted so it can run standalone in
// tests/test_cascade_engine.js. See docs/simulator_plan.md §3 for the full rationale.

function leverHistoricalRange() {
  const series = leverSeries?.data?.DNK?.series || {};
  const values = Object.values(series);
  return { min: Math.min(...values), max: Math.max(...values) };
}

// Edges whose note/source carries a directly convertible cited magnitude — shown as
// static provenance in the results panel. Does NOT feed the engine and does NOT scale
// with the lever; it is the literature's own number, not a simulated one.
const CASCADE_PROVENANCE = {
  'learning_outcomes->income': '~8-10% wage premium per school year (OECD EaG 2024; Jackson et al. 2016)',
  'learning_outcomes->unemployment': 'Employment rate 62% (below upper-secondary) vs 89% (tertiary), DK 2023 (OECD EaG 2024)',
  'neet->income': '33% lower income after 1yr NEET, dose-responsive to duration (Andersson et al. 2018, Sweden twin-pair)',
  'income->life_satisfaction': 'Richest 20% = 6.4 vs poorest 20% = 5.8 on 0-10 ladder (OECD Review of education policies)',
};

/**
 * Propagate a lever push through the cascade edges as unitless relative deltas.
 * Thin wrapper around propagateCascade (cascade-engine.js) that resolves the lever's
 * pushFraction from the live leverSeries baseline.
 * @param {number} leverValue - real kr/pupil the slider is set to
 * @returns {{ pushFraction: number, deltas: Record<string, number>, dominantEdge: Record<string, object> }}
 */
function simulateCascade(leverValue, focus = CASCADE_FOCUS) {
  const edges = (cascadeData?.edges || []).filter(e => e.cascade === focus);
  const leverId = cascadeData?.cascades?.[focus]?.lever;

  // Normalize the push as percent change from today's real funding level, not raw kr —
  // this keeps the input (and everything downstream) unitless. Presets span
  // -50/-20/-10/Today/+10/+20/+50; the underlying clamp still allows +/-100% via manual
  // slider drag past the presets.
  const pushFraction = clampUnit((leverValue - simBaselineValue()) / simBaselineValue());

  const { deltas, dominantEdge } = propagateCascade(edges, leverId, pushFraction);
  return { pushFraction, deltas, dominantEdge };
}

function simBaselineValue() {
  const years = Object.keys(leverSeries?.data?.DNK?.series || {}).map(Number).sort((a, b) => a - b);
  const latestYear = years[years.length - 1];
  return leverSeries.data.DNK.series[latestYear];
}

let _permalinkTimer = null;

// Debounced so continuous slider drags don't spam history.replaceState — updates the
// URL to a shareable ?lever=<kr> permalink of the current simulator state.
function updatePermalink(leverValue) {
  if (_permalinkTimer) clearTimeout(_permalinkTimer);
  _permalinkTimer = setTimeout(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('lever', Math.round(leverValue));
    url.hash = 'section-cascade';
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, 300);
}

function runSimulation(leverValue, fromSlider = false) {
  simLeverValue = leverValue;
  simLastResult = simulateCascade(leverValue);
  renderCascade(fromSlider);
  updatePermalink(leverValue);
}

// Map confidence → ECharts line type
function confType(conf) {
  return conf === 'high' ? 'solid' : conf === 'med' ? 'dashed' : 'dotted';
}

function buildCascadeOption(focus = CASCADE_FOCUS) {
  const c = liveColors();
  const edges = (cascadeData?.edges || []).filter(e => e.cascade === focus);

  // Collect the nodes actually used by this cascade's edges
  const used = new Set();
  edges.forEach(e => { used.add(e.from); used.add(e.to); });

  const leverId = cascadeData?.cascades?.[focus]?.lever;
  const deltas = simLastResult?.deltas || {};

  const nodes = [...used].map(id => {
    const pos = CASCADE_LAYOUT[id] || { x: 50, y: 50, label: id };
    const isLever = id === leverId;
    const delta = isLever ? 0 : (deltas[id] || 0); // lever shows its own control, not a delta
    // Node size/colour encode the simulated relative delta (§5 of the plan): a node
    // whose value INCREASES grows past the neutral size, one that DECREASES shrinks
    // below it — size direction must match colour direction (green=grows, red=shrinks),
    // not just track |delta| symmetrically (that made a -20% and +20% push produce
    // identical sizes, which reads as "this moved" but not "which way").
    // sqrt curve + larger multiplier: realistic deltas cluster in 0.05-0.35, and a linear
    // map over that narrow band was visually imperceptible. sqrt stretches small deltas
    // out so even a 0.1 push reads as a clearly different size from a 0.3 push.
    const magnitude = Math.min(Math.abs(delta), 1);
    const neutralSize = 46;
    const sizeShift = Math.sqrt(magnitude) * 46;
    const simSize = delta > 0.02 ? neutralSize + sizeShift
                  : delta < -0.02 ? Math.max(neutralSize - sizeShift, 14)
                  : neutralSize;
    // Color encodes desirability, not raw sign: for "down is good" nodes (neet, gini,
    // etc.) a negative delta is green, a positive delta is red — inverted from nodes
    // where up is good. Size (above) still tracks raw delta sign/magnitude regardless.
    const desirable = CASCADE_DESIRABLE_DIRECTION[id] || 'up';
    const isGoodMove = desirable === 'up' ? delta > 0.02 : delta < -0.02;
    const isBadMove = desirable === 'up' ? delta < -0.02 : delta > 0.02;
    const deltaColor = isGoodMove ? c.green : isBadMove ? c.red : (isLever ? c.marker : c.surface);
    return {
      name: id,
      x: pos.x,
      y: pos.y,
      value: pos.label,
      symbol: isLever ? 'roundRect' : 'circle',
      symbolSize: isLever ? [96, 52] : simSize,
      label: {
        show: true,
        formatter: () => pos.label,
        color: isLever ? '#fff' : c.textLow,
        fontSize: isLever ? 12 : 11,
        fontWeight: isLever ? 700 : 500,
        lineHeight: 14,
        position: isLever ? 'inside' : 'bottom',
      },
      itemStyle: {
        color: isLever ? c.marker : deltaColor,
        borderColor: isLever ? c.marker : (Math.abs(delta) > 0.02 ? deltaColor : c.textLow),
        borderWidth: isLever ? 0 : 1.5,
        opacity: isLever || Math.abs(delta) <= 0.02 ? (isLever ? 1 : 0.18) : 0.85,
      },
    };
  });

  const links = edges.map(e => {
    const reinforcing = e.relation === 'reinforcing';
    const color = reinforcing ? c.green : (e.contested ? c.amber : c.red);
    return {
      source: e.from,
      target: e.to,
      // qualitative strength → width 1.2..4
      lineStyle: {
        width: 1.2 + (e.strength || 0.3) * 3.5,
        color,
        type: confType(e.confidence),
        opacity: e.contested ? 0.6 : 0.85,
        curveness: 0.12,
      },
      // stash for tooltip
      _meta: e,
    };
  });

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: c.surface,
      borderColor: c.textLow,
      textStyle: { color: c.textLow, fontSize: 12 },
      formatter: (p) => {
        if (p.dataType === 'edge') {
          const m = p.data._meta || {};
          const dirArrow = m.relation === 'reinforcing' ? '↑ reinforces' : '↓ trade-off';
          const conf = { high: 'high', med: 'medium', low: 'low' }[m.confidence] || m.confidence;
          return `<b>${CASCADE_LAYOUT[m.from]?.label.replace(/\n/g,' ') || m.from} → ${CASCADE_LAYOUT[m.to]?.label.replace(/\n/g,' ') || m.to}</b><br/>` +
                 `${dirArrow} &middot; strength ${(m.strength).toFixed(2)} &middot; ~${m.lag_years}y lag<br/>` +
                 `Confidence: ${conf}${m.contested ? ' (contested)' : ''}${m.loop ? ' &middot; feedback loop' : ''}<br/>` +
                 `<span style="color:${c.marker}">Source:</span> ${m.source}` +
                 (m.draft ? '<br/><i style="opacity:.7">draft — pending source hardening</i>' : '');
        }
        const lbl = CASCADE_LAYOUT[p.name]?.label.replace(/\n/g, ' ') || p.name;
        if (p.name === leverId) return `<b>${lbl}</b>`;
        const delta = deltas[p.name];
        if (delta === undefined || Math.abs(delta) <= 0.02) return `<b>${lbl}</b><br/>no simulated effect from this push`;
        const desirable = CASCADE_DESIRABLE_DIRECTION[p.name] || 'up';
        const isGoodMove = desirable === 'up' ? delta > 0 : delta < 0;
        const outcome = isGoodMove ? 'a better outcome' : 'a worse outcome';
        return `<b>${lbl}</b><br/>Simulated: moves toward ${outcome} (illustrative impact index ${delta.toFixed(2)})`;
      },
    },
    animationDuration: 600,
    series: [{
      type: 'graph',
      layout: 'none',          // use our manual x/y
      coordinateSystem: null,
      roam: true,
      draggable: true,
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: 9,
      data: nodes,
      links,
      lineStyle: { color: 'source' },
      emphasis: { focus: 'adjacency', lineStyle: { width: 5 } },
    }],
  };
}

function renderCascade(fromSlider = false) {
  const el = document.getElementById('cascade-graph');
  if (!el || !cascadeData) return;

  // Reuse an existing instance across simulator re-renders (echarts.init is a no-op on
  // an already-initialized node) so node-delta transitions animate instead of flashing.
  const isNewChart = !echarts.getInstanceByDom(el);
  const chart = echarts.getInstanceByDom(el) || echarts.init(el, null, { renderer: 'svg' });
  // Register in the global charts map so the resize handler in dashboard.js covers it.
  if (typeof charts === 'object') charts['__cascade_education'] = chart;
  chart.setOption(buildCascadeOption(), { notMerge: true });

  // Bind the node-click handler once — chart.off/on again on every render would be
  // harmless but pointless churn, so only bind on first init.
  if (isNewChart) {
    chart.on('click', (p) => { if (p.dataType === 'node') openNodeDrawer(p.name); });
  }

  // Findings and the GDP strip are fully static (derived from relationships.json /
  // denmark_wide.json, not the simulation state) — render once on first call rather
  // than on every slider tick.
  renderCascadeFindings();
  renderGdpStrip();
  renderCascadeSimulator(fromSlider);
  renderCascadeResults();
}

// ── Simulator UI (lever slider + presets) ──────────────────────────────────────

function simPresets() {
  const today = simBaselineValue();
  // Realistic policy-sized range, symmetric so underfunding cuts are as visible as
  // increases — the cascade's own thesis is about underfunding, so -10%/-20% matter
  // at least as much as the upside presets.
  return [
    { label: '-50%', value: today * 0.50 },
    { label: '-20%', value: today * 0.80 },
    { label: '-10%', value: today * 0.90 },
    { label: 'Today', value: today },
    { label: '+10%', value: today * 1.10 },
    { label: '+20%', value: today * 1.20 },
    { label: '+50%', value: today * 1.50 },
  ];
}

// Update only the dynamic bits of an already-built simulator UI: the value readout,
// the slider thumb position (skipped when the update originated FROM the slider being
// dragged, so we never fight the user's own input event), and which preset is active.
// `fromSlider` = true when called from the slider's own 'input' handler.
function updateCascadeSimulatorUI(fromSlider) {
  const el = document.getElementById('cascade-simulator');
  if (!el) return;
  const fmt = (v) => Math.round(v).toLocaleString('da-DK');

  const valueEl = el.querySelector('.sim-value');
  if (valueEl) valueEl.textContent = `${fmt(simLeverValue)} kr / pupil`;

  const slider = document.getElementById('sim-slider');
  if (slider && !fromSlider) slider.value = simLeverValue;

  el.querySelectorAll('.sim-preset-btn').forEach(btn => {
    btn.classList.toggle('active', Math.round(Number(btn.dataset.value)) === Math.round(simLeverValue));
  });
}

function renderCascadeSimulator(fromSlider = false) {
  const el = document.getElementById('cascade-simulator');
  if (!el || !leverSeries) return;

  // Build the DOM once; on every subsequent call (slider drags, preset clicks) just
  // patch the dynamic bits in place. Rebuilding via innerHTML on every 'input' event
  // was destroying the very slider element being dragged, breaking continuous drag.
  if (el.dataset.built === '1') {
    updateCascadeSimulatorUI(fromSlider);
    return;
  }

  const { min, max } = leverHistoricalRange();
  const today = simBaselineValue();
  const fmt = (v) => Math.round(v).toLocaleString('da-DK');
  // Slider spans the full preset range (-50%..+50% of today, the policy-sized extremes)
  // plus a hair past the historical envelope on either side.
  const sliderMin = Math.min(min, today * 0.50) * 0.98;
  const sliderMax = Math.max(max, today * 1.50) * 1.02;

  el.innerHTML = `
    <div class="sim-header">
      <h3>What-if: primary school funding</h3>
      <span class="sim-value">${fmt(simLeverValue)} kr / pupil</span>
    </div>
    <input type="range" id="sim-slider" min="${sliderMin}" max="${sliderMax}" step="100"
           value="${simLeverValue}" class="sim-slider" />
    <div class="sim-envelope">
      <span>${fmt(min)}</span>
      <span class="sim-envelope-label">2016-2024 real range</span>
      <span>${fmt(max)}</span>
    </div>
    <div class="sim-presets">
      ${simPresets().map(p => `<button type="button" class="sim-preset-btn${Math.round(p.value) === Math.round(simLeverValue) ? ' active' : ''}" data-value="${p.value}">${p.label}</button>`).join('')}
    </div>
  `;

  const slider = document.getElementById('sim-slider');
  slider.addEventListener('input', (e) => runSimulation(Number(e.target.value), true));
  el.querySelectorAll('.sim-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => runSimulation(Number(btn.dataset.value), false));
  });

  el.dataset.built = '1';
}

// ── Real-unit translation block (Phase 5, display-only) ────────────────────────
//
// Literature-anchored sentences for income, unemployment and life satisfaction —
// computed by cascade-translate.js from the LEVER percent and the cited studies' own
// dose-response figures, never from the engine's unitless deltas (Q3 decision). Gated
// to ±20%; outside that range no sentence renders for that node. Rendered inline,
// beneath each variable's entry in the ripple list (not a separate block) — see
// renderCascadeResults().

const SIM_TRANSLATE_NODES = ['income', 'unemployment', 'life_satisfaction'];

// Map of nodeId -> translateNode() result (or null), keyed once per render so both the
// per-item inline sentence and the shared header/gate message read the same computation.
function computeSimTranslations() {
  if (!unitTranslations || typeof translateNode !== 'function') return null;
  const baseline = simBaselineValue();
  // Round to 2 decimals: the ?lever= permalink stores whole kroner, and that rounding
  // can push an exact ±20% preset to e.g. 20.0004% — just past the gate, silently
  // dropping every translation for a shared link.
  const leverPct = Math.round(((simLeverValue - baseline) / baseline) * 10000) / 100;
  if (!leverPct) return null;

  const incomeSeries = typeof getTimeSeries === 'function' ? getTimeSeries('income') : [];
  const incomeBaseline = incomeSeries.length ? incomeSeries[incomeSeries.length - 1].value : null;
  if (!incomeBaseline) return null;

  const map = {};
  SIM_TRANSLATE_NODES.forEach(id => {
    map[id] = translateNode(id, leverPct, unitTranslations, incomeBaseline);
  });
  return map;
}

function renderInlineTranslation(id, translations) {
  const t = translations && translations[id];
  if (!t) return '';
  return `<div class="sim-translate-inline">
    <span class="sim-translate-sentence">${t.headline}</span>
    <span class="sim-translate-flag">${unitTranslations.nodes[id].geography_flag}</span>
  </div>`;
}

// Shared "In real terms" header + methodology disclosure, rendered once above the
// ripple list — the per-variable sentences themselves are inlined into each list item.
function renderTranslateHeader(translations) {
  const head = `
    <div class="sim-translate-head">
      <h4>In real terms</h4>
      <span class="sim-translate-badge">Illustration — from cited studies, not the model</span>
    </div>`;

  const anyShown = translations && SIM_TRANSLATE_NODES.some(id => translations[id]);
  const gate = !anyShown ? `<p class="sim-translate-gate">${TRANSLATE_GATE_MESSAGE}</p>` : '';

  return `<div class="sim-translate-header-block">${head}${gate}
    <details class="sim-translate-method">
      <summary>How these numbers are made</summary>
      <p>Computed from the cited studies' own dose-response figures, scaled by the funding
      change in percent — never from the simulator's unitless impact index. Assumptions:
      linear within ±20%, symmetric for cuts, and individual-level estimates scaled to a
      year-group (which ignores general-equilibrium effects). Life satisfaction is in adult
      0–10 Cantril-ladder units, not this dashboard's pupil-wellbeing series (1–5 scale).
      All amounts in kroner: foreign studies contribute percentage effects only, applied to
      Danish baselines. Only shown within ±20% — the underlying studies cover roughly
      10–25% spending variation.</p>
    </details>
  </div>`;
}

// ── Ranked results panel (illustrative impact index) ────────────────────────────

function renderCascadeResults(focus = CASCADE_FOCUS) {
  const el = document.getElementById('cascade-results');
  if (!el) return;

  if (!simLastResult || Math.abs(simLastResult.pushFraction) < 0.001) {
    el.innerHTML = `<p class="findings-note">Move the slider or pick a preset above to see the simulated ripple.</p>`;
    return;
  }

  const leverId = cascadeData?.cascades?.[focus]?.lever;
  const dominantEdge = simLastResult.dominantEdge || {};

  const ranked = Object.entries(simLastResult.deltas)
    .filter(([id, d]) => id !== leverId && Math.abs(d) > 0.02)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  if (!ranked.length) {
    el.innerHTML = `<p class="findings-note">This push is too small to ripple past the historical noise floor.</p>`;
    return;
  }

  // Preserve open/closed state across re-renders (slider drags) instead of resetting to
  // closed on every tick.
  const wasOpen = el.querySelector('details.sim-results-collapse')?.open ?? false;
  const translations = computeSimTranslations();

  el.innerHTML = `
    <details class="sim-results-collapse"${wasOpen ? ' open' : ''}>
      <summary><h3>Simulated ripple (illustrative impact index)</h3></summary>
      ${renderTranslateHeader(translations)}
      <ul class="sim-results-list">
        ${ranked.map(([id, d]) => {
          const pos = CASCADE_LAYOUT[id] || { label: id };
          const e = dominantEdge[id];
          const prov = e ? CASCADE_PROVENANCE[edgeKey(e)] : null;
          const dirLabel = d > 0 ? 'up' : 'down';
          const dirClass = d > 0 ? 'up' : 'down';
          const lagLabel = e ? `Effect appears ~${e.lag_years} year${e.lag_years === 1 ? '' : 's'} later` : '';
          return `<li class="sim-result ${dirClass}">
            <div class="sim-result-head">
              <b>${pos.label.replace(/\n/g, ' ')}</b>
            </div>
            <div class="sim-result-bar-row">
              <span class="sim-result-dir">${dirLabel === 'up' ? '▲' : '▼'} ${Math.abs(d).toFixed(2)}</span>
              ${e?.contested ? '<span class="sim-result-tag">contested</span>' : ''}
              ${e?.draft && !prov ? '<span class="sim-result-tag">draft, no cited magnitude</span>' : ''}
            </div>
            ${lagLabel ? `<div class="sim-result-lag">${lagLabel}</div>` : ''}
            ${prov ? `<div class="sim-result-prov">Cited: ${prov}</div>` : ''}
            ${renderInlineTranslation(id, translations)}
          </li>`;
        }).join('')}
      </ul>
      <p class="findings-note sim-footer-caveat">Modelled effects are illustrative, based on cited causal directions, not calibrated forecasts.</p>
    </details>
  `;
}

// ── GDP reference strip (the alongside-GDP thesis, on screen) ─────────────────
//
// Denmark's real GDP trend, shown as neutral context above the simulator — never
// scored red/green, never fed into the engine. The point: GDP barely moves year to
// year while the cascade below shows what it doesn't see. Reuses getTimeSeries('gdp')
// from dashboard.js (already loaded into wideData) — no separate fetch.

function renderGdpStrip() {
  const el = document.getElementById('gdp-strip');
  if (!el || typeof getTimeSeries !== 'function') return;
  if (el.dataset.built === '1') return; // static content — build once, not on every slider tick

  const series = getTimeSeries('gdp');
  if (series.length < 2) return;

  const latest = series[series.length - 1];
  const prior = series[series.length - 2];
  const yoyPct = ((latest.value - prior.value) / prior.value) * 100;
  const yoyClass = yoyPct >= 0 ? 'yoy-pos' : 'yoy-neg';
  const yoySign = yoyPct >= 0 ? '+' : '';

  el.innerHTML = `
    <div class="gdp-strip-figure">
      <span class="gdp-strip-label">Real GDP, ${latest.year}</span>
      <span class="gdp-strip-value">${latest.value.toLocaleString('da-DK')} bn kr <span class="${yoyClass}">(${yoySign}${yoyPct.toFixed(1)}% YoY)</span></span>
    </div>
    <div id="gdp-strip-chart" class="gdp-strip-spark"></div>
    <p class="gdp-strip-note">GDP barely moves the year funding changes. Growth research finds it's <i>learning outcomes</i>,
      not spending itself, that moves long-run growth — the cascade below traces that exact channel: funding →
      learning → income, the mechanism a single year's GDP number can't show.
      <span class="gdp-strip-cite">Hanushek &amp; Woessmann (2020): cognitive skills, not spending or years of schooling, explain cross-country growth differences.</span>
    </p>
  `;

  const chartEl = document.getElementById('gdp-strip-chart');
  const chart = echarts.getInstanceByDom(chartEl) || echarts.init(chartEl, null, { renderer: 'svg' });
  const c = liveColors();
  chart.setOption({
    backgroundColor: 'transparent',
    grid: { left: 2, right: 2, top: 4, bottom: 2 },
    xAxis: { type: 'value', show: false },
    yAxis: { type: 'value', show: false, scale: true },
    series: [{
      type: 'line', data: series.map(d => [d.year, d.value]), symbol: 'none',
      lineStyle: { color: c.textLow, width: 1.5 },
      areaStyle: { color: 'rgba(139,143,168,0.12)' },
      smooth: true,
    }],
  }, { notMerge: true });

  el.dataset.built = '1';
}

// ── Node data drawer (data transparency: what is this variable, where's it from) ──
//
// Click a cascade node → shows its exact definition, real DK time series (reusing the
// already-loaded wideData/manifest from dashboard.js — no re-fetch), a clickable link to
// the origin table, and a CSV export. Benchmark-only nodes (hale, poverty_rate) have no
// DK time series yet — that gap is shown honestly instead of faked. See docs/simulator_roadmap.md
// Phase 4 ("data transparency layer") for the design rationale.

let nodeDrawerChart = null; // ECharts instance for the drawer's series sparkline, reused across opens

function closeNodeDrawer() {
  const el = document.getElementById('node-drawer');
  if (el) el.classList.add('hidden');
}

async function openNodeDrawer(nodeId) {
  const el = document.getElementById('node-drawer');
  if (!el || !dataDictionary) return;

  const dict = dataDictionary[nodeId];
  const pos = CASCADE_LAYOUT[nodeId];
  if (!dict || !pos) return; // lever node and unmapped ids have no drawer entry

  const title = pos.label.replace(/\n/g, ' ');

  el.innerHTML = `
    <button type="button" class="node-drawer-close" aria-label="Close">×</button>
    <h3>${title}</h3>
    <p class="node-drawer-def">${dict.definition}</p>
    <p class="node-drawer-coverage">${dict.coverage}</p>
    <div id="node-drawer-body"></div>
    <div class="node-drawer-actions">
      ${dict.source_url ? `<a class="node-drawer-source" href="${dict.source_url}" target="_blank" rel="noopener">${dict.source_name} ↗</a>` : `<span class="node-drawer-source" style="color:var(--text-subtle)">${dict.source_name}</span>`}
      ${dict.indicator_id ? `<button type="button" class="node-drawer-csv" id="node-drawer-csv-btn">Download CSV</button>` : ''}
    </div>
  `;
  el.classList.remove('hidden');

  el.querySelector('.node-drawer-close').addEventListener('click', closeNodeDrawer);

  const body = document.getElementById('node-drawer-body');

  if (dict.indicator_id) {
    // Real DK series — reuse getTimeSeries() from dashboard.js, no re-fetch.
    const series = getTimeSeries(dict.indicator_id);
    body.innerHTML = `<div id="node-drawer-chart" class="node-drawer-chart"></div>`;
    const chartEl = document.getElementById('node-drawer-chart');
    nodeDrawerChart = echarts.init(chartEl, null, { renderer: 'svg' });
    const c = liveColors();
    nodeDrawerChart.setOption({
      backgroundColor: 'transparent',
      grid: { left: 40, right: 12, top: 10, bottom: 24 },
      xAxis: { type: 'value', axisLabel: { color: c.textLow, fontSize: 10, formatter: v => Math.round(v) }, axisLine: { lineStyle: { color: c.textLow } }, splitLine: { show: false } },
      yAxis: { type: 'value', axisLabel: { color: c.textLow, fontSize: 10 }, splitLine: { lineStyle: { color: c.textLow, opacity: 0.15 } } },
      series: [{ type: 'line', data: series.map(d => [d.year, d.value]), symbol: 'circle', symbolSize: 5, lineStyle: { color: c.marker, width: 2 }, itemStyle: { color: c.marker } }],
    });

    const csvBtn = document.getElementById('node-drawer-csv-btn');
    if (csvBtn) csvBtn.addEventListener('click', () => downloadNodeCSV(nodeId, dict, series));
  } else {
    // Benchmark-only node — no DK time series. Fetch benchmarks.json lazily, once.
    if (!benchmarksData) {
      benchmarksData = await fetch('data/unified/benchmarks.json').then(r => r.json()).catch(() => ({}));
    }
    const bm = benchmarksData[nodeId];
    body.innerHTML = bm
      ? `<p class="node-drawer-benchmark">Single-point benchmark: <b>${bm.value} ${bm.unit}</b> (${bm.year})</p>`
      : `<p class="node-drawer-benchmark">No benchmark value found.</p>`;
  }
}

function downloadNodeCSV(nodeId, dict, series) {
  const lines = ['year,value'];
  series.forEach(d => lines.push(`${d.year},${d.value}`));
  lines.push(`# Source: ${dict.source_name}, fetched via ${dict.source_url || 'n/a'}`);
  // application/octet-stream forces a real download in every browser;
  // text/csv gets opened inline as a text view in some (the reported bug).
  const blob = new Blob([lines.join('\n')], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nodeId}_dk_series.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNodeDrawer(); });

// ── Findings summary (static "what we found" panel, Phase 3) ──────────────────

function edgeLabel(e) {
  const from = CASCADE_LAYOUT[e.from]?.label.replace(/\n/g, ' ') || e.from;
  const to = CASCADE_LAYOUT[e.to]?.label.replace(/\n/g, ' ') || e.to;
  return `${from} → ${to}`;
}

function computeCascadeFindings(edges) {
  const total = edges.length;
  const resolved = edges.filter(e => !e.draft);
  const byStrength = [...edges].sort((a, b) => (b.strength || 0) - (a.strength || 0));
  const strongest = byStrength.slice(0, 3);
  const weakest = edges.find(e => e.contested) ||
    [...edges].sort((a, b) => (a.strength || 0) - (b.strength || 0))[0];

  return {
    total,
    resolvedCount: resolved.length,
    resolved,
    strongest,
    weakest,
  };
}

function renderCascadeFindings(focus = CASCADE_FOCUS) {
  const el = document.getElementById('cascade-findings');
  if (!el || !cascadeData) return;
  // Fully static — derived only from relationships.json, never from simulation state.
  // Build once; skip on every subsequent renderCascade() call (slider ticks etc.).
  if (el.dataset.built === '1') return;

  const edges = (cascadeData.edges || []).filter(e => e.cascade === focus);
  if (!edges.length) return;

  const f = computeCascadeFindings(edges);
  const draftCount = f.total - f.resolvedCount;

  el.innerHTML = `
    <h3>What we found (v2)</h3>
    <div class="findings-summary">
      <span class="badge badge-green">${f.resolvedCount} hardened ✓</span>
      <span class="badge badge-gray">${draftCount} draft</span>
    </div>
    <ul>
      ${f.strongest.map(e => `<li class="strong"><b>${edgeLabel(e)}</b> — strength ${(e.strength || 0).toFixed(2)}</li>`).join('')}
    </ul>
    ${f.weakest ? `<p class="findings-note">Weakest / most contested link: <b>${edgeLabel(f.weakest)}</b> (strength ${(f.weakest.strength || 0).toFixed(2)}${f.weakest.contested ? ', contested' : ''}).</p>` : ''}
    <p class="findings-note">Newly measured: <b>learning outcomes</b> (grade average) and <b>student wellbeing</b> now come from uddannelsesstatistik.dk — data that sits outside Danmarks Statistik, which is itself the point.</p>
  `;
  el.dataset.built = '1';
}
