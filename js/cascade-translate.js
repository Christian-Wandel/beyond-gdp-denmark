/**
 * cascade-translate.js — pure, dependency-free "human-legible statement" layer for the
 * folkeskole cascade simulator (roadmap Phase 5). No DOM, no fetch, no globals: takes
 * the lever change in percent plus the config from data/unit_translations.json and
 * returns literature-anchored real-unit sentences for three nodes (income,
 * unemployment, life_satisfaction).
 *
 * Honesty invariants (see docs/coefficient_methodology.md Q3 decision):
 *   - NEVER reads the engine's propagated deltas. The engine's impact index stays
 *     unitless; these statements are computed from the cited studies' own dose-response
 *     figures, scaled by the lever percent (which IS in real units: kr per pupil).
 *   - Gated to |lever| <= gate_abs_pct (20%): the cited studies cover roughly 10-25%
 *     spending variation, so the +/-100% bookends get no translation.
 *   - Linear scaling within the gate and symmetric for cuts — both stated as
 *     assumptions in the caveats, not hidden.
 *   - All money in DKK. Foreign studies contribute percentage effects only, applied to
 *     Danish kr baselines.
 */

const TRANSLATE_GATE_MESSAGE =
  'Real-unit illustration only shown within ±20% — the cited studies don’t support extrapolating further.';

// Danish money convention: 20.100 kr (dot thousands separator).
function formatKr(v) {
  const rounded = Math.round(v / 100) * 100;
  return rounded.toLocaleString('da-DK');
}

function formatPeopleRange(low, high) {
  const r = v => Math.round(v / 50) * 50;
  return `${r(low).toLocaleString('da-DK')}–${r(high).toLocaleString('da-DK')}`;
}

// People moved into/out of work per year-group: Hyman completion pp x DK employment
// gap x cohort size. Shared by the unemployment and life_satisfaction statements.
function employmentFigures(cfg, baselines, scale) {
  const gapFrac = cfg.employment_gap_pp / 100;
  const ppLow = cfg.per_10pct_completion_pp.low * scale;
  const ppHigh = cfg.per_10pct_completion_pp.high * scale;
  return {
    employmentPpLow: ppLow * gapFrac,
    employmentPpHigh: ppHigh * gapFrac,
    peopleLow: (ppLow * gapFrac / 100) * baselines.cohort_pupils,
    peopleHigh: (ppHigh * gapFrac / 100) * baselines.cohort_pupils,
  };
}

/**
 * Translate one node's outcome into a literature-anchored real-unit sentence.
 * @param {string} nodeId - 'income' | 'unemployment' | 'life_satisfaction'
 * @param {number} leverPct - lever change in percent from today's baseline (e.g. +10)
 * @param {object} config - parsed data/unit_translations.json
 * @param {number} incomeBaseline - latest avg disposable income in kr (DST INDKP101)
 * @returns {{headline: string, detail: string, caveats: string[], figures: object}|null}
 *          null when the node has no translation, lever is 0, or |lever| exceeds the gate
 */
function translateNode(nodeId, leverPct, config, incomeBaseline) {
  const cfg = config && config.nodes && config.nodes[nodeId];
  if (!cfg || !leverPct) return null;
  if (Math.abs(leverPct) > cfg.gate_abs_pct) return null;

  const baselines = config.baselines;
  const scale = Math.abs(leverPct) / 10; // config figures are per +10% lever
  const up = leverPct > 0;
  const cohort = baselines.cohort_pupils.toLocaleString('da-DK');
  const caveats = [cfg.geography_flag,
    'Linear scaling within ±20% and symmetric for cuts — assumptions, not findings.'];

  if (nodeId === 'income') {
    const effect = cfg.per_10pct_wage_effect.central * scale;
    const krYear = effect * incomeBaseline;
    const krMonth = krYear / 12;
    return {
      headline: up
        ? `More money for schools now means better-paid adults later. Each child would earn `
          + `around ${formatKr(krYear)} kr more per year — but the payoff first shows in `
          + `${cfg.lag_display}.`
        : `Less money for schools now means lower-paid adults later. Each child would earn `
          + `around ${formatKr(krYear)} kr less per year — and the loss first shows in `
          + `${cfg.lag_display}.`,
      detail: cfg.chain.join(' '),
      caveats,
      figures: { wageEffect: effect, krPerYear: krYear, krPerMonth: krMonth },
    };
  }

  if (nodeId === 'unemployment') {
    const f = employmentFigures(cfg, baselines, scale);
    return {
      headline: `Out of one year's ${cohort} school children, about `
        + `${formatPeopleRange(f.peopleLow, f.peopleHigh)} ${up ? 'more' : 'fewer'} of them `
        + `will have a job when they grow up.`,
      detail: cfg.chain.join(' '),
      caveats,
      figures: { employmentPpLow: f.employmentPpLow, employmentPpHigh: f.employmentPpHigh,
                 peopleLow: f.peopleLow, peopleHigh: f.peopleHigh },
    };
  }

  if (nodeId === 'life_satisfaction') {
    // Employment channel reuses the unemployment chain's people range.
    const unemCfg = config.nodes.unemployment;
    const f = unemCfg ? employmentFigures(unemCfg, baselines, scale) : null;
    const perPerson = cfg.employment_channel_points;
    const cohortAvg = cfg.income_channel_points_per_10pct * scale;
    const surveyPart = `People with a job are happier. Big OECD surveys ask people to rate `
      + `their life from 0 to 10 — those in work say ${cfg.ladder_in_work}, those out of `
      + `work say ${cfg.ladder_out_of_work}. `;
    const peoplePart = f
      ? (up
        ? `So the ${formatPeopleRange(f.peopleLow, f.peopleHigh)} extra people in work get `
          + `a real lift, and the whole year-group gets a small lift from the extra pay.`
        : `So the ${formatPeopleRange(f.peopleLow, f.peopleHigh)} people pushed out of work `
          + `lose that lift, and the whole year-group slips a little from the lost pay.`)
      : (up
        ? `The whole year-group gets a small lift from the extra pay.`
        : `The whole year-group slips a little from the lost pay.`);
    return {
      headline: surveyPart + peoplePart,
      detail: cfg.chain.join(' '),
      caveats: caveats.concat(cfg.units_caveat ? [cfg.units_caveat] : []),
      figures: { perPersonPoints: perPerson, cohortAvgPoints: cohortAvg,
                 peopleLow: f ? f.peopleLow : null, peopleHigh: f ? f.peopleHigh : null },
    };
  }

  return null;
}

if (typeof module !== 'undefined') {
  module.exports = { translateNode, TRANSLATE_GATE_MESSAGE };
}
