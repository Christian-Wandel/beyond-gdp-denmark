/* Ecological limits page (pilot for the 4-row template). */
window.V2 = window.V2 || {};
V2.pages = V2.pages || {};

(function (V2) {
  const SECTOR_LABELS = {
    agriculture: 'Agriculture', energy_supply: 'Energy supply', households: 'Households',
    industry_extraction: 'Industry, extraction', transport: 'Transport in DK',
    services: 'Services', water_waste: 'Water and waste', construction: 'Construction',
    ships_planes_abroad: 'Ships and planes abroad', other_residual: 'Other',
  };
  const SHORT = {
    climate_footprint_pc: 'Climate footprint', material_flow_pc: 'Material use',
    water_abstraction: 'Water abstraction', green_gva: 'Green turnover',
  };
  V2.names = Object.assign(V2.names || {}, SHORT);
  const GAS_LABELS = { CO2UBIO: 'CO2', CH4: 'Methane', N2O: 'Nitrous oxide', FGAS: 'F-gases' };

  // Plain-language definitions for the KPI info buttons.
  const KPI_WHAT = {
    climate_footprint_pc: 'Greenhouse gases caused by what people in Denmark buy and use, including emissions abroad from imported goods, per person per year. Experimental DST series. The 4 t line is the dashboard\'s target anchor.',
    material_flow_pc: 'Tonnes of materials used by the Danish economy per person per year: crops, wood, sand, stone, metals and fossil fuels (domestic material consumption). The 13 t line is the EU circular-economy anchor.',
    renew: 'Share of Danish energy supply from wind, sun, biomass, biogas, heat pumps and other renewables. Derived from DST ENE2HO; crude oil is left out because it is counted again as refined fuel.',
    green_gva: 'Turnover of Danish companies that make green goods and services, in billion kroner (current prices). A higher value means a larger green economy.',
  };

  // Lever families, built on the model points in scenarios.json (id → Mt cut).
  // Private-car fuel sits in the DST households sector, so EVs share that colour.
  const LEVER_DEFS = (byScen) => [
    { id: 'ev', label: 'Electric cars', sector: 'households', goal: 30, goalLabel: '2030 goal',
      points: [[0, 0], [30, byScen.transport_ev_2030], [100, byScen.transport_full_ev]],
      note: 'Share of private-car petrol and diesel replaced by electricity.' },
    { id: 'hp', label: 'Heat pumps in homes', sector: 'households', goal: 50, goalLabel: 'Half',
      points: [[0, 0], [50, byScen.households_heat_partial], [100, byScen.households_heat_pumps]],
      note: 'Share of gas boilers and oil heating in homes replaced.' },
    { id: 'agri', label: 'Farm heating', sector: 'agriculture',
      points: [[0, 0], [100, byScen.agriculture_fossil_heating]],
      note: 'Greenhouse and farm-building oil heating to heat pumps and solar heat.' },
    { id: 'coal', label: 'Coal out of industry', sector: 'industry_extraction', goal: 100, goalLabel: 'Ban',
      points: [[0, 0], [100, byScen.industry_coal_to_biomass]],
      note: 'Coal and coke in manufacturing replaced by wood chips.' },
  ];
  const LEVER_PRESETS = [
    { label: 'None', values: {} },
    { label: 'Klimaloven 2030 package', values: { ev: 30, hp: 50, coal: 100 } },
    { label: 'Everything at 100 %', values: { ev: 100, hp: 100, agri: 100, coal: 100 } },
  ];

  const rowLabel = (n, title, q) => V2.el(`<div class="row-label">${n} · ${title} <span>${q}</span></div>`);
  const card = (cls, title, sub, chartCls = '') => V2.el(`
    <div class="card ${cls}"><h3>${title}</h3><div class="sub">${sub}</div><div class="chart ${chartCls}"></div></div>`);
  const addInsight = (c, text, tone = '') => c.appendChild(V2.el(`<div class="insight ${tone}">${text}</div>`));
  const addNote = (c, text) => c.appendChild(V2.el(`<div class="note">${text}</div>`));
  const f = V2.fmt;

  V2.pages.eco = async function (root) {
    const [eco, ind] = await Promise.all([V2.load('eco'), V2.load('indicators')]);
    const h = eco.hero, pc = eco.pace, I = V2.insights;
    const yr = String(h.latest_year);
    document.getElementById('crumb-data').textContent = `data to ${yr}`;

    // Remaining distance in percentage points of 1990 emissions (70 % target − cut so far).
    const pointsLeft = h.target_reduction_pct - h.reduction_pct;
    root.appendChild(V2.el(`<h1 class="page">Emissions cut by ${f(h.reduction_pct, 0)} % since 1990. ` +
      `The last ${f(pointsLeft, 0)} points (${f(h.gap_mt, 0)} Mt) need ${f(pc.acceleration, 1)}× the reduction pace.</h1>`));
    root.appendChild(V2.el(`<p class="lede">The Klimaloven target is a 70 % cut by 2030, counted on Danish territory and including land use (LULUCF).</p>`));

    // ── Row 1: how bad is it? ────────────────────────────────────────────
    root.appendChild(rowLabel(1, 'Status', 'How far from the target?'));
    const g1 = root.appendChild(V2.el('<div class="grid"></div>'));
    const [tone, statusText] = I.heroStatus(h, pc);
    const projCut = 100 * (1 - pc.projected_at_target_year / h.base);
    const lev = { values: {}, effects: {}, total: 0 };
    const heroCard = g1.appendChild(V2.hero({
      label: `Territorial greenhouse gas emissions incl. land use, ${yr} · DST MRO2`,
      value: f(h.latest, 1), unit: 'Mt CO2-eq', status: tone, statusText,
      stats: [['Cut since 1990', f(h.reduction_pct, 1) + ' %'],
              ['2030 target', f(h.target, 1) + ' Mt'],
              ['Gap today', f(h.gap_mt, 1) + ' Mt'],
              ['Gap after levers', '—', 'lev']],
      scale: [0, 100],
      bands: [[0, h.target_reduction_pct, 'var(--grey-3)'], [h.target_reduction_pct, 100, 'var(--green-soft)']],
      bar: h.reduction_pct, barLabel: `<b>${f(h.reduction_pct, 0)} %</b> cut so far`,
      target: h.target_reduction_pct, targetLabel: `<b>${f(h.target_reduction_pct, 0)} %</b> target (2030)`,
      proj: projCut, projLabel: `${f(projCut, 0)} % at current pace`,
      aria: `Cut so far ${f(h.reduction_pct, 0)} percent, target 70 percent, current pace reaches ${f(projCut, 0)} percent`,
      insight: I.hero(h, pc),
    }));
    V2.info(heroCard, {
      what: `All greenhouse gases emitted on Danish territory in one year, in million tonnes of CO2-equivalent, including the net effect of land use and forests (LULUCF). This is how the Klimaloven counts: the target is ${f(h.target, 1)} Mt in 2030, 70 % below ${f(h.base, 1)} Mt in 1990. The bar shows the cut so far, the dotted line where the last ${pc.latest_year - pc.trend_from} years' pace leads, and the black line the target.`,
      says: `Denmark has cut ${f(h.reduction_pct, 0)} % and must reach 70 % in ${pc.target_year - pc.latest_year} years. At today's pace it gets to about ${f(projCut, 0)} %, so it misses by roughly ${f(pc.projected_at_target_year - h.target, 1)} Mt.`,
      source: 'DST MRO2, item TOTLULU, greenhouse gases excl. CO2 from biomass',
    });

    const byId = Object.fromEntries(ind.indicators.map(i => [i.id, i]));
    const kpis = [
      { i: byId.climate_footprint_pc, unit: 't/person', sub: 'Consumption-based, incl. imports · target 4 t' },
      { i: byId.material_flow_pc, unit: 't/person', sub: 'Domestic material consumption · target 13 t' },
      { renew: true },
      { i: byId.green_gva, unit: 'bn kr', scale: 1 / 1000, decimals: 0, sub: 'Green goods and services turnover' },
    ];
    const sparks = [];
    kpis.forEach(k => {
      let c;
      if (k.renew) {
        const s = eco.renewable_share;
        const y = Object.keys(s).filter(y => +y <= h.latest_year).pop();
        const series = Object.fromEntries(Object.entries(s).filter(([yy]) => +yy >= 1990 && +yy <= +y));
        c = V2.kpi({ label: 'Renewable share of energy supply', sub: 'Derived from DST ENE2HO, crude oil double count removed',
          value: s[y], unit: '%', series, direction: 'higher_better', level: 'gray',
          verdict: '<b>No target set</b> in this dashboard' });
        V2.info(c, { what: KPI_WHAT.renew,
          says: `Renewables were ${f(s['1990'], 0)} % of supply in 1990 and ${f(s[y], 0)} % in ${y}. This shift is the main reason CO2 from fuel has fallen.`,
          source: 'DST ENE2HO, derived in prepare_v2.py' });
      } else {
        const sc = k.scale || 1;
        const series = Object.fromEntries(Object.entries(k.i.series).map(([y, v]) => [y, v * sc]));
        c = V2.kpi({ label: k.i.label, sub: k.sub, value: k.i.latest * sc, unit: k.unit, decimals: k.decimals,
          series, direction: k.i.direction, level: k.i.level, verdict: I.kpiVerdict(k.i) });
        V2.info(c, { what: KPI_WHAT[k.i.id], says: I.kpiSays(k.i, SHORT[k.i.id]), source: 'Danmarks Statistik, green national accounts' });
      }
      g1.appendChild(c);
      sparks.push(c);
    });
    sparks.forEach(c => c._spark(c.querySelector('.spark')));

    // ── Row 2: pace ──────────────────────────────────────────────────────
    root.appendChild(rowLabel(2, 'Pace', 'How much faster must Denmark go?'));
    const g2 = root.appendChild(V2.el('<div class="grid"></div>'));
    const cPace = g2.appendChild(card('s7', I.paceTitle(pc), 'Mt CO2-eq, territorial incl. land use', 'tall'));
    addInsight(cPace, I.pace(pc));
    const leverNote = cPace.appendChild(V2.el('<div class="note lever-note" hidden></div>'));
    const paceChart = V2.paceLine(cPace.querySelector('.chart'), h, pc, 'Mt', () => lev.total);
    V2.info(cPace, {
      what: `Blue: actual emissions each year. Red dashed: the path that reaches ${f(h.target, 1)} Mt in ${pc.target_year} with the same % cut every year. Grey dotted: where emissions go if the average pace of ${pc.trend_from}–${pc.latest_year} continues. Green appears when you pull a lever below.`,
      says: `Denmark must cut ${f(Math.abs(pc.required_pct), 1)} % a year but has averaged ${f(Math.abs(pc.actual_pct), 1)} %. At that pace it lands at ${f(pc.projected_at_target_year, 1)} Mt in ${pc.target_year}, above the target line.`,
    });

    const cHist = g2.appendChild(card('s5', I.histTitle(pc), 'Each bar counts years by their % change from the year before. Blue = fast enough.', 'tall'));
    const [ht, hs] = I.hist(pc);
    addInsight(cHist, hs, ht);
    V2.changeHistogram(cHist.querySelector('.chart'), pc);
    V2.info(cHist, {
      what: `Every year since 1991 is sorted by how much emissions changed from the year before (for example −4 % to −2 %). The bar height is the number of years in that range. The red line is the yearly cut needed from now to ${pc.target_year}.`,
      says: `Only ${pc.years_as_fast} of ${pc.years_total} years were as fast as the ${f(pc.required_pct, 1)} % now needed every year. Most years fell more slowly, and some rose.`,
    });

    // ── Row 3: where it comes from ───────────────────────────────────────
    root.appendChild(rowLabel(3, 'Sources', 'Where is the gap concentrated?'));
    const g3 = root.appendChild(V2.el('<div class="grid"></div>'));
    const gl = eco.gases.latest;
    const gasTot = Object.values(gl).reduce((a, b) => a + b, 0);
    const cGas = g3.appendChild(card('s5', I.gasTitle(gl), `Territorial emissions by gas, ${yr}, excl. land use`));
    const gasParts = Object.entries(gl).map(([k, v]) => ({ name: GAS_LABELS[k], value: v })).sort((a, b) => b.value - a.value);
    V2.donut(cGas.querySelector('.chart'), gasParts, 'Mt', [f(gasTot, 1), 'Mt CO2-eq']);
    V2.info(cGas, {
      what: 'Territorial emissions split by type of gas. Each gas is converted to CO2-equivalent by how strongly it warms the climate. CO2 comes mainly from burning fuel; methane and nitrous oxide come mainly from livestock, manure and fertiliser.',
      says: `Methane and nitrous oxide are ${f(100 * (gl.CH4 + gl.N2O) / gasTot, 0)} % of emissions (${f(gl.CH4 + gl.N2O, 1)} Mt). Energy levers such as electric cars and heat pumps do not touch this part.`,
    });

    const ss = eco.sectors.series;
    const years = Object.keys(ss.transport).map(Number).filter(y => y <= h.latest_year).sort((a, b) => a - b);
    const order = Object.keys(ss).filter(k => k !== 'ships_planes_abroad')
      .sort((a, b) => ss[b][yr] - ss[a][yr]);
    const cSec = g3.appendChild(card('s7', I.sector(ss, SECTOR_LABELS, yr).replace(/:.*$/, ''),
      'Direct emissions by sector, Mt CO2-eq, national-accounts basis without ships and planes abroad'));
    V2.stackedArea(cSec.querySelector('.chart'),
      order.map(k => ({ name: SECTOR_LABELS[k], series: ss[k], color: V2.sectorColor(k) })), years, 'Mt');
    addInsight(cSec, I.sector(ss, SECTOR_LABELS, yr));
    V2.info(cSec, {
      what: 'Emissions each sector releases directly, stacked to a total. Households include private cars and home heating. Danish ships and planes abroad are left out, because the Klimaloven does not count them. The total differs a little from the hero number because this table uses the national-accounts basis.',
      says: `Energy supply fell from ${f(ss.energy_supply['1990'], 1)} to ${f(ss.energy_supply[yr], 1)} Mt as coal left power plants. Agriculture moved much less (${f(ss.agriculture['1990'], 1)} to ${f(ss.agriculture[yr], 1)} Mt) and is now the largest block.`,
      source: 'DST DRIVHUS2, direct emissions; ships and planes abroad removed with MRO2',
    });

    const wf = eco.sectors.waterfall_1990_2024;
    const steps = Object.entries(wf.steps).filter(([, v]) => Math.abs(v) >= 0.05)
      .sort((a, b) => a[1] - b[1]).map(([k, v]) => ({ label: SECTOR_LABELS[k], value: v }));
    const cWf = g3.appendChild(card('s6', I.sectorTitle(wf, SECTOR_LABELS), `Change by sector, 1990 to ${yr}, Mt CO2-eq`, 'tall'));
    V2.waterfall(cWf.querySelector('.chart'), { label: '1990', value: wf.start }, steps, { label: yr, value: wf.end }, 'Mt',
      { horizontal: true });
    addNote(cWf, 'Same basis as the sector chart. Green = fell, red = rose.');
    V2.info(cWf, {
      what: `Start at 1990 emissions (top bar). Each sector bar shows how much that sector changed from 1990 to ${yr}. Green bars fell, red bars rose. Together they lead to the ${yr} total (bottom bar).`,
      says: `${I.sectorTitle(wf, SECTOR_LABELS)}. The other sectors together cut ${f(wf.start - wf.end + steps.find(s => s.label === 'Energy supply').value, 1)} Mt.`,
    });

    const k = eco.kaya['1990-2024'];
    const gdpGrowth = 100 * (k.factors[yr].gdp / k.factors['1990'].gdp - 1);
    const cK = g3.appendChild(card('s6', I.kayaTitle(k),
      `CO2 from burning coal, oil, gas and waste in Denmark, 1990 to ${yr}, Mt`, 'tall'));
    V2.waterfall(cK.querySelector('.chart'), { label: 'Fuel CO2 1990', value: k.co2_start }, [
      { label: 'Bigger economy', value: k.terms.gdp },
      { label: 'Less energy per krone', value: k.terms.energy_intensity },
      { label: 'Cleaner energy mix', value: k.terms.carbon_intensity },
    ], { label: `Fuel CO2 ${yr}`, value: k.co2_end }, 'Mt');
    addInsight(cK, I.kaya(k, gdpGrowth));
    V2.info(cK, {
      what: `Only CO2 from burning fuel (coal, oil, gas, waste) in Denmark: ${f(k.co2_start, 1)} Mt in 1990 and ${f(k.co2_end, 1)} Mt in ${yr}. Farming gases and industrial processes are not in it. The middle bars split the change into three causes: how much the economy grew, how much energy each krone of GDP needs, and how much CO2 each unit of energy gives.`,
      says: `The economy grew ${f(gdpGrowth, 0)} %, which alone would have added ${f(k.terms.gdp, 1)} Mt. Using less energy per krone (${V2.signed(k.terms.energy_intensity, 1)} Mt) and switching to wind and biomass (${V2.signed(k.terms.carbon_intensity, 1)} Mt) more than cancelled that.`,
      source: 'DST ENE2HO fuels × Danish Energy Agency 2024 emission factors; LMDI method',
    });

    const b = eco.bridge[yr];
    const cB = g3.appendChild(card('s12', I.bridgeTitle(b),
      `From the national accounts total to the Klimaloven count, ${yr}, Mt CO2-eq`, 'short'));
    V2.waterfall(cB.querySelector('.chart'), { label: 'National accounts', value: b.national_accounts }, [
      { label: 'Ships abroad', value: b.abroad_ships },
      { label: 'Planes abroad', value: b.abroad_planes },
      { label: 'Road abroad', value: b.abroad_road },
      { label: 'Other transport', value: b.other_transport_diff },
      { label: 'Land use (LULUCF)', value: b.lulucf },
    ], { label: 'Klimaloven count', value: b.territorial_incl_lulucf }, 'Mt', { neutral: true });
    addNote(cB, 'Blue bars are totals, grey bars are accounting steps. The old dashboard GHG series used the national-accounts basis, so it rose while the Klimaloven count fell.');
    V2.info(cB, {
      what: 'Two official totals for Danish emissions. The national accounts count everything Danish companies emit, also ships and planes operating abroad. The Klimaloven counts only what is emitted on Danish territory, plus land use. This chart shows the steps from one to the other.',
      says: `The national accounts total is ${f(b.national_accounts, 1)} Mt, but ${f(-b.abroad_ships, 1)} Mt of it comes from Danish ships sailing abroad. That is more than the whole Klimaloven count of ${f(b.territorial_incl_lulucf, 1)} Mt.`,
      source: 'DST MRO2 bridge table',
    });

    // ── Row 4: levers ────────────────────────────────────────────────────
    root.appendChild(rowLabel(4, 'Levers', 'What can be pulled, and where first?'));
    const g4 = root.appendChild(V2.el('<div class="grid"></div>'));
    const byScen = Object.fromEntries(eco.levers.items.map(i => [i.id, i.mt]));
    const defs = LEVER_DEFS(byScen);
    const gap = h.gap_mt;
    const packageMt = byScen.transport_ev_2030 + byScen.households_heat_partial + byScen.industry_coal_to_biomass;
    let gapChart, gapSays;
    const cGap = V2.el(`
      <div class="card s5 gapcard">
        <h3 class="gap-title"></h3>
        <div class="sub">The ${f(gap, 1)} Mt gap between ${yr} emissions and the 2030 target</div>
        <div class="chart gapbar"></div>
        <div class="gap-legend"></div>
        <div class="gap-nums">
          <div>Covered<b class="gn-cov">0.0 Mt</b></div>
          <div>Not covered<b class="gn-left">${f(gap, 1)} Mt</b></div>
          <div>Cut vs 1990<b class="gn-cut">${f(h.reduction_pct, 0)} %</b></div>
        </div>
        <div class="insight red gap-insight"></div>
      </div>`);
    const panel = V2.leverPanel(defs, LEVER_PRESETS, gap,
      `${eco.levers.missing} Agriculture emits ${f(ss.agriculture[yr], 1)} Mt, the largest sector on Danish soil.`,
      st => {
        Object.assign(lev, st);
        const left = Math.max(0, gap - st.total);
        const cut = 100 * (1 - (h.latest - st.total) / h.base);
        const share = 100 * Math.min(1, st.total / gap);
        cGap.querySelector('.gap-title').textContent = st.total ? `These levers close ${f(share, 0)} % of the gap` : 'No lever pulled yet';
        cGap.querySelector('.gn-cov').textContent = f(st.total, 1) + ' Mt';
        cGap.querySelector('.gn-left').textContent = f(left, 1) + ' Mt';
        cGap.querySelector('.gn-cut').textContent = f(cut, 0) + ' %';
        cGap.querySelector('.gap-insight').textContent = st.total
          ? `With these levers Denmark reaches a ${f(cut, 0)} % cut. ${f(left, 1)} Mt still needs a lever that is not modelled here, mainly in farming.`
          : `Try the Klimaloven 2030 package: it closes ${f(100 * packageMt / gap, 0)} % of the gap.`;
        cGap.querySelector('.gap-legend').innerHTML = defs.filter(d => st.effects[d.id] > 0).map(d =>
          `<span><i style="background:${V2.sectorColor(d.sector)}"></i>${d.label}</span>`).join('');
        heroCard.querySelector('[data-stat="lev"] b').textContent = st.total ? f(left, 1) + ' Mt' : '—';
        V2.heroLever(heroCard, st.total ? cut : null, [0, 100]);
        // Option (b): the levers line starts from the latest level with no other change; say so.
        leverNote.hidden = !st.total;
        if (st.total) {
          const end = h.latest - st.total, trend = pc.projected_at_target_year;
          leverNote.textContent = `Green line: your levers added to the ${yr} level, with nothing else changing. ` +
            `It ends at ${f(end, 1)} Mt, ${end > trend ? 'above' : 'below'} the grey trend (${f(trend, 1)} Mt). ` +
            `The trend repeats past progress such as more wind power, which these four levers do not include, so the two lines cannot be added.`;
        }
        if (gapSays) gapSays(st.total
          ? `The chosen levers cut ${f(st.total, 1)} Mt, which is ${f(share, 0)} % of the gap. The ${f(left, 1)} Mt left is close in size to all of agriculture's emissions (${f(ss.agriculture[yr], 1)} Mt), which no modelled lever reaches.`
          : `No lever is pulled. The full ${f(gap, 1)} Mt gap is uncovered.`);
        if (gapChart) V2.update(gapChart);
        V2.update(paceChart);
      });
    g4.appendChild(panel);
    g4.appendChild(cGap);
    V2.info(panel, {
      what: 'Four policy changes from the existing energy-scenario model. Each slider sets how far the change goes, from 0 to 100 %. The Mt figure is the yearly cut in emissions at that level, read from the model and straight-line between its model points.',
      says: `Even with all four at 100 %, the cut is ${f(defs.reduce((s, d) => s + V2.leverEffect(d.points, 100), 0), 1)} Mt, less than half of the ${f(gap, 1)} Mt gap. The levers are all about energy use; none reaches methane and nitrous oxide from farming.`,
      source: 'scenarios.json (compute_scenarios.py), 2024 fuel mix',
    });
    gapSays = V2.info(cGap, {
      what: `The top bar is the ${f(gap, 1)} Mt gap between ${yr} emissions and the 2030 target. Coloured parts are what your chosen levers cut, in the colour of their sector. The red dashed part is what is left. The brown bar shows all of agriculture's emissions today, for scale.`,
      says: '',
    });
    gapChart = V2.gapFill(cGap.querySelector('.gapbar'), defs, () => lev, gap,
      { label: 'Agriculture today', value: ss.agriculture[yr], color: V2.sectorColor('agriculture') });
    panel._init({});

    // Quadrant at half width, with its text twin beside it. Own record since 2008, no marks.
    const g5 = root.appendChild(V2.el('<div class="grid" style="margin-top:var(--gap)"></div>'));
    const pts = V2.recordPoints(ind.indicators.filter(i => i.theme === 'ecological'), SHORT, null, 2008);
    const cQ = g5.appendChild(card('s6', I.recordQuadrantTitle(pts), 'Latest value on its own range since 2008 vs its move in ten years', 'tall'));
    V2.recordQuadrant(cQ.querySelector('.chart'), pts);
    V2.info(cQ, { what: V2.recordInfo.quadrant(2008), says: I.recordQuadrantSays(pts) });
    const cW = g5.appendChild(V2.el(`
      <div class="card s6"><h3>Watch list: where to look first</h3>
        <div class="sub">Same measures as the chart, most urgent first</div>
        ${V2.recordWatch(pts)}
        <div class="note">Compares each measure with its own record since 2008, not with a target. Water abstraction starts in 2010 and green turnover in 2012. Green turnover is in current prices, so part of its rise is inflation.</div>
      </div>`));
    V2.info(cW, { what: V2.recordInfo.watch, says: I.recordWatchSays(pts) });
  };
})(window.V2);
