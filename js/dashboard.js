/**
 * dashboard.js — loads unified data and renders the Denmark boundary dashboard.
 *
 * Data flow:
 *   data/unified/manifest.json      → indicator catalogue (labels, anchors, direction)
 *   data/unified/denmark_wide.json  → {year: {indicator: rawValue}}
 *
 * data/unified/benchmarks.json (HLEG single-point snapshots) is NOT loaded here —
 * it's fetched lazily by cascade.js's node drawer for benchmark-only cascade nodes.
 */

const DATA_BASE = 'data/unified/';

// Policy target lines for green-accounts indicators (source: Klimaloven 2020, EU CEAP 2020)
const POLICY_TARGETS = {
  climate_footprint_pc: { value: 4.0,   label: '2030 target (Klimaloven)' },
  material_flow_pc:     { value: 13.0,  label: 'EU CEAP target' },
  water_abstraction:    { value: null,  label: null },  // no hard target
  green_gva:            { value: 350000, label: 'Ambition level' },
};

// Section layout — which indicators go in which section and in what order
const SECTIONS = [
  {
    id: 'sustainability',
    title: 'Ecological Boundaries',
    subtitle: 'Is Denmark within sustainable limits? Green = on target, Red = overshot.',
    indicators: ['climate_footprint_pc', 'material_flow_pc', 'water_abstraction', 'green_gva'],
  },
  {
    id: 'society',
    title: 'Societal Foundations',
    subtitle: 'Key social and economic indicators alongside ecological data.',
    indicators: ['life_expectancy', 'unemployment', 'income', 'ghg'],
  },
];

// Format helpers
function fmt(val, decimals = 1) {
  if (val == null) return '—';
  return val.toLocaleString('da-DK', { maximumFractionDigits: decimals });
}

function unitFmt(unit) {
  const fmts = {
    'tonnes CO2-eq/person': v => fmt(v, 1) + ' t',
    'tonnes/person':        v => fmt(v, 1) + ' t',
    '1000 m3':              v => fmt(v / 1000, 0) + ' Mm³',
    'DKK million':          v => fmt(v / 1000, 0) + ' bn kr',
    'percent':              v => fmt(v, 1) + '%',
    'years':                v => fmt(v, 1) + ' yr',
    'DKK':                  v => 'DKK ' + fmt(v / 1000, 0) + 'k',
    '1000 t CO2-eq':        v => fmt(v / 1000, 0) + ' Mt',
  };
  return fmts[unit] || (v => fmt(v, 1));
}

// ── State ─────────────────────────────────────────────────────────────────────

let manifest = {};   // {id: metaEntry}
let wideData = {};   // {year: {indicator: value}}
let charts   = {};   // {indicatorId: echartsInstance}

// ── Fetch data ────────────────────────────────────────────────────────────────

async function loadAll() {
  const [mfRaw, wdRaw] = await Promise.all([
    fetch(DATA_BASE + 'manifest.json').then(r => r.json()),
    fetch(DATA_BASE + 'denmark_wide.json').then(r => r.json()),
  ]);

  // Index manifest by id
  for (const entry of mfRaw) {
    manifest[entry.id] = entry;
  }

  // Store wide data (keys are strings from JSON)
  wideData = wdRaw;
}

// ── Build time series from wide data ─────────────────────────────────────────

function getTimeSeries(indicatorId) {
  const result = [];
  for (const [yr, row] of Object.entries(wideData)) {
    const val = row[indicatorId];
    if (val != null) result.push({ year: parseInt(yr), value: val });
  }
  return result.sort((a, b) => a.year - b.year);
}

function getLatest(indicatorId) {
  const series = getTimeSeries(indicatorId);
  return series.length ? series[series.length - 1] : null;
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function levelLabel(level) {
  return { green: 'On Target', amber: 'Caution', red: 'Overshoot', gray: 'No Data' }[level] || '—';
}

function levelColorClass(level) {
  return { green: 'badge-green', amber: 'badge-amber', red: 'badge-red', gray: 'badge-gray' }[level] || 'badge-gray';
}

// ── Render a single card ──────────────────────────────────────────────────────

function renderCard(containerId, indicatorId) {
  const meta = manifest[indicatorId];
  if (!meta) return;

  const series  = getTimeSeries(indicatorId);
  const latest  = getLatest(indicatorId);
  const value   = latest?.value;
  const latestYear = latest?.year;

  const score   = normScore(value, meta.direction, meta.anchors || {});
  const level   = scoreToLevel(score);
  const fmtFn   = unitFmt(meta.unit);
  const target  = POLICY_TARGETS[indicatorId] || {};

  const container = document.getElementById(containerId);
  if (!container) return;

  // Build card HTML
  container.innerHTML = `
    <div class="card card-${level}" data-indicator="${indicatorId}">
      <div class="card-header">
        <div>
          <div class="card-label">${meta.label}</div>
          <div class="card-year">${latestYear || '—'}</div>
        </div>
        <div>
          <span class="badge ${levelColorClass(level)}">${levelLabel(level)}</span>
          <div class="card-value">${value != null ? fmtFn(value) : '—'}</div>
        </div>
      </div>
      <div class="chart-container" id="chart-${indicatorId}"></div>
      ${target.value != null ? `<div class="target-note">Target: ${fmtFn(target.value)} — ${target.label}</div>` : ''}
      ${meta.direction === 'neutral' ? '<div class="target-note gap-note">⚠ No hard sustainability target — trend-based zones</div>' : ''}
    </div>
  `;

  // Init ECharts
  const chartEl = document.getElementById('chart-' + indicatorId);
  if (!chartEl) return;

  const chart = echarts.init(chartEl, null, { renderer: 'svg' });
  charts[indicatorId] = chart;

  if (value == null || !meta.anchors) {
    const cs = getComputedStyle(document.documentElement);
    chart.setOption({ title: { text: 'No data', textStyle: { color: cs.getPropertyValue('--text-subtle').trim() || '#94a3b8', fontSize: 13 }, top: 'center', left: 'center' }, backgroundColor: 'transparent' });
    return;
  }

  const option = buildBulletOption({
    label:       meta.label,
    value:       value,
    unit:        meta.unit,
    direction:   meta.direction,
    anchors:     meta.anchors,
    series:      series,
    targetValue: target.value || null,
    targetLabel: target.label || null,
    fmt:         fmtFn,
  });

  chart.setOption(option);
}

// ── Build sections ────────────────────────────────────────────────────────────

function buildSections() {
  const root = document.getElementById('sections');
  if (!root) return;

  for (const section of SECTIONS) {
    // Filter to only indicators present in manifest
    const available = section.indicators.filter(id => manifest[id]);
    if (!available.length) continue;

    const sectionEl = document.createElement('section');
    sectionEl.className = 'section';
    sectionEl.innerHTML = `
      <h2 class="section-title">${section.title}</h2>
      <p class="section-sub">${section.subtitle}</p>
      <div class="grid" id="grid-${section.id}"></div>
    `;
    root.appendChild(sectionEl);

    const grid = sectionEl.querySelector('.grid');
    for (const id of available) {
      const wrap = document.createElement('div');
      wrap.id = 'wrap-' + id;
      grid.appendChild(wrap);
      renderCard('wrap-' + id, id);
    }
  }
}

// ── Summary bar ──────────────────────────────────────────────────────────────

function buildSummary() {
  const sustainIds = SECTIONS.find(s => s.id === 'sustainability')?.indicators || [];
  const counts = { green: 0, amber: 0, red: 0, gray: 0 };

  for (const id of sustainIds) {
    const meta  = manifest[id];
    const latest = getLatest(id);
    if (!meta || !latest || !meta.anchors) { counts.gray++; continue; }
    const score = normScore(latest.value, meta.direction, meta.anchors);
    counts[scoreToLevel(score)]++;
  }

  const el = document.getElementById('summary');
  if (!el) return;
  el.innerHTML = `
    <span class="sum-label">Ecological boundaries:</span>
    <span class="sum-item sum-green">${counts.green} On Target</span>
    <span class="sum-item sum-amber">${counts.amber} Caution</span>
    <span class="sum-item sum-red">${counts.red} Overshoot</span>
    ${counts.gray ? `<span class="sum-item sum-gray">${counts.gray} No Data</span>` : ''}
  `;
}

// ── Resize handler ────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  for (const chart of Object.values(charts)) chart.resize();
});

// Init is driven by index.html to coordinate with loading overlay and scenarios.
