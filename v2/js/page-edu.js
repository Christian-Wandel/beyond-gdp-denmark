/* Education page. No official target exists for the NEET rate, so status and
   trend compare it with Denmark's own record since 2008. */
window.V2 = window.V2 || {};
V2.pages = V2.pages || {};

(function (V2) {
  const SHORT = {
    neet: 'NEET 16–24', learning_outcomes: 'Grade average', life_satisfaction: 'Pupil wellbeing',
    transition: 'Not started after 1 yr', class_size: 'Class size', education_share: 'Tertiary share',
    folkeskole_funding: 'Funding per pupil',
  };
  V2.names = Object.assign(V2.names || {}, SHORT);
  const KPI_WHAT = {
    learning_outcomes: '9th-grade average in the binding exams (bundne prøver), on the Danish 7-point grade scale. Source: uddannelsesstatistik.dk.',
    life_satisfaction: 'Average answer to the general wellbeing questions in the national pupil wellbeing survey (trivselsmåling), on a 1–5 scale. Source: uddannelsesstatistik.dk.',
    transition: 'Share of pupils who leave grundskole and have not started any further education one year later. A lower value is better.',
    class_size: 'Average number of pupils per class in the folkeskole. A lower value is better.',
  };
  // Cascade nodes shown in the lever card. dir = which way is good.
  const NODES = [
    { id: 'learning_outcomes', label: 'Grades', dir: 1 },
    { id: 'neet', label: 'NEET rate', dir: -1 },
    { id: 'unemployment', label: 'Adult unemployment', dir: -1 },
    { id: 'income', label: 'Adult income', dir: 1 },
    { id: 'life_satisfaction', label: 'Life satisfaction', dir: 1 },
    { id: 'gini', label: 'Income inequality', dir: -1 },
  ];
  const CONF = { high: 'Strong', med: 'Medium', low: 'Weak' };
  const PRESETS = [-10, 0, 10, 20];

  const rowLabel = (n, title, q) => V2.el(`<div class="row-label">${n} · ${title} <span>${q}</span></div>`);
  const card = (cls, title, sub, chartCls = '') => V2.el(`
    <div class="card ${cls}"><h3>${title}</h3><div class="sub">${sub}</div><div class="chart ${chartCls}"></div></div>`);
  const addInsight = (c, text, tone = '') => c.appendChild(V2.el(`<div class="insight ${tone}">${text}</div>`));
  const addNote = (c, text) => c.appendChild(V2.el(`<div class="note">${text}</div>`));
  const f = V2.fmt;
  const getJSON = p => fetch(p).then(r => r.json());

  V2.pages.edu = async function (root) {
    const [edu, ind, rel, ut] = await Promise.all([V2.load('edu'), V2.load('indicators'),
      getJSON('../data/relationships.json'), getJSON('../data/unit_translations.json').catch(() => null)]);
    const h = edu.hero, pc = edu.pace, I = V2.insights;
    const yr = String(h.latest_year);
    const byId = Object.fromEntries(ind.indicators.map(i => [i.id, i]));
    document.getElementById('crumb-data').textContent = `data to ${yr}`;

    const HN = I.record({ series: h.series, direction: 'lower_better' }, 2008);
    root.appendChild(V2.el(`<h1 class="page">${f(h.latest, 1)} % of 16–24 year-olds are not in education or work. ` +
      (HN.last === HN.bestY ? `That is the lowest rate since ${HN.first}.`
        : `That is ${HN.improved ? 'lower' : 'higher'} than in ${HN.tenY} (${f(HN.ten, 1)} %) but above the ${HN.bestY} low of ${f(HN.best, 1)} %.`) + '</h1>'));
    root.appendChild(V2.el(`<p class="lede">There is no official target for this rate. The page compares it with Denmark's own record since ${HN.first}.</p>`));

    // ── Row 1: where is it against its own record? ───────────────────────
    root.appendChild(rowLabel(1, 'Status', 'Where is the rate against its own record?'));
    const g1 = root.appendChild(V2.el('<div class="grid"></div>'));
    const rv = edu.regions.values, rn = edu.regions.names;
    const regs = Object.keys(rn).filter(k => k !== '000').sort((a, b) => rv[b]['00'] - rv[a]['00']);
    const [hiR, loR] = [regs[0], regs[regs.length - 1]];
    const tone = HN.last === HN.bestY ? 'green' : HN.improved ? 'amber' : 'red';
    const heroCard = g1.appendChild(V2.hero({
      label: `Young people aged 16–24 not in education, employment or training, ${yr} · DST NEET4`,
      value: f(h.latest, 1), unit: '%', status: tone,
      statusText: HN.last === HN.bestY ? `Lowest since ${HN.first}` : HN.improved ? `Below ${HN.tenY}, above the ${HN.bestY} low` : `Higher than in ${HN.tenY}`,
      stats: [[`Lowest since ${HN.first}`, `${f(HN.best, 1)} % (${HN.bestY})`],
              ['Ten years earlier', `${f(HN.ten, 1)} % (${HN.tenY})`],
              ['Men / women', `${f(rv['000'].M, 1)} / ${f(rv['000'].K, 1)} %`],
              ['Highest region', `${rn[hiR]} ${f(rv[hiR]['00'], 1)} %`]],
      scale: [0, 14],
      bands: [[HN.best, HN.worst, 'var(--grey-3)']],
      bar: h.latest, barLabel: `<b>${f(h.latest, 1)} %</b> now`,
      target: HN.best, targetLabel: `<b>${f(HN.best, 1)} %</b> low, ${HN.bestY}`,
      proj: HN.ten, projLabel: `${f(HN.ten, 1)} % in ${HN.tenY}`,
      aria: `NEET rate ${f(h.latest, 1)} percent; lowest since ${HN.first} ${f(HN.best, 1)} percent in ${HN.bestY}; ${f(HN.ten, 1)} percent in ${HN.tenY}`,
      insight: `The grey band is the range since ${HN.first}: from ${f(HN.best, 1)} % (${HN.bestY}) to ${f(HN.worst, 1)} % (${HN.worstY}). ` +
        `Since ${pc.trend_from} the rate fell ${f(Math.abs(pc.actual_pct), 1)} % a year on average.`,
    }));
    V2.info(heroCard, {
      what: `The share of all 16–24 year-olds who are neither in education nor in work. The grey band is the range Denmark has had since ${HN.first}. The bar is today's rate (shorter is better), the black line the lowest year, the dotted line the rate ten years earlier. No target is used: none is set in law or policy.`,
      says: `The rate is ${f(h.latest, 1)} %, ${f(h.latest - HN.best, 1)} points above the ${HN.bestY} low. ${rn[hiR]} is highest at ${f(rv[hiR]['00'], 1)} %, ${rn[loR]} lowest at ${f(rv[loR]['00'], 1)} %.`,
      source: 'DST NEET4, ages 16–24, all of Denmark',
    });

    const kpis = [
      { i: byId.learning_outcomes, unit: 'grade', sub: '9th-grade exams, 7-point scale', fv: v => f(v, 1) },
      { i: byId.life_satisfaction, unit: 'of 5', sub: 'Pupil wellbeing survey, general', fv: v => f(v, 2) },
      { i: byId.transition, unit: '%', sub: 'Grundskole leavers not in education 1 yr later', fv: v => f(v, 1) + ' %' },
      { i: byId.class_size, unit: 'pupils', sub: 'Average folkeskole class', fv: v => f(v, 1) },
    ];
    const sparks = kpis.map(k => {
      const [lvl, verdict] = I.recordVerdict(k.i, 2008);
      const c = V2.kpi({ label: SHORT[k.i.id], sub: k.sub, value: k.i.latest, unit: k.unit,
        series: k.i.series, direction: k.i.direction, level: lvl, verdict });
      V2.info(c, { what: KPI_WHAT[k.i.id], says: I.recordSays(k.i, SHORT[k.i.id], k.fv, 2008),
        source: k.i.id === 'learning_outcomes' || k.i.id === 'life_satisfaction' ? 'uddannelsesstatistik.dk' : 'Danmarks Statistik' });
      return g1.appendChild(c);
    });
    sparks.forEach(c => c._spark(c.querySelector('.spark')));

    // ── Row 2: trend ─────────────────────────────────────────────────────
    root.appendChild(rowLabel(2, 'Trend', 'How has the rate moved?'));
    const g2 = root.appendChild(V2.el('<div class="grid"></div>'));
    const rebound = HN.last !== HN.bestY && HN.bestY > HN.tenY;
    const cPace = g2.appendChild(card('s7',
      HN.last === HN.bestY ? `The NEET rate is at its lowest since ${HN.first}`
        : `The NEET rate fell from ${f(HN.ten, 1)} % in ${HN.tenY} to ${f(h.latest, 1)} %` + (rebound ? `, but it is above its ${HN.bestY} low` : ''),
      'NEET rate, % of 16–24 year-olds', 'tall'));
    addInsight(cPace, `Average change since ${pc.trend_from}: ${V2.signed(pc.actual_pct)} % a year.`);
    V2.paceLine(cPace.querySelector('.chart'), { series: h.series, target: null }, { ...pc, target_year: pc.latest_year }, '%');
    V2.info(cPace, {
      what: `The NEET rate each year since ${HN.first}. No target line and no projection are drawn, because no official target exists.`,
      says: `The rate was ${f(HN.worst, 1)} % at its highest (${HN.worstY}) and ${f(HN.best, 1)} % at its lowest (${HN.bestY}). Since ${pc.trend_from} it fell ${f(Math.abs(pc.actual_pct), 1)} % a year on average (a relative change: 1 % of 9 % is about 0.1 points).`,
    });

    const ch = pc.annual_changes, chY = Object.keys(ch);
    const fell = chY.filter(y => ch[y] < 0);
    const bigFall = chY.reduce((a, b) => (ch[b] < ch[a] ? b : a)), bigRise = chY.reduce((a, b) => (ch[b] > ch[a] ? b : a));
    const cHist = g2.appendChild(card('s5', `The rate fell in ${fell.length} of ${chY.length} years`,
      'Each bar counts years by their % change from the year before. Blue = the rate fell.', 'tall'));
    addInsight(cHist, `The largest fall was ${f(ch[bigFall], 0)} % in ${bigFall}, the largest rise ${V2.signed(ch[bigRise], 0)} % in ${bigRise}.`);
    V2.changeHistogram(cHist.querySelector('.chart'), { annual_changes: ch, lowerIsBetter: true });
    V2.info(cHist, {
      what: `Every year since ${chY[0]} is sorted by how much the rate changed from the year before. Blue years: the rate fell. Grey years: it rose or stayed the same.`,
      says: `The rate fell in ${fell.length} years and rose or held in ${chY.length - fell.length}. The rises are fewer but some are large, so a few bad years undo several good ones.`,
    });

    // ── Row 3: where it comes from ───────────────────────────────────────
    root.appendChild(rowLabel(3, 'Sources', 'Where is the gap concentrated?'));
    const g3 = root.appendChild(V2.el('<div class="grid"></div>'));
    const menHigher = regs.filter(k => rv[k].M > rv[k].K);
    const cReg = g3.appendChild(card('s7',
      `${rn[hiR]} has the highest NEET rate: ${f(rv[hiR]['00'], 1)} %, ${f(rv[hiR]['00'] - rv[loR]['00'], 1)} points above ${rn[loR]}`,
      `NEET rate by region and sex, ${yr}, % of 16–24 year-olds`, 'tall'));
    V2.chart(cReg.querySelector('.chart'), p => Object.assign(V2.base(p), {
      grid: { left: 8, right: 40, top: 48, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: p.ink2, fontSize: 11 } },
      tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow' },
        valueFormatter: v => f(v, 1) + ' %' }),
      yAxis: V2.axis(p, { type: 'category', inverse: true, data: regs.map(k => rn[k]),
        axisLabel: { color: p.ink2, fontSize: 11.5 } }),
      xAxis: V2.axis(p, { type: 'value', min: 0, axisLabel: { color: p.ink3, fontSize: 11, formatter: v => v + ' %' } }),
      series: [
        { name: 'Young men', type: 'bar', data: regs.map(k => rv[k].M), itemStyle: { color: p.accent, borderRadius: 2 },
          barGap: '15%', label: { show: true, position: 'right', color: p.ink2, fontSize: 10.5, fontFamily: p.mono, formatter: o => f(o.value, 1) },
          markLine: { symbol: 'none', silent: true, data: [
            { xAxis: rv['000']['00'], lineStyle: { color: p.ink3, type: 'dashed', width: 1.5 },
              label: { formatter: `Denmark ${f(rv['000']['00'], 1)}`, color: p.ink2, fontSize: 11, position: 'start' } },
          ] } },
        { name: 'Young women', type: 'bar', data: regs.map(k => rv[k].K), itemStyle: { color: '#4E9AA6', borderRadius: 2 },
          label: { show: true, position: 'right', color: p.ink2, fontSize: 10.5, fontFamily: p.mono, formatter: o => f(o.value, 1) } },
      ],
    }));
    addInsight(cReg, `Young men are more often NEET than young women in ${menHigher.length} of ${regs.length} regions` +
      (menHigher.length < regs.length ? ` (not in ${regs.filter(k => !menHigher.includes(k)).map(k => rn[k]).join(', ')}).` : '.'));
    V2.info(cReg, {
      what: 'The NEET rate in each of the five regions, split into young men and young women. The dashed line is the rate for all of Denmark.',
      says: `The spread between regions is ${f(rv[hiR]['00'] - rv[loR]['00'], 1)} points, larger than the ${f(Math.abs(rv['000'].M - rv['000'].K), 1)}-point gap between men and women nationally.`,
      source: 'DST NEET4, by region and sex',
    });

    const at = edu.attainment, al = at.latest;
    const atYrs = Object.keys(at.series).map(Number).sort((a, b) => a - b);
    const atLast = String(atYrs[atYrs.length - 1]), atFirst = String(atYrs[0]);
    const cAt = g3.appendChild(card('s5',
      `${f(al.below_upper_secondary, 0)} % of adults stop below upper secondary, down from ${f(at.series[atFirst].below_upper_secondary, 0)} % in ${atFirst}`,
      `Highest completed education, population 15–69, ${atLast}`, 'tall'));
    V2.donut(cAt.querySelector('.chart'), [
      { name: 'Tertiary', value: al.tertiary },
      { name: 'Upper secondary', value: al.upper_secondary, color: '#4E9AA6' },
      { name: 'Grundskole only', value: al.below_upper_secondary, color: '#B9BCC3' },
    ], '%', [f(al.tertiary, 0) + ' %', 'tertiary']);
    V2.info(cAt, {
      what: 'Adults aged 15–69 by their highest completed education: below upper secondary (grundskole only), upper secondary (gymnasium or vocational) and tertiary (any higher education). The age range includes 15–19 year-olds who are still in school.',
      says: `Since ${atFirst} the tertiary share rose from ${f(at.series[atFirst].tertiary, 0)} % to ${f(al.tertiary, 0)} %, and the share below upper secondary fell by ${f(at.series[atFirst].below_upper_secondary - al.below_upper_secondary, 0)} points. NEET has fallen far less in the same time.`,
      source: 'DST HFUDD11',
    });

    // Region trend: does the ranking hold over time?
    const rs = edu.regions.series;
    const tYrs = Object.keys(rs['000']['00']).map(Number).sort((a, b) => a - b);
    const topCount = {};
    tYrs.forEach(y => { const top = regs.reduce((a, b) => (rs[b]['00'][y] > rs[a]['00'][y] ? b : a)); topCount[top] = (topCount[top] || 0) + 1; });
    const lead = Object.keys(topCount).reduce((a, b) => (topCount[b] > topCount[a] ? b : a));
    const cRt = g3.appendChild(card('s6', `${rn[lead]} had the highest rate in ${topCount[lead]} of ${tYrs.length} years`,
      `NEET rate by region, ${tYrs[0]}–${yr}, %`, 'tall'));
    V2.chart(cRt.querySelector('.chart'), p => Object.assign(V2.base(p), {
      grid: { left: 8, right: 16, top: 56, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 14, itemHeight: 2, textStyle: { color: p.ink2, fontSize: 11 } },
      tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'axis', valueFormatter: v => f(v, 1) + ' %' }),
      xAxis: V2.axis(p, { type: 'category', data: tYrs.map(String), boundaryGap: false,
        axisLabel: { color: p.ink3, fontSize: 11, interval: 3 }, splitLine: { show: false } }),
      yAxis: V2.axis(p, { type: 'value', scale: true, axisLabel: { color: p.ink3, fontSize: 11, formatter: v => v + ' %' } }),
      series: ['000', ...regs].map(k => ({
        name: rn[k], type: 'line', symbol: 'none', data: tYrs.map(y => rs[k]['00'][y]),
        lineStyle: { width: k === '000' ? 3 : k === lead ? 2.2 : 1.4, type: k === '000' ? 'solid' : 'solid',
          color: k === '000' ? p.accent : k === lead ? p.red : p.g1 },
        itemStyle: { color: k === '000' ? p.accent : k === lead ? p.red : p.g1 },
        z: k === '000' ? 3 : k === lead ? 2 : 1,
      })),
    }));
    V2.info(cRt, {
      what: `The NEET rate in each region from ${tYrs[0]} to ${yr}. Blue is all of Denmark, red the region that was highest most often, grey the other regions.`,
      says: `All regions moved up and down together, including the dip in 2020–2021 and the rise after it. ${rn[lead]} was highest in ${topCount[lead]} of ${tYrs.length} years, so the regional gap is lasting, not a one-year result.`,
      source: 'DST NEET4',
    });

    const fs = edu.funding_split;
    const k = v => v / 1000;
    const ppCh = 100 * (fs.per_pupil_end / fs.per_pupil_start - 1);
    const cF = g3.appendChild(card('s6',
      fs.terms.more_money < 0
        ? `Funding per pupil rose ${f(ppCh, 0)} % since ${fs.from} only because there are fewer pupils`
        : `Funding per pupil rose ${f(ppCh, 0)} % since ${fs.from}`,
      `Folkeskole spending per pupil, ${fs.from} to ${fs.to}, thousand kr (2024 prices)`, 'tall'));
    V2.waterfall(cF.querySelector('.chart'), { label: `Per pupil ${fs.from}`, value: k(fs.per_pupil_start) }, [
      { label: 'Real spending change', value: k(fs.terms.more_money) },
      { label: 'Fewer pupils', value: k(fs.terms.fewer_pupils) },
    ], { label: `Per pupil ${fs.to}`, value: k(fs.per_pupil_end) }, 'k kr', { lowerIsGood: false, min: 90 });
    addNote(cF, 'The axis starts at 90 thousand kr so the changes are visible. Green = adds to funding per pupil, red = takes away.');
    V2.info(cF, {
      what: `Public spending per folkeskole pupil in ${fs.from} and ${fs.to}, in 2024 prices. The middle bars split the change into two causes: total real spending (the money) and the number of pupils. Fewer pupils means the same money goes further.`,
      says: `Spending per pupil rose by ${f(fs.per_pupil_end - fs.per_pupil_start, 0)} kr. Fewer pupils added ${f(fs.terms.fewer_pupils, 0)} kr, while total real spending ${fs.terms.more_money < 0 ? 'fell' : 'rose'} and ${fs.terms.more_money < 0 ? 'took away' : 'added'} ${f(Math.abs(fs.terms.more_money), 0)} kr.`,
      source: 'DST UOE1 spending, UDDAKT20 pupils, NAHC1 deflator; LMDI split',
    });

    // ── Row 4: levers ────────────────────────────────────────────────────
    root.appendChild(rowLabel(4, 'Levers', 'What can be pulled, and where first?'));
    const g4 = root.appendChild(V2.el('<div class="grid"></div>'));
    const edges = rel.edges.filter(e => e.cascade === 'education');
    const leverId = rel.cascades.education.lever;
    const pupils = ut ? ut.baselines.total_pupils : null;
    const perPupil = byId.folkeskole_funding.latest;
    const incomeBase = byId.income ? byId.income.latest : null;
    let pct = 10;

    // Walk back from a node to the lever along the dominant edges: total lag and weakest link.
    const pathOf = (dom, id) => {
      const path = [];
      for (let n = id, guard = 0; n !== leverId && dom[n] && guard < 10; n = dom[n].from, guard++) path.unshift(dom[n]);
      return path;
    };
    const run = () => {
      const { deltas, dominantEdge } = propagateCascade(edges, leverId, pct / 100);
      return NODES.map(n => {
        const path = pathOf(dominantEdge, n.id);
        const confs = path.map(e => e.confidence);
        const weakest = confs.includes('low') ? 'low' : confs.includes('med') ? 'med' : 'high';
        return { ...n, better: (deltas[n.id] || 0) * n.dir * 100, lag: path.reduce((s, e) => s + e.lag_years, 0),
          weakest, draft: path.some(e => e.draft), steps: path.length };
      });
    };

    const cLev = g4.appendChild(V2.el(`
      <div class="card s7 levers">
        <h3 class="lv-title"></h3>
        <div class="sub">Change per-pupil folkeskole funding from today's ${f(perPupil, 0)} kr. The bars show how far each outcome moves in the cascade model, toward better (green) or worse (red).</div>
        <div class="presets">${PRESETS.map(v => `<button type="button" data-v="${v}">${v === 0 ? 'Today' : V2.signed(v, 0) + ' %'}</button>`).join('')}</div>
        <div class="lv-ctl" style="margin-top:14px">
          <div class="lv-track" style="padding-bottom:0"><input type="range" min="-20" max="20" step="5" value="${pct}" aria-label="Change in funding per pupil, percent"></div>
          <span class="lv-pct" style="margin-bottom:0"></span>
        </div>
        <div class="gap-nums lv-cost" style="margin-top:12px"></div>
        <div class="chart"></div>
        <div class="lv-trans"></div>
        <div class="note">The bars are the cascade model's illustrative impact index (×100), not forecasts in real units: edge strengths are a qualitative 0–1 ordering. The model gives direction and relative size only, so it does not move the NEET hero above. <a href="../index.html#section-cascade" style="color:var(--accent)">See the full cascade</a>.</div>
      </div>`));
    const effChart = V2.chart(cLev.querySelector('.chart'), p => {
      const rows = run();
      return Object.assign(V2.base(p), {
        animationDurationUpdate: 400,
        grid: { left: 132, right: 80, top: 8, bottom: 24 },
        tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow' },
          formatter: ps => { const r = rows[ps[0].dataIndex];
            return `<b>${r.label}</b><br>Impact index ${V2.signed(r.better, 1)} (${r.better >= 0 ? 'better' : 'worse'})<br>` +
              `Shows after about ${r.lag} years · ${r.steps} step${r.steps === 1 ? '' : 's'} from funding<br>Evidence: ${CONF[r.weakest]}${r.draft ? ', draft link' : ''}`; } }),
        yAxis: V2.axis(p, { type: 'category', inverse: true, data: rows.map(r => r.label),
          axisLabel: { color: p.ink2, fontSize: 11.5 } }),
        xAxis: V2.axis(p, { type: 'value', min: -12, max: 12, axisLabel: { color: p.ink3, fontSize: 11 } }),
        series: [{
          type: 'bar', barMaxWidth: 18,
          data: rows.map(r => ({ value: r.better, itemStyle: { color: r.better >= 0 ? p.green : p.red, borderRadius: 2 } })),
          label: { show: true, position: 'right', color: p.ink2, fontSize: 10.5, fontFamily: p.mono,
            formatter: o => `${V2.signed(o.value, 1)} · ${rows[o.dataIndex].lag} yrs` },
          markLine: { symbol: 'none', silent: true, lineStyle: { color: p.ink3, width: 1 }, label: { show: false }, data: [{ xAxis: 0 }] },
        }],
      });
    });
    let levSays;
    const refresh = () => {
      const rows = run();
      const cost = pupils ? pupils * perPupil * pct / 100 : null;
      cLev.querySelector('.lv-title').textContent = pct === 0 ? 'Funding per pupil: pick a change'
        : `If funding per pupil ${pct > 0 ? 'rises' : 'falls'} ${f(Math.abs(pct), 0)} %`;
      const inp = cLev.querySelector('input');
      inp.value = pct;
      inp.style.setProperty('--v', (100 * (pct + 20) / 40) + '%');
      cLev.querySelector('.lv-pct').textContent = V2.signed(pct, 0) + ' %';
      cLev.querySelectorAll('.presets button').forEach(b => b.classList.toggle('active', +b.dataset.v === pct));
      cLev.querySelector('.lv-cost').innerHTML = `
        <div>Per pupil<b>${f(perPupil * (1 + pct / 100), 0)} kr</b></div>
        <div>${pct >= 0 ? 'Extra cost' : 'Saving'} per year<b>${cost == null ? '—' : f(Math.abs(cost) / 1e9, 1) + ' bn kr'}</b></div>
        <div>First effect<b>${pct ? Math.min(...rows.map(r => r.lag)) + ' yrs' : '—'}</b></div>`;
      const tr = pct && ut && incomeBase && typeof translateNode === 'function'
        ? ['income', 'unemployment'].map(id => translateNode(id, pct, ut, incomeBase)).filter(Boolean) : [];
      cLev.querySelector('.lv-trans').innerHTML = tr.length
        ? `<div class="insight">${tr.map(t => t.headline).join(' ')}</div><div class="note">${tr[0].caveats[0]}</div>` : '';
      const neet = rows.find(r => r.id === 'neet'), inc = rows.find(r => r.id === 'income');
      if (levSays) levSays(pct
        ? `A ${V2.signed(pct, 0)} % change costs ${pct > 0 ? '' : 'saves '}about ${f(Math.abs(cost) / 1e9, 1)} bn kr a year. In the model the NEET rate moves first (${neet.lag} years), adult income only after ${inc.lag} years. The funding → NEET link is rated ${CONF[neet.weakest].toLowerCase()} and still a draft: no study quantifies it directly.`
        : 'No change is selected, so nothing moves.');
      V2.update(effChart);
    };
    cLev.querySelectorAll('.presets button').forEach(b => b.addEventListener('click', () => { pct = +b.dataset.v; refresh(); }));
    cLev.querySelector('input').addEventListener('input', e => { pct = +e.target.value; refresh(); });
    levSays = V2.info(cLev, {
      what: 'A what-if on the education cascade of the current dashboard. The slider changes per-pupil funding by −20 % to +20 %. The engine passes that push along each link (funding → grades → income, funding → NEET → income, and so on) by the link\'s strength. Each bar shows how far an outcome moves, and the label shows after how many years. The cost line uses today\'s funding per pupil × all public grundskole pupils.',
      says: '',
      source: 'js/cascade-engine.js on data/relationships.json; real-unit sentences from js/cascade-translate.js',
    });

    // Evidence behind the links from the lever: strength, lag, confidence.
    const fromLever = edges.filter(e => e.from === leverId || ['learning_outcomes', 'neet'].includes(e.from))
      .filter(e => NODES.some(n => n.id === e.to) || e.to === 'learning_outcomes');
    const LBL = Object.fromEntries(NODES.map(n => [n.id, n.label]).concat([[leverId, 'Funding']]));
    const cEv = g4.appendChild(V2.el(`
      <div class="card s5">
        <h3>${fromLever.filter(e => e.draft).length} of ${fromLever.length} links on these paths are still drafts</h3>
        <div class="sub">The links the funding lever runs through, with strength, delay and evidence</div>
        <table class="watch">
          <thead><tr><th>Link</th><th>Strength</th><th>Delay</th><th>Evidence</th></tr></thead>
          <tbody>${fromLever.map(e => `
            <tr>
              <td>${LBL[e.from]} → ${LBL[e.to]}<div class="eta">${e.source.split(';')[0].replace(/\).*/, ')')}</div></td>
              <td class="num">${f(e.strength, 2)}</td>
              <td class="num">${e.lag_years} yrs</td>
              <td class="q ${e.confidence === 'high' ? 'ok' : e.confidence === 'med' ? 'warn' : 'act'}">${CONF[e.confidence]}${e.draft ? ' · draft' : ''}</td>
            </tr>`).join('')}</tbody>
        </table>
        <div class="note">Strength is a 0–1 ordering from the literature review, not a measured coefficient. "Draft" means the link still waits for source hardening.</div>
      </div>`));
    const weakLever = fromLever.filter(e => e.from === leverId);
    V2.info(cEv, {
      what: 'Each row is one cause-and-effect link in the cascade. Strength says how much of a change passes along the link (0–1). Delay is the expected years before the effect shows. Evidence is the confidence rating from the literature review; the grey line is the first cited source.',
      says: `The two links that start at funding are the weakest part of the chain: ${weakLever.map(e => `${LBL[e.to].toLowerCase()} (${f(e.strength, 2)}, ${CONF[e.confidence].toLowerCase()})`).join(' and ')}. The links after them, from grades to jobs and income, have strong evidence.`,
    });
    refresh();

    // Quadrant at half width, with its text twin beside it. Own record since 2008, no marks.
    const g5 = root.appendChild(V2.el('<div class="grid" style="margin-top:var(--gap)"></div>'));
    const pts = V2.recordPoints(ind.indicators.filter(i => i.theme === 'education'), SHORT, null, 2008);
    const cQ = g5.appendChild(card('s6', I.recordQuadrantTitle(pts), 'Latest value on its own range since 2008 vs its move in ten years', 'tall'));
    V2.recordQuadrant(cQ.querySelector('.chart'), pts);
    V2.info(cQ, { what: V2.recordInfo.quadrant(2008), says: I.recordQuadrantSays(pts) });
    const cW = g5.appendChild(V2.el(`
      <div class="card s6"><h3>Watch list: where to look first</h3>
        <div class="sub">Same measures as the chart, most urgent first</div>
        ${V2.recordWatch(pts)}
        <div class="note">Compares each measure with its own record since 2008, not with a target. Series that start later (grades 2011, wellbeing 2015, funding 2016) use their first year.</div>
      </div>`));
    V2.info(cW, { what: V2.recordInfo.watch, says: I.recordWatchSays(pts) });
  };
})(window.V2);
