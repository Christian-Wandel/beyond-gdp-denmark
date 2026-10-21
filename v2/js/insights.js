/* Rule-generated verdict sentences. Every number comes from the data passed in. */
window.V2 = window.V2 || {};

(function (V2) {
  const f = V2.fmt;
  const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const times = x => x >= 1.95 ? `${f(x, 1)}× faster` : x >= 1.1 ? `${f(x, 1)}× faster` : 'at about today\'s pace';

  V2.insights = {
    heroStatus(h, pc) {
      const projCut = 100 * (1 - pc.projected_at_target_year / h.base);
      if (pc.projected_at_target_year <= h.target) return ['green', 'On track for 2030'];
      if (projCut >= h.target_reduction_pct - 5) return ['amber', 'Close, but behind'];
      return ['red', 'Off track for 2030'];
    },

    hero(h, pc) {
      const projCut = 100 * (1 - pc.projected_at_target_year / h.base);
      return `Denmark has cut ${f(h.reduction_pct, 0)} % since 1990. At the pace of the last ${pc.latest_year - pc.trend_from} years ` +
        `it reaches about ${f(projCut, 0)} % by ${pc.target_year}, not ${f(h.target_reduction_pct, 0)} %. ` +
        `That leaves about ${f(pc.projected_at_target_year - h.target, 1)} Mt still to find.`;
    },

    paceTitle(pc) {
      return `Emissions must fall ${times(pc.acceleration)} than over the last ${pc.latest_year - pc.trend_from} years`;
    },
    pace(pc, unit) {
      return `Needed: ${V2.signed(pc.required_pct)} % per year from ${pc.latest_year} to ${pc.target_year}. ` +
        `Achieved: ${V2.signed(pc.actual_pct)} % per year since ${pc.trend_from}.`;
    },

    histTitle(pc) {
      return `Only ${pc.years_as_fast} of the last ${pc.years_total} years fell as fast as needed`;
    },
    hist(pc) {
      const share = pc.years_as_fast / pc.years_total;
      const tone = share < 0.25 ? 'red' : share < 0.5 ? 'amber' : 'green';
      return [tone, `The required pace must now hold every year to ${pc.target_year}. ` +
        `Denmark has managed it in ${f(100 * share, 0)} % of years since 1990.`];
    },

    gasTitle(g) {
      const tot = Object.values(g).reduce((s, v) => s + v, 0);
      const nonCo2 = tot - g.CO2UBIO;
      return `${f(100 * nonCo2 / tot, 0)} % of emissions are not CO2, mostly methane and nitrous oxide from farming`;
    },

    sectorTitle(wf, labels) {
      const steps = Object.entries(wf.steps).filter(([k]) => k !== 'other_residual');
      const [bestK, bestV] = steps.reduce((a, b) => (b[1] < a[1] ? b : a));
      const total = wf.start - wf.end;
      return `${labels[bestK]} delivered ${f(100 * -bestV / total, 0)} % of the cut since 1990`;
    },
    sector(series, labels, year) {
      const home = Object.entries(series).filter(([k]) => k !== 'ships_planes_abroad');
      const [k, s] = home.reduce((a, b) => (b[1][year] > a[1][year] ? b : a));
      return `${labels[k]} is now the largest source on Danish soil: ${f(s[year], 1)} Mt in ${year}.`;
    },

    bridgeTitle(b) {
      return `Danish ships and planes abroad emit ${f(-b.abroad_bunkers, 0)} Mt, outside the Klimaloven count`;
    },

    kayaTitle(k) {
      const t = k.terms;
      const verb = k.co2_end < k.co2_start ? 'fell' : 'rose';
      const won = -(t.energy_intensity + t.carbon_intensity) > t.gdp;
      return `CO2 from burning fuel ${verb} from ${f(k.co2_start, 1)} to ${f(k.co2_end, 1)} Mt: ` +
        (won ? 'efficiency and cleaner energy outweighed growth' : 'growth outweighed efficiency and cleaner energy');
    },
    kaya(k, gdpGrowth) {
      const t = k.terms;
      return `How to read it: the economy grew ${f(gdpGrowth, 0)} %, and on its own that would have added ${f(t.gdp, 1)} Mt. ` +
        `Using less energy per krone removed ${f(-t.energy_intensity, 1)} Mt, and getting energy from cleaner sources removed ${f(-t.carbon_intensity, 1)} Mt.`;
    },

    leverTitle(lv) {
      const top = lv.items[0];
      return `The largest modelled lever closes ${f(100 * top.mt / lv.gap_mt, 0)} % of the ${f(lv.gap_mt, 1)} Mt gap`;
    },

    // Own-record view: compares a series with itself since `from`, no anchors.
    record(i, from = 2008) {
      const ys = Object.keys(i.series).map(Number).filter(y => y >= from).sort((a, b) => a - b);
      const v = y => i.series[y];
      const lower = i.direction === 'lower_better';
      const better = (a, b) => lower ? v(a) < v(b) : v(a) > v(b);
      const last = ys[ys.length - 1], first = ys[0];
      const bestY = ys.reduce((a, b) => (better(b, a) ? b : a)), worstY = ys.reduce((a, b) => (better(a, b) ? b : a));
      const tenY = ys.includes(last - 10) ? last - 10 : first;
      const span = v(bestY) - v(worstY);
      const pos = y => span ? 100 * (v(y) - v(worstY)) / span : 50;  // 0 = worst, 100 = best
      return { ys, first, last, latest: v(last), bestY, best: v(bestY), worstY, worst: v(worstY),
        tenY, ten: v(tenY), pos, improved: better(last, tenY), lower };
    },
    recordVerdict(i, from) {
      const h = this.record(i, from);
      if (h.last === h.bestY) return ['green', `<b>Best since ${h.first}</b>`];
      if (h.last === h.worstY) return ['red', `<b>Worst since ${h.first}</b>`];
      return h.improved ? ['green', `<b>Better than in ${h.tenY}</b>`] : ['red', `<b>Worse than in ${h.tenY}</b>`];
    },
    recordSays(i, name, fv, from) {
      const h = this.record(i, from);
      const now = `${name} is ${fv(h.latest)} in ${h.last}, ${h.improved ? 'better' : 'worse'} than ${fv(h.ten)} in ${h.tenY}.`;
      const rec = h.last === h.bestY ? ` That is the best value since ${h.first}.`
        : h.last === h.worstY ? ` That is the worst value since ${h.first}.`
        : ` The best year since ${h.first} was ${h.bestY} (${fv(h.best)}), the worst ${h.worstY} (${fv(h.worst)}).`;
      return now + rec;
    },

    kpiVerdict(i) {
      const dir = i.momentum == null ? '' : i.momentum > 2 ? 'improving' : i.momentum < -2 ? 'worsening' : 'flat';
      const lvl = { red: 'Off target', amber: 'Mid-range', green: 'On target', gray: 'No target' }[i.level];
      return `<b>${lvl}</b>${dir ? `, ${dir} over ${i.latest_year - i.momentum_from} yrs` : ''}`;
    },

    kpiSays(i, name) {
      const lvl = { red: 'far from its target', amber: 'between its bad and good marks', green: 'at or near its target', gray: 'not scored' }[i.level];
      const yrs = i.latest_year - i.momentum_from;
      const dir = i.momentum > 2 ? 'improved' : i.momentum < -2 ? 'worsened' : 'barely moved';
      return `${name} scores ${f(i.score, 0)} of 100, so it is ${lvl}. Over the last ${yrs} years it ${dir} (${V2.signed(i.momentum, 0)} points).`;
    },

    // Own-record quadrant (pts from V2.recordPoints).
    recordQuadrantTitle(pts) {
      const Q = V2.Q, act = pts.filter(d => d.q === Q.act);
      if (act.length) return `Act now: ${list(act.map(d => d.label))} ${act.length > 1 ? 'are' : 'is'} near ${act.length > 1 ? 'their' : 'its'} worst and getting worse`;
      const slip = pts.filter(d => d.q === Q.slip);
      if (slip.length) return `${list(slip.map(d => d.label))} ${slip.length > 1 ? 'are' : 'is'} slipping from near ${slip.length > 1 ? 'their' : 'its'} best`;
      return 'No measure is near its worst and getting worse';
    },
    recordQuadrantSays(pts) {
      const Q = V2.Q, by = q => pts.filter(d => d.q === q).map(d => d.label);
      const is = a => a.length > 1 ? 'are' : 'is', its = a => a.length > 1 ? 'their' : 'its';
      const act = by(Q.act), slip = by(Q.slip), rec = by(Q.rec), best = by(Q.best);
      const parts = [];
      if (act.length) parts.push(`${list(act)} ${is(act)} in the lower half of ${its(act)} own range and worse than ten years ago: look here first.`);
      if (slip.length) parts.push(`${list(slip)} ${is(slip)} in the upper half but worse than ten years ago.`);
      if (rec.length && parts.length < 2) parts.push(`${list(rec)} ${is(rec)} near ${its(rec)} worst but improving.`);
      if (best.length && parts.length < 2) parts.push(`${list(best)} ${is(best)} near ${its(best)} best and improving.`);
      return parts.slice(0, 2).join(' ');
    },
    recordWatchSays(pts) {
      const better = pts.filter(d => d.ch > 0).length;
      const low = pts.reduce((a, b) => (b.pos < a.pos ? b : a));
      return `${better} of ${pts.length} measures are better than ten years ago. ${low.label} is closest to its worst year: ` +
        `${low.fv(low.h.latest)} in ${low.h.last}, against a worst of ${low.fv(low.h.worst)} in ${low.h.worstY}.`;
    },
  };
})(window.V2);
