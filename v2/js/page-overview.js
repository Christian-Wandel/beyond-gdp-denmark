/* Overview page: the three themes side by side. Only territorial emissions have an
   official target (Klimaloven, 70 % below 1990 by 2030), so only they get a pace.
   Every other measure is compared with Denmark's own record since 2008. */
window.V2 = window.V2 || {};
V2.pages = V2.pages || {};

(function (V2) {
  const FROM = 2008;
  const THEMES = [
    { id: 'ecological', page: 'eco', name: 'Ecological limits', tag: 'ECO' },
    { id: 'societal', page: 'soc', name: 'Societal foundations', tag: 'SOC' },
    { id: 'education', page: 'edu', name: 'Education', tag: 'EDU' },
  ];
  const TEAL = '#4E9AA6';

  const rowLabel = (n, title, q) => V2.el(`<div class="row-label">${n} · ${title} <span>${q}</span></div>`);
  const card = (cls, title, sub, chartCls = '') => V2.el(`
    <div class="card ${cls}"><h3>${title}</h3><div class="sub">${sub}</div><div class="chart ${chartCls}"></div></div>`);
  const addInsight = (c, text, tone = '') => c.appendChild(V2.el(`<div class="insight ${tone}">${text}</div>`));
  const addNote = (c, text) => c.appendChild(V2.el(`<div class="note">${text}</div>`));
  const f = V2.fmt;
  const getJSON = p => fetch(p).then(r => r.json());
  const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const low = t => t.charAt(0).toLowerCase() + t.slice(1);
  const chg = v => v >= 0 ? `rose ${f(v, 0)} %` : `fell ${f(-v, 0)} %`;
  // Theme colour from the share of measures better than ten years ago (display convention, not a target).
  const toneOf = share => share >= 2 / 3 ? 'green' : share >= 1 / 3 ? 'amber' : 'red';
  const TONE_TEXT = { green: 'Mostly better than ten years ago', amber: 'Mixed against its own record', red: 'Mostly worse than ten years ago' };

  // Status per theme, shared by the Overview cards and the nav dots.
  V2.themeStatus = async function () {
    const [eco, ind] = await Promise.all([V2.load('eco'), V2.load('indicators')]);
    const pts = V2.recordPoints(ind.indicators, V2.names, null, FROM);
    const themes = {};
    THEMES.forEach(t => {
      const tp = pts.filter(d => d.theme === t.id), better = tp.filter(d => d.ch > 0);
      const tone = toneOf(better.length / tp.length);
      themes[t.page] = { ...t, pts: tp, better, worse: tp.filter(d => d.ch <= 0), tone, text: TONE_TEXT[tone] };
    });
    // Klimaloven sets the Ecological status.
    [themes.eco.tone, themes.eco.text] = V2.insights.heroStatus(eco.hero, eco.pace);
    return { eco, pts, themes };
  };

  V2.navStatus = async function () {
    const { themes } = await V2.themeStatus();
    Object.values(themes).forEach(t => {
      const a = document.querySelector(`.nav a[href="#${t.page}"]`);
      if (!a) return;
      a.querySelector('.dot').className = `dot ${t.tone}`;
      a.title = t.text;
    });
  };

  const themeCard = o => V2.el(`
    <div class="card s4 theme">
      <span class="status ${o.tone}">${o.statusText}</span>
      <h3>${o.name}</h3>
      <div class="val">${o.value}<small>${o.unit}</small></div>
      <div class="sub">${o.label}</div>
      <p class="tbody">${o.body}</p>
      <a class="more" href="#${o.page}">Open ${o.name} →</a>
    </div>`);

  V2.pages.overview = async function (root) {
    const [st, edu, gdp, pop] = await Promise.all([V2.themeStatus(), V2.load('edu'),
      getJSON('../data/dst_gdp.json'), getJSON('../data/dst_population.json')]);
    const { eco, pts, themes: T } = st, I = V2.insights, h = eco.hero, pc = eco.pace, Q = V2.Q;
    document.getElementById('crumb-data').textContent = `data to ${Math.max(h.latest_year, ...pts.map(d => d.h.last))}`;
    const better = pts.filter(d => d.ch > 0);
    const projCut = 100 * (1 - pc.projected_at_target_year / h.base);
    const climPhr = { green: 'on track for', amber: 'close to, but behind,', red: 'off track for' }[T.eco.tone];

    root.appendChild(V2.el(`<h1 class="page">Denmark is ${climPhr} its 2030 climate target. ` +
      `${better.length} of ${pts.length} other measures are better than ten years ago.</h1>`));
    root.appendChild(V2.el(`<p class="lede">Only territorial emissions have an official target (Klimaloven: ${f(h.target_reduction_pct, 0)} % below 1990 by ${h.target_year}), so only they get a required pace. The other ${pts.length} measures are compared with Denmark's own record since ${FROM}: the best year, the worst year and ten years ago. Each theme page has the detail.</p>`));

    // ── Row 1: one card per theme ────────────────────────────────────────
    root.appendChild(rowLabel(1, 'Status', 'Where does each theme stand?'));
    const g1 = root.appendChild(V2.el('<div class="grid"></div>'));
    const names = a => list(a.map(d => low(d.label)));
    const te = T.eco;
    const cE = g1.appendChild(themeCard({ ...te, statusText: te.text,
      value: f(h.reduction_pct, 0), unit: '% cut since 1990',
      label: `Territorial emissions incl. land use, ${h.latest_year}. Target: ${f(h.target_reduction_pct, 0)} % by ${h.target_year}.`,
      body: `On the trend since ${pc.trend_from} the cut reaches about ${f(projCut, 0)} % by ${pc.target_year}. ` +
        `Of the ${te.pts.length} other ecological measures, ${te.better.length} ${te.better.length === 1 ? 'is' : 'are'} better than ten years ago` +
        (te.worse.length ? ` (worse: ${names(te.worse)}).` : '.') }));
    V2.info(cE, {
      what: `Status comes from the Klimaloven target only: the ${f(h.target_reduction_pct, 0)} % cut by ${h.target_year} against the trend of the last ${pc.latest_year - pc.trend_from} years. The other ecological measures have no official target and are compared with their own record.`,
      says: I.hero(h, pc),
      source: 'data/v2/eco.json, indicators.json',
    });

    const ts = T.soc;
    const atBest = d => d.h.last === d.h.bestY;
    const cS = g1.appendChild(themeCard({ ...ts, statusText: ts.text,
      value: `${ts.better.length} of ${ts.pts.length}`, unit: 'better',
      label: `Measures better than ten years before, latest year`,
      body: `Better: ${names(ts.better)}. Worse: ${names(ts.worse)}.` +
        (ts.pts.some(atBest) ? ` At ${ts.pts.filter(atBest).length > 1 ? 'their' : 'its'} best since ${FROM}: ${names(ts.pts.filter(atBest))}.` : '') }));
    V2.info(cS, {
      what: `There are no official targets for these measures. Each one is compared with its own value ten years before (since 2021 for health and trust). The colour is a convention of this page: green if at least two thirds are better, red if fewer than one third.`,
      says: `${ts.better.length} of ${ts.pts.length} societal measures are better than ten years ago.`,
      source: 'data/v2/indicators.json',
    });

    const tdu = T.edu;
    const HN = I.record({ series: edu.hero.series, direction: 'lower_better' }, FROM);
    const cD = g1.appendChild(themeCard({ ...tdu, statusText: tdu.text,
      value: f(edu.hero.latest, 1), unit: '% NEET',
      label: `16–24 year-olds not in education or work, ${edu.hero.latest_year}`,
      body: `The NEET rate is ${HN.improved ? 'lower' : 'higher'} than in ${HN.tenY} (${f(HN.ten, 1)} %); the low since ${HN.first} was ${f(HN.best, 1)} % in ${HN.bestY}. ` +
        `${tdu.better.length} of ${tdu.pts.length} education measures are better than ten years ago` + (tdu.worse.length ? ` (worse: ${names(tdu.worse)}).` : '.') }));
    V2.info(cD, {
      what: `The headline is the NEET rate from DST NEET4. There is no official target, so the theme status counts how many of the ${tdu.pts.length} education measures are better than ten years before. The colour rule is the same as for the societal card.`,
      says: `${tdu.better.length} of ${tdu.pts.length} education measures are better than ten years ago.`,
      source: 'data/v2/edu.json, indicators.json',
    });

    // ── Row 2: every measure on its own range ────────────────────────────
    root.appendChild(rowLabel(2, 'All measures', 'Where is each measure against its own record?'));
    const g2 = root.appendChild(V2.el('<div class="grid"></div>'));
    const ordered = THEMES.flatMap(t => T[t.page].pts.slice().sort((a, b) => a.pos - b.pos));
    const best = ordered.filter(atBest), bottom = ordered.filter(d => d.pos < 25);
    const cR = g2.appendChild(card('s12',
      `${best.length} of ${ordered.length} measures are at their best since ${FROM}; ${bottom.length} sit in the bottom quarter of their own range`,
      `Latest value on the range between the worst and best year since ${FROM}. Right is always better. Worst first within each theme.`));
    const rEl = cR.querySelector('.chart');
    rEl.style.height = `${ordered.length * 40 + 48}px`;
    const tagOf = Object.fromEntries(THEMES.map(t => [t.id, t.tag]));
    V2.recordRange(rEl, ordered.map(d => ({
      name: narrow => `${tagOf[d.theme]} · ${d.h.first > FROM && !narrow ? `${d.label} (since ${d.h.first})` : d.label}`,
      h: d.h, fv: d.fv })));
    if (bottom.length) addInsight(cR, `Bottom quarter: ${bottom.map(d => `${d.label} ${d.fv(d.h.latest)} in ${d.h.last} (worst ${d.fv(d.h.worst)} in ${d.h.worstY})`).join('; ')}.`, 'red');
    V2.info(cR, {
      what: `Each line runs from the worst value Denmark had since ${FROM} (left) to the best (right), with the year after the apostrophe. For measures where lower is better the scale is turned, so right is always better. The blue dot is the latest year, the hollow dot ten years earlier (or the first year). The prefix is the theme (ECO, SOC, EDU). No targets or marks are used.`,
      says: `${best.length ? `${list(best.map(d => d.label))} ${best.length > 1 ? 'are' : 'is'} at ${best.length > 1 ? 'their' : 'its'} best. ` : ''}A short series (since 2015 or later) has a narrow range, so its position moves a lot with one year of data.`,
      source: 'data/v2/indicators.json',
    });

    // ── Row 3: does growth still drive emissions? ────────────────────────
    root.appendChild(rowLabel(3, 'Trend', 'Is the economy growing away from its emissions?'));
    const g3 = root.appendChild(V2.el('<div class="grid"></div>'));
    const gs = gdp.data.DNK.series, ghg = h.series, fpc = eco.footprint_pc, ps = pop.data.DNK.series;
    const popY = y => { const q = [1, 2, 3, 4].map(k => ps[`${y}K${k}`]).filter(v => v != null); return q.length === 4 ? q.reduce((a, b) => a + b) / 4 : null; };
    const fpt = y => fpc[y] != null && popY(y) ? fpc[y] * popY(y) / 1e6 : null;   // Mt
    const LINES = [
      { name: 'Real GDP', get: y => gs[y] ?? null, color: p => p.accent },
      { name: 'Emissions on Danish soil', get: y => ghg[y] ?? null, color: p => p.red },
      { name: 'Consumption footprint', get: fpt, color: () => TEAL },
    ];
    const lastOf = L => Math.max(...Object.keys(gs).concat(Object.keys(ghg), Object.keys(fpc)).map(Number).filter(y => L.get(y) != null));
    const yMax = Math.max(...LINES.map(lastOf)), cy = Math.min(...LINES.map(lastOf));
    const yrs = Array.from({ length: yMax - FROM + 1 }, (_, i) => FROM + i);
    const idx = (L, y) => L.get(y) == null ? null : 100 * L.get(y) / L.get(FROM);
    const [dG, dT, dF] = LINES.map(L => idx(L, cy) - 100);
    const cDec = g3.appendChild(card('s7',
      `From ${FROM} to ${cy} real GDP ${chg(dG)}; emissions on Danish soil ${chg(dT)} and the consumption footprint ${chg(dF)}`,
      `Index, ${FROM} = 100`, 'tall'));
    V2.chart(cDec.querySelector('.chart'), p => Object.assign(V2.base(p), {
      grid: { left: 8, right: 44, top: 32, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 18, itemHeight: 2, textStyle: { color: p.ink2, fontSize: 11 } },
      tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'axis', valueFormatter: v => v == null ? '—' : f(v, 0) }),
      xAxis: V2.axis(p, { type: 'category', data: yrs.map(String), boundaryGap: false, axisLabel: { color: p.ink3, fontSize: 11, interval: 3 }, splitLine: { show: false } }),
      yAxis: V2.axis(p, { type: 'value', scale: true, axisLabel: { color: p.ink3, fontSize: 11 } }),
      series: LINES.map((L, i) => ({ name: L.name, type: 'line', symbol: 'none', connectNulls: false,
        data: yrs.map(y => idx(L, y)), lineStyle: { color: L.color(p), width: i ? 2 : 2.5 }, itemStyle: { color: L.color(p) },
        endLabel: { show: true, color: L.color(p), fontSize: 11, formatter: o => f(o.value, 0) },
        markLine: i ? undefined : { symbol: 'none', silent: true, lineStyle: { color: p.g1, type: 'dashed', width: 1 }, label: { show: false }, data: [{ yAxis: 100 }] } })),
    }));
    if (dG > 0 && dT < 0 && dF < 0) {
      addInsight(cDec, `Output went up while both emission measures went down: absolute decoupling. ` +
        (dF > dT ? `The footprint fell less, because it also counts emissions abroad from goods that Denmark imports.` : `The footprint fell as fast as emissions at home.`), 'green');
    }
    addNote(cDec, `Danish soil: territorial emissions incl. land use, the Klimaloven measure. Consumption footprint: DST's experimental per-person footprint × the mean population of the year. GDP: ${gdp.meta.label}, DST ${gdp.meta.table}.`);
    V2.info(cDec, {
      what: `Three series set to 100 in ${FROM}, so they can share one axis. A line below 100 is lower than in ${FROM}. Real GDP is the size of the economy after inflation. "Danish soil" counts emissions inside Denmark. The consumption footprint counts emissions from what people in Denmark buy, including emissions abroad from imported goods, and leaves out emissions from goods made here for export.`,
      says: `From ${FROM} to ${cy} real GDP ${chg(dG)}, emissions on Danish soil ${chg(dT)} and the consumption footprint ${chg(dF)}.`,
      source: 'DST NAN1 (GDP), DRIVHUS2 via eco.json (territorial), consumption footprint via eco.json, FOLK1A (population)',
    });

    const cB = g3.appendChild(card('s5', `${better.length} of ${pts.length} measures are better than ten years ago`,
      'Measures better or worse than ten years before, by theme', 'tall'));
    V2.chart(cB.querySelector('.chart'), p => Object.assign(V2.base(p), {
      grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: p.ink2, fontSize: 11 } },
      tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: ps2 => { const t = T[THEMES[ps2[0].dataIndex].page];
          return `<b>${t.name}</b><br>Better: ${list(t.better.map(d => d.label)) || '—'}<br>Worse: ${list(t.worse.map(d => d.label)) || '—'}`; } }),
      yAxis: V2.axis(p, { type: 'category', inverse: true, data: THEMES.map(t => t.name.split(' ')[0]), axisLine: { show: false }, axisLabel: { color: p.ink2, fontSize: 11.5 } }),
      xAxis: V2.axis(p, { type: 'value', minInterval: 1, axisLabel: { color: p.ink3, fontSize: 11 } }),
      series: [
        { name: 'Better', type: 'bar', stack: 'n', barMaxWidth: 26, data: THEMES.map(t => T[t.page].better.length), itemStyle: { color: p.green },
          label: { show: true, color: '#fff', fontSize: 11, fontWeight: 600, formatter: o => o.value || '' } },
        { name: 'Worse', type: 'bar', stack: 'n', data: THEMES.map(t => T[t.page].worse.length), itemStyle: { color: p.red, borderRadius: [0, 3, 3, 0] },
          label: { show: true, color: '#fff', fontSize: 11, fontWeight: 600, formatter: o => o.value || '' } },
      ],
    }));
    const worseAll = pts.filter(d => d.ch <= 0);
    addInsight(cB, `Worse than ten years ago: ${list(worseAll.map(d => d.label))}.`);
    V2.info(cB, {
      what: `For each theme, how many measures have a better latest value than ten years before (or than their first year, for short series). Klimaloven emissions are not counted here; they are on the Ecological card in row 1.`,
      says: THEMES.map(t => `${t.name}: ${T[t.page].better.length} better, ${T[t.page].worse.length} worse.`).join(' '),
      source: 'data/v2/indicators.json',
    });

    // ── Row 4: where to look first ───────────────────────────────────────
    root.appendChild(rowLabel(4, 'Act', 'Where to look first?'));
    const g4 = root.appendChild(V2.el('<div class="grid"></div>'));
    const act = pts.filter(d => d.q === Q.act), slip = pts.filter(d => d.q === Q.slip);
    const tenY = h.latest_year - 10;
    const lead = `
      <tr>
        <td>Emissions on Danish soil (Klimaloven)<div class="eta">Needed ${V2.signed(pc.required_pct)} % per year to ${pc.target_year}; achieved ${V2.signed(pc.actual_pct)} % per year since ${pc.trend_from}</div></td>
        <td class="num">${f(h.latest, 1)} Mt<div class="eta">${h.latest_year}</div></td>
        <td class="num">${ghg[tenY] != null ? `${f(ghg[tenY], 1)} Mt<div class="eta">${tenY}</div>` : '—'}</td>
        <td class="q ${{ red: 'act', amber: 'warn', green: 'ok' }[T.eco.tone]}">${T.eco.text}</td>
      </tr>`;
    const cA = g4.appendChild(V2.el(`
      <div class="card s7"><h3>${T.eco.tone === 'green' ? 'Climate target on track' : 'Start with the 2030 climate gap'}${act.length ? `, then ${list(act.map(d => low(d.label)))}` : ''}</h3>
        <div class="sub">The climate target, then every measure that is worse than ten years ago</div>
        ${V2.recordWatch(pts, { only: [Q.act, Q.slip], lead })}
        <div class="note">Only the first row has an official target and a required pace. The other rows compare each measure with its own record since ${FROM}: act now = lower half of its range and worse than ten years ago; slipping = upper half but worse.</div>
      </div>`));
    V2.info(cA, {
      what: 'The list of things that are getting worse, most urgent first. The first row is the Klimaloven gap with the yearly cut needed from now to 2030 and the yearly cut achieved over the trend period. The other rows come from the quadrant on each theme page.',
      says: `${I.paceTitle(pc)}. ${act.length ? `${list(act.map(d => d.label))} ${act.length > 1 ? 'are' : 'is'} near ${act.length > 1 ? 'their' : 'its'} worst and still getting worse.` : 'No other measure is near its worst and getting worse.'}${slip.length ? ` ${list(slip.map(d => d.label))} ${slip.length > 1 ? 'are' : 'is'} slipping from near ${slip.length > 1 ? 'their' : 'its'} best.` : ''}`,
    });

    const nb = pts.filter(d => d.q === Q.best).sort((a, b) => b.pos - a.pos), rec = pts.filter(d => d.q === Q.rec).sort((a, b) => a.pos - b.pos);
    const item = d => `<li><b>${d.label}</b>: ${d.fv(d.h.latest)} in ${d.h.last}${atBest(d) ? `, the best since ${d.h.first}` : `; best ${d.fv(d.h.best)} in ${d.h.bestY}`}.</li>`;
    const cG = g4.appendChild(V2.el(`
      <div class="card s5"><h3>${nb.length} measures are near their best and still improving</h3>
        <div class="sub">What is going well, and what is coming back from a low</div>
        <div class="info-k" style="margin-top:14px">Near best</div>
        <ul class="pull">${nb.map(item).join('')}</ul>
        ${rec.length ? `<div class="info-k" style="margin-top:8px">Recovering from near the worst</div><ul class="pull">${rec.map(item).join('')}</ul>` : ''}
      </div>`));
    V2.info(cG, {
      what: 'Near best = in the upper half of its own range since 2008 and better than ten years ago. Recovering = in the lower half but better than ten years ago.',
      says: `${nb.length} measures are near their best and ${rec.length} ${rec.length === 1 ? 'is' : 'are'} recovering.`,
    });
  };
})(window.V2);
