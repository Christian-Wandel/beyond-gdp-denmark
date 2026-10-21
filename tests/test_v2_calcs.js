// Invariants on data/v2/*.json (built by prepare_v2.py). Run: node tests/test_v2_calcs.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const dir = path.join(__dirname, '..', 'data', 'v2');
const load = n => JSON.parse(fs.readFileSync(path.join(dir, `${n}.json`), 'utf8'));
const src = n => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', `${n}.json`), 'utf8')).data.DNK;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const sum = o => Object.values(o).reduce((s, v) => s + v, 0);

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };

const eco = load('eco');
const edu = load('edu');
const soc = load('soc');
const ind = load('indicators');
const mro = src('dst_v2_mro2').breakdown.by_item_gas;

test('hero matches MRO2 source', () => {
  close(eco.hero.base, mro.TOTLULU.GHGEXBIO['1990'] / 1000, 1e-3, 'base 1990');
  close(eco.hero.latest, mro.TOTLULU.GHGEXBIO['2024'] / 1000, 1e-3, 'latest');
  close(eco.hero.target, eco.hero.base * 0.3, 1e-2, 'target = 30 % of 1990');
  close(eco.hero.gap_mt, eco.hero.latest - eco.hero.target, 1e-2, 'gap');
});

test('hero sanity: 1990 is 70-85 Mt, 2024 reduction is at least 45 %', () => {
  assert.ok(eco.hero.base > 70 && eco.hero.base < 85);
  assert.ok(eco.hero.reduction_pct >= 45);
});

test('bridge closes: national accounts - abroad - other = territorial', () => {
  for (const y of Object.keys(eco.bridge).filter(k => /^\d{4}$/.test(k))) {
    const b = eco.bridge[y];
    close(b.national_accounts + b.abroad_bunkers + b.other_transport_diff, b.territorial, 0.01, `bridge ${y}`);
    close(b.territorial + b.lulucf, b.territorial_incl_lulucf, 0.01, `lulucf ${y}`);
  }
});

test('gases sum to territorial total', () => {
  close(sum(eco.gases.latest), mro.DKTOTAL.GHGEXBIO['2024'] / 1000, 0.01, 'gas sum');
});

test('sector waterfall closes on end value', () => {
  const w = eco.sectors.waterfall_1990_2024;
  close(w.start + sum(w.steps), w.end, 0.01, 'waterfall');
  assert.ok(Math.abs(w.steps.other_residual || 0) < 0.5, 'residual small');
});

test('LMDI terms sum to total change', () => {
  for (const [k, v] of Object.entries(eco.kaya)) {
    if (!v.terms) continue;
    close(sum(v.terms), v.co2_end - v.co2_start, 0.01, `kaya ${k}`);
  }
  const f = edu.funding_split;
  close(sum(f.terms), f.per_pupil_end - f.per_pupil_start, 1, 'funding split');
});

test('pace: required path ends on target, rates consistent', () => {
  for (const p of [eco.pace, edu.pace]) {
    close(p.required_path[String(p.target_year)], p.target, 0.01, 'path end');
    const yrs = p.target_year - p.latest_year;
    close(p.latest * (1 + p.required_rate) ** yrs, p.target, 0.01, 'required rate');
    close(p.required_pct, 100 * p.required_rate, 0.01, 'pct');
  }
  assert.ok(eco.pace.years_as_fast <= eco.pace.years_total);
  assert.strictEqual(eco.pace.histogram.reduce((s, b) => s + b.count, 0), eco.pace.years_total);
});

test('renewable share in 0-100 and rising since 1990', () => {
  const r = eco.renewable_share;
  Object.values(r).forEach(v => assert.ok(v >= 0 && v <= 100));
  assert.ok(r['2024'] > r['1990']);
});

test('levers ranked descending, all positive', () => {
  const m = eco.levers.items.map(l => l.mt);
  m.forEach((v, i) => { assert.ok(v > 0); if (i) assert.ok(m[i - 1] >= v); });
});

test('attainment shares sum to 100', () => {
  Object.values(edu.attainment.series).forEach(s => close(sum(s), 100, 0.01, 'attainment'));
});

test('NEET4 reproduces the existing NEET1 series', () => {
  const old = src('dst_neet').series;
  for (const y of Object.keys(old)) close(edu.hero.series[y], old[y], 0.02, `neet ${y}`);
});

test('gini histogram counts every municipality', () => {
  const g = soc.gini_municipal;
  assert.strictEqual(g.histogram.reduce((s, b) => s + b.count, 0), g.n);
});

test('indicator scores and levels follow 33/67 bands', () => {
  for (const i of ind.indicators) {
    if (i.score == null) continue;
    const lvl = i.score >= 67 ? 'green' : i.score >= 33 ? 'amber' : 'red';
    assert.strictEqual(i.level, lvl, i.id);
  }
});

console.log(`\n${n} tests passed`);
