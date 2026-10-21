/* Societal foundations page. No official targets exist for these measures, so
   status and trend compare each one with Denmark's own record since 2008. */
window.V2 = window.V2 || {};
V2.pages = V2.pages || {};

(function (V2) {
  const FROM = 2008;
  const SHORT = {
    life_expectancy: 'Life expectancy', income: 'Real income', gini: 'Inequality (Gini)',
    unemployment: 'Unemployment', health: 'Bad health', social_trust: 'Trust in strangers',
  };
  const KPI = {
    life_expectancy: { unit: 'yrs', d: 1, sub: 'At birth, 2-year period', src: 'DST HISB8',
      what: 'Expected years of life for a child born now, if today\'s death rates hold. DST publishes it for two-year periods; the year shown is the first of the two.' },
    income: { unit: 'kr', d: 0, sub: 'Disposable, per person, 2024 kr', src: 'DST INDKP101, deflated with PRIS113',
      what: 'Average disposable income per person (after tax and transfers), all ages. Deflated with the consumer price index, so every year is in 2024 kr and a rise means more buying power, not only higher prices.' },
    gini: { unit: '', d: 1, sub: 'Disposable income, 0–100', src: 'DST IFOR41',
      what: 'The Gini coefficient of disposable income: 0 means everyone has the same income, 100 means one person has all of it. A lower value is more equal.' },
    unemployment: { unit: '%', d: 1, sub: 'Labour force survey, full years', src: 'DST AKU111K',
      what: 'Share of the labour force that is out of work and looking for work, from the labour force survey. Annual mean of four quarters; a year with fewer quarters is left out. A lower value is better.' },
    health: { unit: '%', d: 1, sub: 'Adults rating own health bad', src: 'DST SILC60',
      what: 'Share of adults who rate their own health as bad or very bad. EU-SILC survey module with data only since 2021. A lower value is better.' },
    social_trust: { unit: 'of 10', d: 1, sub: 'Average score, EU-SILC', src: 'DST SILC52',
      what: 'Average answer to "how much do you trust people you do not know?" on a 0–10 scale. EU-SILC survey module with data only since 2021.' },
  };
  V2.names = Object.assign(V2.names || {}, SHORT);
  // Value in its own unit, for sentences and labels.
  const FV = {
    life_expectancy: v => `${V2.fmt(v, 1)} yrs`, income: v => `${V2.fmt(v / 1000, 0)}k kr`,
    gini: v => V2.fmt(v, 1), unemployment: v => `${V2.fmt(v, 1)} %`,
    health: v => `${V2.fmt(v, 1)} %`, social_trust: v => V2.fmt(v, 1),
  };
  const NODE = {
    neet: 'NEET rate', learning_outcomes: 'Grades', income: 'Income', gini: 'Inequality',
    life_expectancy: 'Life expectancy', life_satisfaction: 'Life satisfaction', unemployment: 'Unemployment',
  };
  const CONF = { high: 'Strong', med: 'Medium', low: 'Weak' };
  const TEAL = '#4E9AA6';

  const rowLabel = (n, title, q) => V2.el(`<div class="row-label">${n} · ${title} <span>${q}</span></div>`);
  const card = (cls, title, sub, chartCls = '') => V2.el(`
    <div class="card ${cls}"><h3>${title}</h3><div class="sub">${sub}</div><div class="chart ${chartCls}"></div></div>`);
  const addInsight = (c, text, tone = '') => c.appendChild(V2.el(`<div class="insight ${tone}">${text}</div>`));
  const addNote = (c, text) => c.appendChild(V2.el(`<div class="note">${text}</div>`));
  const f = V2.fmt;
  const getJSON = p => fetch(p).then(r => r.json());
  const lvlOf = s => s >= 67 ? 'green' : s >= 33 ? 'amber' : 'red';
  const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  const low1 = t => t.replace(' (Gini)', '').toLowerCase();

  V2.pages.soc = async function (root) {
    const [soc, ind, rel] = await Promise.all([V2.load('soc'), V2.load('indicators'), getJSON('../data/relationships.json')]);
    const h = soc.hero, cs = h.component_scores, I = V2.insights;
    const byId = Object.fromEntries(ind.indicators.map(i => [i.id, i]));
    const ids = h.components;
    const H = Object.fromEntries(ids.map(id => [id, I.record(byId[id], FROM)]));
    const longRun = ids.filter(id => H[id].first <= FROM);
    document.getElementById('crumb-data').textContent = `data to ${Math.max(...ids.map(id => H[id].last))}`;

    // Headline: ten-year change of the long-run measures, in their own units.
    const gained = longRun.filter(id => H[id].improved), lost = longRun.filter(id => !H[id].improved);
    const gainPhr = id => {
      const x = H[id];
      if (id === 'life_expectancy') return `${f(x.latest - x.ten, 1)} more years of life expectancy`;
      if (id === 'income') return `${f(100 * (x.latest / x.ten - 1), 0)} % more real income`;
      return `lower ${low1(SHORT[id])}`;
    };
    // Group by verb: "inequality and unemployment rose".
    const lostPhr = [['rose', lost.filter(id => H[id].lower)], ['fell', lost.filter(id => !H[id].lower)]]
      .filter(([, g]) => g.length).map(([verb, g]) => `${list(g.map(id => low1(SHORT[id])))} ${verb}`);
    root.appendChild(V2.el(`<h1 class="page">${gained.length ? `Over ten years Danes gained ${list(gained.map(gainPhr))}. ` : ''}` +
      `${lost.length ? cap(list(lostPhr)) + '.' : ''}</h1>`));
    root.appendChild(V2.el(`<p class="lede">There are no official targets for these measures. This page compares each one with Denmark's own record since ${FROM} (since 2021 for health and trust). The summary index in row 3 is a model score, and its method is shown there.</p>`));

    // ── Row 1: where is each measure against its own record? ─────────────
    root.appendChild(rowLabel(1, 'Status', 'Where is each measure against its own record?'));
    const g1 = root.appendChild(V2.el('<div class="grid"></div>'));
    const atBest = ids.filter(id => H[id].last === H[id].bestY), atWorst = ids.filter(id => H[id].last === H[id].worstY);
    const nearWorst = ids.filter(id => !atWorst.includes(id) && H[id].pos(H[id].last) < 25);
    const titleParts = [];
    if (atBest.length) titleParts.push(`${list(atBest.map(id => SHORT[id]))} ${atBest.length > 1 ? 'are' : 'is'} at ${atBest.length > 1 ? 'their' : 'its'} best since ${FROM}`);
    const badSide = atWorst.concat(nearWorst);
    if (badSide.length) titleParts.push(`${list(badSide.map(id => low1(SHORT[id])))} ${badSide.length > 1 ? 'are' : 'is'} at or near ${badSide.length > 1 ? 'their' : 'its'} worst`);
    const cRec = g1.appendChild(card('s12', cap(titleParts.join('; ')),
      `Latest value on the range between the worst and best year since ${FROM}. Right is always better.`, 'tall'));
    const rows = ids;
    V2.recordRange(cRec.querySelector('.chart'), rows.map(id => ({
      name: narrow => H[id].first > FROM && !narrow ? `${SHORT[id]} (since ${H[id].first})` : SHORT[id].replace(' (Gini)', ''),
      h: H[id], fv: FV[id] })));
    const peaked = ids.filter(id => H[id].bestY > H[id].tenY && H[id].last !== H[id].bestY && H[id].first <= FROM);
    if (peaked.length) addInsight(cRec, peaked.map(id => `${SHORT[id]} was best in ${H[id].bestY} (${FV[id](H[id].best)}) and is ${FV[id](H[id].latest)} in ${H[id].last}.`).join(' '));
    V2.info(cRec, {
      what: `Each line runs from the worst value Denmark had since ${FROM} (left) to the best (right), with the year after the apostrophe. For measures where lower is better, the scale is turned so that right is still better. The blue dot is the latest year, the hollow dot ten years earlier (or the first year). No targets or marks are used.`,
      says: `${cap(list(gained.map(id => low1(SHORT[id]))))} improved over ten years; ${list(lost.map(id => low1(SHORT[id])))} got worse. Health and trust have only a few years of data, so their range is narrow.`,
      source: 'data/v2/indicators.json; income in 2024 kr; unemployment full years only',
    });

    const sparks = ids.map(id => {
      const i = byId[id], k = KPI[id];
      const [lvl, verdict] = I.recordVerdict(i, FROM);
      const c = V2.kpi({ label: SHORT[id], sub: k.sub, value: i.latest, unit: k.unit, decimals: k.d,
        series: i.series, direction: i.direction, level: lvl, verdict });
      c.classList.replace('s3', 's4');
      V2.info(c, { what: k.what, says: I.recordSays(i, SHORT[id], FV[id], FROM), source: k.src });
      return g1.appendChild(c);
    });
    sparks.forEach(c => c._spark(c.querySelector('.spark')));

    // ── Row 2: trend ─────────────────────────────────────────────────────
    root.appendChild(rowLabel(2, 'Trend', 'Which way are they moving?'));
    const g2 = root.appendChild(V2.el('<div class="grid"></div>'));
    const inc = soc.income, iy = Object.keys(inc.real).map(Number).filter(y => y >= FROM).sort((a, b) => a - b);
    const iH = H.income, il = iy[iy.length - 1], i10 = il - 10;
    const nomCh = 100 * (inc.nominal[il] / inc.nominal[i10] - 1), realCh = 100 * (inc.real[il] / inc.real[i10] - 1);
    const cInc = g2.appendChild(card('s7',
      iH.last !== iH.bestY ? `Real income per person is ${f(100 * (1 - iH.latest / iH.best), 1)} % below its ${iH.bestY} peak`
        : `Real income per person is at its highest since ${FROM}`,
      `Average disposable income per person, thousand kr`, 'tall'));
    V2.chart(cInc.querySelector('.chart'), p => Object.assign(V2.base(p), {
      grid: { left: 8, right: 56, top: 32, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 18, itemHeight: 2, textStyle: { color: p.ink2, fontSize: 11 } },
      tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'axis', valueFormatter: v => f(v, 0) + 'k kr' }),
      xAxis: V2.axis(p, { type: 'category', data: iy.map(String), boundaryGap: false, axisLabel: { color: p.ink3, fontSize: 11, interval: 3 }, splitLine: { show: false } }),
      yAxis: V2.axis(p, { type: 'value', scale: true, axisLabel: { color: p.ink3, fontSize: 11, formatter: v => v + 'k' } }),
      series: [
        { name: `Real (${inc.base_year} kr)`, type: 'line', symbol: 'none', data: iy.map(y => inc.real[y] / 1000),
          lineStyle: { color: p.accent, width: 2.5 }, itemStyle: { color: p.accent },
          endLabel: { show: true, color: p.accent, fontSize: 11, formatter: o => f(o.value, 0) + 'k' },
          markPoint: iH.last !== iH.bestY ? { symbol: 'circle', symbolSize: 8, itemStyle: { color: p.accent },
            label: { show: true, position: 'top', color: p.ink2, fontSize: 11, formatter: `Peak ${iH.bestY}` },
            data: [{ coord: [String(iH.bestY), iH.best / 1000] }] } : undefined },
        { name: 'Nominal (kr of each year)', type: 'line', symbol: 'none', data: iy.map(y => inc.nominal[y] / 1000),
          lineStyle: { color: p.ink3, width: 1.5, type: 'dashed' }, itemStyle: { color: p.ink3 } },
      ],
    }));
    addInsight(cInc, `Since ${i10} income rose ${f(nomCh, 0)} % in kroner but ${f(realCh, 0)} % in buying power. Prices took the rest.`);
    V2.info(cInc, {
      what: `Two lines for the same income. Dashed: kroner of each year, as DST publishes it. Blue: the same income in ${inc.base_year} kr, adjusted with the consumer price index. Only the blue line shows what people can buy.`,
      says: `Real income rose until ${iH.bestY} (${FV.income(iH.best)}) and was ${FV.income(iH.latest)} in ${iH.last}. Prices rose faster than incomes after ${iH.bestY}.`,
      source: `DST INDKP101; ${inc.deflator}`,
    });

    const un = byId.unemployment.series, gi = byId.gini.series;
    const uy = Object.keys(un).map(Number).filter(y => y >= FROM).sort((a, b) => a - b);
    const ul = uy[uy.length - 1], recent = uy.filter(y => y >= ul - 5);
    const uMinY = recent.reduce((a, b) => (un[b] < un[a] ? b : a));
    const cUG = g2.appendChild(card('s5',
      `Unemployment is up ${f(un[ul] - un[uMinY], 1)} points since ${uMinY}; inequality is ${f(gi[H.gini.last] - gi[H.gini.tenY], 1)} points above ${H.gini.tenY}`,
      `Unemployment (%, left) and Gini (right), ${FROM}–${ul}`, 'tall'));
    V2.chart(cUG.querySelector('.chart'), p => Object.assign(V2.base(p), {
      grid: { left: 8, right: 8, top: 32, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 18, itemHeight: 2, textStyle: { color: p.ink2, fontSize: 11 } },
      tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'axis', valueFormatter: v => v == null ? '—' : f(v, 1) }),
      xAxis: V2.axis(p, { type: 'category', data: uy.map(String), boundaryGap: false, axisLabel: { color: p.ink3, fontSize: 11, interval: 4 }, splitLine: { show: false } }),
      yAxis: [V2.axis(p, { type: 'value', scale: true, axisLabel: { color: p.ink3, fontSize: 11, formatter: v => v + ' %' } }),
              V2.axis(p, { type: 'value', scale: true, splitLine: { show: false }, axisLabel: { color: p.ink3, fontSize: 11 } })],
      series: [
        { name: 'Unemployment', type: 'line', symbol: 'none', data: uy.map(y => un[y]), lineStyle: { color: p.accent, width: 2.5 }, itemStyle: { color: p.accent } },
        { name: 'Gini', type: 'line', yAxisIndex: 1, symbol: 'none', data: uy.map(y => gi[y] ?? null), lineStyle: { color: TEAL, width: 2 }, itemStyle: { color: TEAL } },
      ],
    }));
    V2.info(cUG, {
      what: 'Two measures on two scales: unemployment in % on the left axis, the Gini coefficient on the right axis. Both are better when lower. The axes do not start at zero.',
      says: `Unemployment fell to ${f(un[uMinY], 1)} % in ${uMinY} and was ${f(un[ul], 1)} % in ${ul}. The Gini rose from ${f(gi[H.gini.tenY], 1)} in ${H.gini.tenY} to ${f(gi[H.gini.last], 1)} in ${H.gini.last}; the lowest value since ${FROM} was ${f(H.gini.best, 1)} in ${H.gini.bestY}.`,
      source: 'DST AKU111K (full years), IFOR41',
    });

    // ── Row 3: where are the gaps? ───────────────────────────────────────
    root.appendChild(rowLabel(3, 'Sources', 'Where are the gaps, and what does the summary index say?'));
    const g3 = root.appendChild(V2.el('<div class="grid"></div>'));
    const ord = [...ids].sort((a, b) => cs[b] - cs[a]);
    const anc = id => byId[id].anchors;
    const cComp = g3.appendChild(card('s5', `Summary index: ${f(h.latest, 0)} of 100 on the dashboard's own scale`,
      `Model score per component, ${h.latest_year}. 0 = bad mark, 50 = middle mark, 100 = good mark.`, 'tall'));
    V2.chart(cComp.querySelector('.chart'), p => Object.assign(V2.base(p), {
      grid: { left: 128, right: 40, top: 12, bottom: 24 },
      tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: ps => { const id = ord[ps[0].dataIndex], a = anc(id);
          return `<b>${SHORT[id]}</b>: ${f(cs[id], 0)} of 100<br>Marks: bad ${FV[id](a.bad)}, middle ${FV[id](a.mid)}, good ${FV[id](a.good)}`; } }),
      yAxis: V2.axis(p, { type: 'category', inverse: true, data: ord.map(i => SHORT[i]), axisLabel: { color: p.ink2, fontSize: 11.5 } }),
      xAxis: V2.axis(p, { type: 'value', min: 0, max: 100, interval: 25, axisLabel: { color: p.ink3, fontSize: 11 } }),
      series: [{
        type: 'bar', barMaxWidth: 18,
        data: ord.map(i => ({ value: cs[i], itemStyle: { color: p[lvlOf(cs[i])], borderRadius: 2 } })),
        label: { show: true, position: 'right', color: p.ink2, fontSize: 10.5, fontFamily: p.mono, formatter: o => f(o.value, 0) },
      }],
    }));
    addNote(cComp, `A model, not a target. Each component is scored on a straight line between three marks set by hand in <code>data/indicator_meta.json</code> ("seeded from Danish/EU ranges and HLEG thresholds"), then all six are averaged with equal weight. Marks (bad / middle / good): ${ord.map(id => `${low1(SHORT[id])} ${FV[id](anc(id).bad)} / ${FV[id](anc(id).mid)} / ${FV[id](anc(id).good)}`).join('; ')}. Moving one mark moves the score.`);
    V2.info(cComp, {
      what: 'The summary index of the current dashboard. Each bar is one component\'s 0–100 score; the index is their mean. Bar colours use the index\'s own thirds (below 33, 33–67, from 67). These thresholds are conventions of this dashboard, not policy goals.',
      says: `${SHORT[ord[0]]} scores highest (${f(cs[ord[0]], 0)}), ${low1(SHORT[ord[ord.length - 1]])} lowest (${f(cs[ord[ord.length - 1]], 0)}). The low Gini score comes from its good mark of ${f(anc('gini').good, 0)}; a different mark would give a different score. Use the index for a quick summary, and the real values in rows 1 and 2 for decisions.`,
      source: 'data/indicator_meta.json anchors; js/zones.js scoring',
    });

    // Gini by municipality: broad or concentrated?
    const gm = soc.gini_municipal, gv = gm.values;
    const names = Object.keys(gv).sort((a, b) => gv[b] - gv[a]);
    const sorted = names.map(n => gv[n]).sort((a, b) => a - b);
    const med = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const above = names.filter(n => gv[n] > gm.national);
    const binOf = v => Math.max(0, gm.histogram.findIndex(b => v >= b.from && v <= b.to));
    const cG = g3.appendChild(card('s7',
      `Inequality is concentrated: ${above.length} of ${gm.n} municipalities are above the national Gini of ${f(gm.national, 1)}`,
      `Municipalities by Gini of disposable income, ${gm.year}`, 'tall'));
    V2.chart(cG.querySelector('.chart'), p => Object.assign(V2.base(p), {
      grid: { left: 8, right: 16, top: 40, bottom: 24, containLabel: true },
      tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: ps => { const b = gm.histogram[ps[0].dataIndex];
          return `Gini ${f(b.from, 1)}–${f(b.to, 1)}<br><b>${b.count}</b> municipalit${b.count === 1 ? 'y' : 'ies'}`; } }),
      xAxis: V2.axis(p, { type: 'category', data: gm.histogram.map(b => f(b.from, 0)),
        name: 'Gini, lower edge of each bin', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: p.ink3, fontSize: 11 } }),
      yAxis: V2.axis(p, { type: 'value', minInterval: 1 }),
      series: [{
        type: 'bar', barCategoryGap: '12%',
        data: gm.histogram.map(b => ({ value: b.count, itemStyle: { color: b.from >= gm.national ? p.g1 : p.accent, borderRadius: [3, 3, 0, 0] } })),
        label: { show: true, position: 'top', color: p.ink2, fontSize: 10.5, fontFamily: p.mono, formatter: o => o.value || '' },
        markLine: { symbol: 'none', silent: true, data: [
          { xAxis: binOf(gm.national), lineStyle: { color: p.ink3, type: 'dashed', width: 1.5 },
            label: { formatter: `Denmark ${f(gm.national, 1)}`, color: p.ink2, fontSize: 11, position: 'end' } },
        ] },
      }],
    }));
    addInsight(cG, `The median municipality has a Gini of ${f(med, 1)}. The high tail is ${list(names.slice(0, 3).map(n => `${n} ${f(gv[n], 1)}`))}.`);
    V2.info(cG, {
      what: `All ${gm.n} municipalities, counted by their Gini coefficient. Blue bins are below the national value, grey bins at or above it. The dashed line marks Denmark as a whole. The national Gini also counts the gaps between municipalities, so it is higher than most local values.`,
      says: `Most municipalities sit between ${f(sorted[0], 1)} and about ${f(sorted[Math.floor(sorted.length * 0.85)], 1)}. A few high-income municipalities north of Copenhagen sit far out on the right.`,
      source: 'DST IFOR41, by municipality',
    });

    const dec = soc.income_deciles, dk = Object.keys(dec.values).sort((a, b) => parseInt(a) - parseInt(b));
    const k = v => v / 1000;
    const cD = g3.appendChild(card('s5', `The top tenth has ${f(dec.top_bottom_ratio, 1)}× the income of the bottom tenth`,
      `Average disposable income by income decile, ${dec.year}, thousand kr`, 'tall'));
    V2.chart(cD.querySelector('.chart'), p => Object.assign(V2.base(p), {
      grid: { left: 8, right: 12, top: 24, bottom: 24, containLabel: true },
      tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => f(v, 0) + 'k kr' }),
      xAxis: V2.axis(p, { type: 'category', data: dk.map(d => parseInt(d)),
        name: 'Decile (1 = lowest tenth)', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: p.ink3, fontSize: 11 } }),
      yAxis: V2.axis(p, { type: 'value', axisLabel: { color: p.ink3, fontSize: 11, formatter: v => v + 'k' } }),
      series: [{
        type: 'bar', barCategoryGap: '20%',
        data: dk.map((d, i) => ({ value: k(dec.values[d]), itemStyle: { color: i === dk.length - 1 || i === 0 ? p.accent : p.g1, borderRadius: [3, 3, 0, 0] } })),
        label: { show: true, position: 'top', color: p.ink2, fontSize: 10, fontFamily: p.mono, formatter: o => f(o.value, 0) },
      }],
    }));
    const top = dec.values[dk[dk.length - 1]], step9 = dec.values[dk[dk.length - 2]];
    addInsight(cD, `The jump from the 9th to the 10th decile (${f(k(step9), 0)}k to ${f(k(top), 0)}k) is larger than the whole range from the 1st to the 9th.`);
    V2.info(cD, {
      what: 'People are sorted by income and split into ten equal groups. Each bar is the average disposable income in one group. Blue marks the lowest and highest tenth.',
      says: `The lowest tenth averages ${f(dec.values[dk[0]], 0)} kr, the highest ${f(top, 0)} kr. Deciles 2 to 9 rise in even steps; the top tenth breaks away.`,
      source: 'DST IFOR32, national, current kr',
    });

    // Life expectancy by region and sex: dot plot.
    const le = soc.life_expectancy_region, lv = le.values;
    const rName = c => c === '000' ? 'Denmark' : le.names[c].replace(/^Region /, '');
    const regs = Object.keys(lv).filter(c => c !== '000').sort((a, b) => lv[b].TOT - lv[a].TOT);
    const [hiR, loR] = [regs[0], regs[regs.length - 1]];
    const cats = ['000', ...regs];
    const cLe = g3.appendChild(card('s7',
      `Life expectancy ranges from ${f(lv[loR].TOT, 1)} years in ${rName(loR)} to ${f(lv[hiR].TOT, 1)} in ${rName(hiR)}; women live ${f(lv['000'].K - lv['000'].M, 1)} years longer`,
      `Life expectancy at birth by region and sex, ${le.period.replace(':', '–')}, years`, 'tall'));
    V2.chart(cLe.querySelector('.chart'), p => Object.assign(V2.base(p), {
      grid: { left: 8, right: 24, top: 32, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: p.ink2, fontSize: 11 }, data: ['Men', 'Women', 'All'] },
      tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => f(v, 1) + ' yrs' }),
      yAxis: V2.axis(p, { type: 'category', inverse: true, data: cats.map(rName), axisLabel: { color: p.ink2, fontSize: 11.5, fontWeight: 500 } }),
      xAxis: V2.axis(p, { type: 'value', min: 78, max: 85, axisLabel: { color: p.ink3, fontSize: 11 } }),
      series: [
        { name: 'Gap', type: 'custom', silent: true, tooltip: { show: false },
          renderItem: (params, api) => {
            const a = api.coord([api.value(0), params.dataIndex]), b = api.coord([api.value(1), params.dataIndex]);
            return { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: p.g2, lineWidth: 3 } };
          },
          data: cats.map(c => [lv[c].M, lv[c].K]), encode: { x: [0, 1] }, z: 1 },
        { name: 'Men', type: 'scatter', symbolSize: 12, data: cats.map(c => lv[c].M), itemStyle: { color: p.accent }, z: 3,
          label: { show: true, position: 'left', color: p.ink2, fontSize: 10.5, fontFamily: p.mono, formatter: o => f(o.value, 1) } },
        { name: 'Women', type: 'scatter', symbolSize: 12, data: cats.map(c => lv[c].K), itemStyle: { color: TEAL }, z: 3,
          label: { show: true, position: 'right', color: p.ink2, fontSize: 10.5, fontFamily: p.mono, formatter: o => f(o.value, 1) } },
        { name: 'All', type: 'scatter', symbol: 'diamond', symbolSize: 10, data: cats.map(c => lv[c].TOT), itemStyle: { color: p.ink }, z: 4 },
      ],
    }));
    const sexGaps = regs.map(c => lv[c].K - lv[c].M);
    V2.info(cLe, {
      what: 'Expected years of life at birth in each region, for men (blue), women (teal) and everyone (black diamond). The grey line joins men and women in the same region.',
      says: `The gap between regions is ${f(lv[hiR].TOT - lv[loR].TOT, 1)} years. The gap between women and men is larger: ${f(Math.min(...sexGaps), 1)} to ${f(Math.max(...sexGaps), 1)} years in every region. Men in ${rName(loR)} have the shortest lives, ${f(lv[loR].M, 1)} years.`,
      source: 'DST HISBR',
    });

    // ── Row 4: levers ────────────────────────────────────────────────────
    root.appendChild(rowLabel(4, 'Levers', 'What can be pulled, and where first?'));
    const g4 = root.appendChild(V2.el('<div class="grid"></div>'));
    const OUT = ['income', 'gini', 'life_expectancy', 'life_satisfaction'];
    const links = rel.edges.filter(e => OUT.includes(e.to) && NODE[e.from]).sort((a, b) => b.strength - a.strength);
    const best = links[0], quick = links.reduce((a, b) => (b.lag_years < a.lag_years ? b : a));
    const maxS = Math.max(...links.map(e => e.strength));
    const cLv = g4.appendChild(V2.el(`
      <div class="card s7">
        <h3>The strongest link is ${NODE[best.from]} → ${NODE[best.to].toLowerCase()} (${f(best.strength, 2)}), but it takes ${best.lag_years} years</h3>
        <div class="sub">Links in the cascade model that end in a societal outcome, strongest first</div>
        <table class="watch">
          <thead><tr><th>Lever → outcome</th><th>Strength</th><th>Delay</th><th>Evidence</th></tr></thead>
          <tbody>${links.map(e => `
            <tr>
              <td>${NODE[e.from]} → ${NODE[e.to]}<div class="eta">${e.source.split(';')[0].replace(/\).*/, ')')}</div></td>
              <td class="num">${f(e.strength, 2)}<span class="sbar" style="width:${Math.round(48 * e.strength / maxS)}px"></span></td>
              <td class="num">${e.lag_years} yrs</td>
              <td class="q ${e.confidence === 'high' ? 'ok' : e.confidence === 'med' ? 'warn' : 'act'}">${CONF[e.confidence]}${e.draft ? ' · draft' : ''}</td>
            </tr>`).join('')}</tbody>
        </table>
        <div class="note">Illustrative, as in the current cascade: strength is a 0–1 ordering from the literature review, not a measured coefficient. "Draft" means the link still waits for source hardening.</div>
      </div>`));
    V2.info(cLv, {
      what: 'Each row is one cause-and-effect link from the cascade model that ends in income, inequality, life expectancy or life satisfaction. Strength says how much of a change passes along the link (0–1). Delay is the expected years before the effect shows. Evidence is the confidence rating from the literature review.',
      says: `${NODE[best.from]} → ${NODE[best.to].toLowerCase()} is the strongest link (${f(best.strength, 2)}) but needs ${best.lag_years} years. The fastest is ${NODE[quick.from].toLowerCase()} → ${NODE[quick.to].toLowerCase()} (${quick.lag_years} yr${quick.lag_years === 1 ? '' : 's'}). ${links.filter(e => e.draft).length} of ${links.length} links are still drafts.`,
      source: 'data/relationships.json',
    });

    // What the model can and cannot pull, per component.
    const into = id => rel.edges.filter(e => e.to === id);
    const noLever = ids.filter(id => !into(id).length);
    const cP = g4.appendChild(V2.el(`
      <div class="card s5">
        <h3>${noLever.length} of ${ids.length} measures have no lever in the model</h3>
        <div class="sub">Where each measure can be pulled from</div>
        <ul class="pull">
          ${ids.filter(id => into(id).length).map(id => `<li><b>${SHORT[id]}</b>: from ${list(into(id).map(e => (NODE[e.from] || e.from).toLowerCase()))}.</li>`).join('')}
          <li><b>No modelled lever</b>: ${list(noLever.map(id => SHORT[id].toLowerCase()))}. Tax, transfer, labour-market and health policy sit outside the cascade.</li>
          <li>The NEET and grades levers are on the <a href="#edu" style="color:var(--accent)">Education page</a>, with a funding what-if.</li>
        </ul>
      </div>`));
    V2.info(cP, {
      what: 'For each of the six measures, the cascade links that lead into it. A measure with no incoming link cannot be moved by any lever in the current model.',
      says: `${cap(list(noLever.map(id => SHORT[id].toLowerCase())))} ${noLever.length === 1 ? 'has' : 'have'} no lever.`,
    });

    // Quadrant at half width, with its text twin beside it. Own record since 2008, no marks.
    const g5 = root.appendChild(V2.el('<div class="grid" style="margin-top:var(--gap)"></div>'));
    const pts = V2.recordPoints(ind.indicators.filter(i => i.theme === 'societal'), SHORT, FV, 2008);
    const cQ = g5.appendChild(card('s6', I.recordQuadrantTitle(pts), 'Latest value on its own range since 2008 vs its move in ten years', 'tall'));
    V2.recordQuadrant(cQ.querySelector('.chart'), pts);
    V2.info(cQ, { what: V2.recordInfo.quadrant(2008), says: I.recordQuadrantSays(pts) });
    const cW = g5.appendChild(V2.el(`
      <div class="card s6"><h3>Watch list: where to look first</h3>
        <div class="sub">Same measures as the chart, most urgent first</div>
        ${V2.recordWatch(pts)}
        <div class="note">Compares each measure with its own record since 2008, not with the summary-index marks. Health and trust start in 2021, so their ten-years-before value is 2021.</div>
      </div>`));
    V2.info(cW, { what: V2.recordInfo.watch, says: I.recordWatchSays(pts) });
  };
})(window.V2);
