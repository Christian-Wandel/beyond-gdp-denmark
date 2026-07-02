/**
 * scenarios.js — Scenario comparator panel for the Denmark boundary dashboard.
 *
 * Data: data/scenarios.json (written by compute_scenarios.py)
 * Renders: scenario selector + grouped bar chart (sector baseline vs counterfactual)
 *          + delta summary row + swap detail list.
 */

const SCENARIO_DATA_PATH = 'data/scenarios.json';

// Sector display labels (friendlier than the snake_case keys)
const SECTOR_LABELS = {
  households:    'Households',
  transport:     'Commercial transport',
  manufacturing: 'Manufacturing',
  agriculture:   'Agriculture',
  construction:  'Construction',
  energy_supply: 'Energy supply',
  public:        'Public sector',
  all_industry:  'All industry (aggregate)',
  total:         'Grand total',
};

// Sectors to show in chart (exclude aggregates that double-count)
const CHART_SECTORS = [
  'households', 'transport', 'manufacturing', 'agriculture',
  'construction', 'energy_supply', 'public',
];

// Live colour palette — reads CSS vars so dark/light theme works
function scColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n, fb) => cs.getPropertyValue(n).trim() || fb;
  return {
    baseline:       v('--accent',  '#4f7fff'),
    counterfactual: v('--green',   '#22c55e'),
    delta_neg:      v('--green',   '#22c55e'),
    delta_pos:      v('--red',     '#ef4444'),
    axis:           v('--border-strong', '#3a4170'),
    label:          v('--chart-text-low', '#8b8fa8'),
    surface:        v('--surface-2', '#1d2237'),
  };
}
// Alias kept for any inline references
const SC = scColors();

// ── State ─────────────────────────────────────────────────────────────────────

let scenarioData = null;    // full scenarios.json object
let scenarioChart = null;   // ECharts instance

// ── Init ──────────────────────────────────────────────────────────────────────

async function initScenarios() {
  try {
    scenarioData = await fetch(SCENARIO_DATA_PATH).then(r => r.json());
  } catch (e) {
    const el = document.getElementById('scenario-panel');
    if (el) el.innerHTML = `<p style="color:#ef4444;padding:1rem">Could not load scenarios.json — run compute_scenarios.py first.</p>`;
    return;
  }
  buildScenarioSelector();
  const firstId = Object.keys(scenarioData)[0];
  renderScenario(firstId);
}

// ── Selector ──────────────────────────────────────────────────────────────────

function buildScenarioSelector() {
  const sel = document.getElementById('scenario-select');
  if (!sel) return;
  for (const [id, sc] of Object.entries(scenarioData)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = sc.label;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', e => renderScenario(e.target.value));
}

// ── Main render ───────────────────────────────────────────────────────────────

function renderScenario(scenarioId) {
  const sc = scenarioData[scenarioId];
  if (!sc) return;
  // Refresh palette so renders reflect current theme
  Object.assign(SC, scColors());
  renderDeltaSummary(sc);
  renderSwapList(sc);
  renderSectorChart(sc);
  renderDataNote(sc);
}

// ── Delta summary ─────────────────────────────────────────────────────────────

function renderDeltaSummary(sc) {
  const el = document.getElementById('scenario-delta');
  if (!el) return;

  const avoided    = Math.abs(sc.delta_tco2e);
  const pct        = Math.abs(sc.delta_pct);
  const direction  = sc.delta_tco2e < 0 ? 'avoided' : 'added';
  const color      = sc.delta_tco2e < 0 ? SC.delta_neg : SC.delta_pos;
  const baselineMt = (sc.baseline_tco2e / 1e6).toFixed(1);
  const cfMt       = (sc.counterfactual_tco2e / 1e6).toFixed(1);
  const avoidedMt  = (avoided / 1e6).toFixed(2);

  el.innerHTML = `
    <div class="sc-delta-row">
      <div class="sc-delta-block">
        <div class="sc-delta-label">Baseline emissions</div>
        <div class="sc-delta-value">${baselineMt} Mt CO₂e</div>
        <div class="sc-delta-sub">Current provisioning mix, ${sc.year}</div>
      </div>
      <div class="sc-delta-arrow">→</div>
      <div class="sc-delta-block">
        <div class="sc-delta-label">After scenario</div>
        <div class="sc-delta-value">${cfMt} Mt CO₂e</div>
        <div class="sc-delta-sub">Counterfactual mix, ${sc.year}</div>
      </div>
      <div class="sc-delta-result" style="border-color:${color}">
        <div class="sc-delta-label">GHG ${direction}</div>
        <div class="sc-delta-value" style="color:${color}">${sc.delta_tco2e < 0 ? '−' : '+'}${avoidedMt} Mt</div>
        <div class="sc-delta-sub">${pct.toFixed(1)}% of baseline</div>
      </div>
    </div>
    <p class="sc-description">${sc.description}</p>
  `;
}

// ── Swap detail list ──────────────────────────────────────────────────────────

function renderSwapList(sc) {
  const el = document.getElementById('scenario-swaps');
  if (!el) return;

  const swaps = [];
  for (const [sectorId, sdata] of Object.entries(sc.by_sector)) {
    for (const swap of (sdata.swaps || [])) {
      if (swap.delta_tco2e !== 0) {
        swaps.push({ sector: SECTOR_LABELS[sectorId] || sectorId, ...swap });
      }
    }
  }

  if (!swaps.length) {
    el.innerHTML = '<p style="color:#94a3b8;font-size:12px">No swaps with non-zero impact.</p>';
    return;
  }

  const rows = swaps.map(s => {
    const avoided = s.delta_tco2e < 0;
    const color   = avoided ? SC.delta_neg : SC.delta_pos;
    const sign    = avoided ? '−' : '+';
    const ktCO2e  = (Math.abs(s.delta_tco2e) / 1000).toFixed(0);
    const pctFuel = (s.fraction * 100).toFixed(0);
    return `
      <div class="swap-row">
        <span class="swap-sector">${s.sector}</span>
        <span class="swap-fuel">${s.from} → ${s.to}</span>
        <span class="swap-frac">${pctFuel}% replaced</span>
        <span class="swap-delta" style="color:${color}">${sign}${ktCO2e} kt CO₂e</span>
      </div>
    `;
  }).join('');

  el.innerHTML = `<div class="swap-table">${rows}</div>`;
}

// ── Sector bar chart ──────────────────────────────────────────────────────────

function renderSectorChart(sc) {
  const el = document.getElementById('scenario-chart');
  if (!el) return;

  if (!scenarioChart) {
    scenarioChart = echarts.init(el, null, { renderer: 'svg' });
    window.addEventListener('resize', () => scenarioChart && scenarioChart.resize());
  }

  const sectors    = CHART_SECTORS.filter(s => sc.by_sector[s]);
  const labels     = sectors.map(s => SECTOR_LABELS[s] || s);
  const baselines  = sectors.map(s => +(sc.by_sector[s].baseline_tco2e / 1000).toFixed(0));
  const cfs        = sectors.map(s => +(sc.by_sector[s].counterfactual_tco2e / 1000).toFixed(0));

  // Max value for axis range
  const maxVal = Math.max(...baselines, ...cfs);

  const option = {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 500,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9', fontSize: 12 },
      formatter(params) {
        const sector = params[0].axisValue;
        let html = `<div style="font-weight:600;margin-bottom:4px">${sector}</div>`;
        for (const p of params) {
          const val = p.value.toLocaleString('da-DK');
          html += `<div><span style="display:inline-block;width:10px;height:10px;background:${p.color};margin-right:6px;border-radius:2px"></span>${p.seriesName}: <b>${val} kt CO₂e</b></div>`;
        }
        const bIdx = params.findIndex(p => p.seriesName === 'Baseline');
        const cIdx = params.findIndex(p => p.seriesName === 'Scenario');
        if (bIdx >= 0 && cIdx >= 0) {
          const delta = params[cIdx].value - params[bIdx].value;
          const sign  = delta < 0 ? '−' : '+';
          const color = delta < 0 ? SC.delta_neg : SC.delta_pos;
          html += `<div style="margin-top:4px;color:${color}">${sign}${Math.abs(delta).toLocaleString('da-DK')} kt CO₂e avoided</div>`;
        }
        return html;
      },
    },
    legend: {
      data: ['Baseline', 'Scenario'],
      top: 0,
      right: 0,
      textStyle: { color: SC.label, fontSize: 14 },
      itemWidth: 12,
      itemHeight: 12,
    },
    grid: { left: 130, right: 100, top: 36, bottom: 8, containLabel: false },
    xAxis: {
      type: 'value',
      max: Math.ceil(maxVal * 1.05),
      axisLine: { lineStyle: { color: SC.axis } },
      splitLine: { lineStyle: { color: '#1e293b88' } },
      axisLabel: {
        color: SC.label,
        fontSize: 12,
        formatter: v => v >= 1000 ? (v / 1000).toFixed(1) + ' Mt' : v + ' kt',
      },
    },
    yAxis: {
      type: 'category',
      data: labels,
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#cbd5e1', fontSize: 13, width: 120, overflow: 'truncate' },
    },
    series: [
      {
        name: 'Baseline',
        type: 'bar',
        data: baselines,
        barWidth: 10,
        itemStyle: { color: SC.baseline, borderRadius: [0, 2, 2, 0] },
        label: { show: false },
      },
      {
        name: 'Scenario',
        type: 'bar',
        data: cfs,
        barWidth: 10,
        itemStyle: {
          color: (params) => {
            const delta = cfs[params.dataIndex] - baselines[params.dataIndex];
            return delta < 0 ? SC.counterfactual : SC.delta_pos;
          },
          borderRadius: [0, 2, 2, 0],
        },
        label: {
          show: true,
          position: 'right',
          formatter(params) {
            const delta = params.value - baselines[params.dataIndex];
            if (delta === 0) return '';
            const sign  = delta < 0 ? '−' : '+';
            const color = delta < 0 ? SC.delta_neg : SC.delta_pos;
            return `{delta|${sign}${Math.abs(delta).toLocaleString('da-DK')} kt}`;
          },
          rich: {
            delta: { fontSize: 12, color: SC.label },
          },
        },
      },
    ],
  };

  scenarioChart.setOption(option, { notMerge: true });
}

// ── Data note ─────────────────────────────────────────────────────────────────

function renderDataNote(sc) {
  const el = document.getElementById('scenario-note');
  if (!el) return;
  el.textContent = `Baseline: DST ENE3H gross energy consumption × DEA 2024 emission coefficients (combustion-basis). Biomass CO₂ excluded per Danish national inventory convention. Electricity allocated at Energinet ${sc.year} grid emission factor. Note: DST classifies private car fuel under 'Households', not the 'Commercial transport' sector.`;
}
