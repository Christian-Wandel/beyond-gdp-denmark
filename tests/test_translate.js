/**
 * Invariant tests for js/cascade-translate.js (the Phase 5 literature-anchored
 * unit-translation layer). Plain Node, zero deps:  node tests/test_translate.js
 */
const fs = require('fs');
const path = require('path');

const { translateNode, TRANSLATE_GATE_MESSAGE } = require('../js/cascade-translate.js');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'unit_translations.json'), 'utf8'));

const INCOME_BASELINE = 287682; // DST INDKP101, 2024
const NODES = ['income', 'unemployment', 'life_satisfaction'];

let failures = 0;
function check(name, cond, detail) {
  if (cond) { console.log(`PASS  ${name}`); }
  else { failures++; console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}
const t = (id, pct) => translateNode(id, pct, config, INCOME_BASELINE);

// --- Gate: null outside +/-20%, null at 0, non-null inside ---
NODES.forEach(id => {
  check(`gate: ${id} at +100% -> null`, t(id, 100) === null);
  check(`gate: ${id} at -100% -> null`, t(id, -100) === null);
  check(`gate: ${id} at 0% -> null`, t(id, 0) === null);
  [10, -10, 20, -20].forEach(p => {
    check(`gate: ${id} at ${p}% -> statement`, t(id, p) !== null);
  });
});
check('gate message defined', typeof TRANSLATE_GATE_MESSAGE === 'string' && TRANSLATE_GATE_MESSAGE.includes('±20%'));

// --- Hand-check: +10% income = 7% x 287,682 kr ~ 20,138 kr/yr, ~1,700 kr/month ---
{
  const r = t('income', 10);
  const expected = 0.07 * INCOME_BASELINE;
  check('income +10%: krPerYear ~ 20,138', Math.abs(r.figures.krPerYear - expected) < 1,
    `got ${r.figures.krPerYear}`);
  check('income +10%: headline shows 20.100 kr (da-DK rounding)', r.headline.includes('20.100 kr'), r.headline);
  check('income +10%: krPerMonth figure ~ 1,678', Math.abs(r.figures.krPerMonth - expected / 12) < 1,
    `got ${r.figures.krPerMonth}`);
  check('income +10%: DKK only, no foreign currency', !/[$£€]|USD|GBP|EUR/.test(r.headline + r.detail));
}

// --- Hand-check: +10% unemployment = 3-5pp x 20pp gap x 51,000 = 306-510 people ---
{
  const r = t('unemployment', 10);
  check('unemployment +10%: peopleLow ~ 306', Math.abs(r.figures.peopleLow - 306) < 1, `got ${r.figures.peopleLow}`);
  check('unemployment +10%: peopleHigh ~ 510', Math.abs(r.figures.peopleHigh - 510) < 1, `got ${r.figures.peopleHigh}`);
  check('unemployment +10%: headline shows 300–500', r.headline.includes('300–500'), r.headline);
}

// --- Hand-check: life satisfaction +10% = 0.4 pts/person, 0.04 pts cohort-wide ---
{
  const r = t('life_satisfaction', 10);
  check('life_sat +10%: 0.4 pts per person', r.figures.perPersonPoints === 0.4);
  check('life_sat +10%: 0.04 pts cohort avg', Math.abs(r.figures.cohortAvgPoints - 0.04) < 1e-9);
  check('life_sat +10%: Cantril-ladder units caveat present',
    r.caveats.some(c => /Cantril|0-10/.test(c)), JSON.stringify(r.caveats));
}

// --- Linearity: +20% figures = 2 x +10% figures (unrounded) ---
{
  const r10 = t('income', 10), r20 = t('income', 20);
  check('linearity: income krPerYear doubles', Math.abs(r20.figures.krPerYear - 2 * r10.figures.krPerYear) < 1e-6);
  const u10 = t('unemployment', 10), u20 = t('unemployment', 20);
  check('linearity: unemployment people double', Math.abs(u20.figures.peopleHigh - 2 * u10.figures.peopleHigh) < 1e-6);
  const l10 = t('life_satisfaction', 10), l20 = t('life_satisfaction', 20);
  check('linearity: life_sat cohort avg doubles', Math.abs(l20.figures.cohortAvgPoints - 2 * l10.figures.cohortAvgPoints) < 1e-9);
}

// --- Sign: -10% flips wording, keeps magnitudes ---
{
  const pos = t('income', 10), neg = t('income', -10);
  check('sign: income -10% says "lower" and "less"', /lower/.test(neg.headline) && /less/.test(neg.headline), neg.headline);
  check('sign: income magnitudes equal', Math.abs(pos.figures.krPerYear - neg.figures.krPerYear) < 1e-6);
  const negU = t('unemployment', -10);
  check('sign: unemployment -10% says "fewer"', /fewer/.test(negU.headline), negU.headline);
  const negL = t('life_satisfaction', -10);
  check('sign: life_sat -10% says "pushed out of work"', /pushed out of work/.test(negL.headline), negL.headline);
}

// --- Every statement carries the linearity/symmetry assumption caveat ---
NODES.forEach(id => {
  const r = t(id, 10);
  check(`caveats: ${id} states linearity+symmetry assumption`,
    r.caveats.some(c => /Linear scaling/.test(c)));
});

console.log(failures === 0 ? '\nAll translation tests passed.' : `\n${failures} test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
