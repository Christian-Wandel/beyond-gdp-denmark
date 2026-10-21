/* Composition charts: donut, stacked area, waterfall. */
window.V2 = window.V2 || {};

(function (V2) {
  // Categorical ramp: accent first, then muted tones. Order is by size.
  V2.ramp = p => [p.accent, p.amber, p.green, p.red, p.g1, '#7A6FA8', '#4E9AA6', p.ink3];

  // Fixed sector colours, shared by the sector chart and the lever panel.
  // Kept clear of the red/amber/green status colours.
  const SECTOR_COLORS = {
    agriculture: '#A07A45', households: '#3F7CAC', industry_extraction: '#7468A8',
    transport: '#3E9C9C', energy_supply: '#E5C12E', services: '#8D96A3',
    water_waste: '#6E8F6A', construction: '#E8742A', ships_planes_abroad: '#B9BCC3',
  };
  V2.sectorColor = (k, p) => SECTOR_COLORS[k] || (p ? p.g1 : '#999');

  /** Donut. parts: [{name, value}]. center: text in the hole. */
  V2.donut = function (el, parts, unit, center) {
    return V2.chart(el, p => Object.assign(V2.base(p), {
      tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'item',
        formatter: o => `${o.name}<br><b>${V2.fmt(o.value, 1)} ${unit}</b> (${V2.fmt(o.percent, 0)} %)` }),
      title: { text: center[0], subtext: center[1], left: 'center', top: '40%',
        textStyle: { fontFamily: p.mono, fontSize: 22, fontWeight: 500, color: p.ink },
        subtextStyle: { fontSize: 11, color: p.ink3 } },
      series: [{
        type: 'pie', radius: ['46%', '68%'], avoidLabelOverlap: true, padAngle: 1.5,
        itemStyle: { borderRadius: 4, borderColor: p.card, borderWidth: 2 },
        label: { color: p.ink2, fontSize: 11, overflow: 'none', formatter: o => `${o.name}\n${V2.fmt(o.percent, 0)} %` },
        labelLine: { lineStyle: { color: p.rule } },
        data: parts.map((d, i) => ({ ...d, itemStyle: { color: d.color || V2.ramp(p)[i] } })),
      }],
    }));
  };

  /** Stacked area. groups: [{name, series:{y:v}, color?}], years: [int]. */
  V2.stackedArea = function (el, groups, years, unit) {
    return V2.chart(el, p => Object.assign(V2.base(p), {
      grid: { left: 8, right: 12, top: 56, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: p.ink2, fontSize: 11 } },
      tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'axis', valueFormatter: v => V2.fmt(v, 1) + ' ' + unit }),
      xAxis: V2.axis(p, { type: 'category', data: years.map(String), boundaryGap: false,
        axisLabel: { color: p.ink3, fontSize: 11, interval: 4 }, splitLine: { show: false } }),
      yAxis: V2.axis(p, { type: 'value' }),
      series: groups.map((g, i) => ({
        name: g.name, type: 'line', stack: 'all', symbol: 'none', lineStyle: { width: 0 },
        areaStyle: { color: g.color || V2.ramp(p)[i], opacity: 0.85 }, itemStyle: { color: g.color || V2.ramp(p)[i] },
        data: years.map(y => g.series[String(y)] ?? null),
      })),
    }));
  };

  /**
   * Waterfall. start/end: {label, value}. steps: [{label, value}].
   * Bars float on a transparent base; down = good when lowerIsGood.
   */
  V2.waterfall = function (el, start, steps, end, unit, opts = {}) {
    const lowerIsGood = opts.lowerIsGood !== false;
    const cats = [start.label, ...steps.map(s => s.label), end.label];
    const base = [], up = [], down = [], tot = [];
    let run = start.value;
    base.push(0); up.push('-'); down.push('-'); tot.push(start.value);
    steps.forEach(s => {
      const next = run + s.value;
      base.push(Math.min(run, next));
      if (s.value >= 0) { up.push(s.value); down.push('-'); } else { down.push(-s.value); up.push('-'); }
      tot.push('-');
      run = next;
    });
    base.push(0); up.push('-'); down.push('-'); tot.push(end.value);
    // Narrow cards (phones) get horizontal bars so category labels do not collide.
    const horiz = !!opts.horizontal || el.clientWidth < 520;
    return V2.chart(el, p => {
      // Accounting bridges are neutral: steps are not good or bad news.
      const goodC = opts.neutral ? p.g1 : p.green, badC = opts.neutral ? p.g1 : p.red;
      const lbl = (pos, sign = '') => ({ show: true, position: pos, color: p.ink2, fontSize: 10.5, fontFamily: p.mono,
        formatter: o => o.value === '-' ? '' : sign + V2.fmt(o.value, 1) });
      const ca = V2.axis(p, { type: 'category', data: cats, inverse: horiz,
        axisLabel: { color: p.ink2, fontSize: 11, interval: 0, width: horiz ? 120 : 80, overflow: 'break' } });
      const va = V2.axis(p, { type: 'value', min: opts.min });
      return Object.assign(V2.base(p), {
        grid: horiz ? { left: 128, right: 44, top: 12, bottom: 24 }
          : { left: 8, right: 30, top: 12, bottom: 8, containLabel: true },
        tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow' },
          formatter: ps => {
            const i = ps[0].dataIndex;
            const v = i === 0 ? start.value : i === cats.length - 1 ? end.value : steps[i - 1].value;
            const signed = i === 0 || i === cats.length - 1 ? V2.fmt(v, 1) : V2.signed(v, 1);
            return `${cats[i]}<br><b>${signed} ${unit}</b>`;
          } }),
        xAxis: horiz ? va : ca, yAxis: horiz ? ca : va,
        series: [
          { type: 'bar', stack: 'w', data: base, itemStyle: { color: 'transparent' }, silent: true },
          { type: 'bar', stack: 'w', data: up, itemStyle: { color: lowerIsGood ? badC : goodC, borderRadius: 2 },
            label: lbl(horiz ? 'right' : 'top', '+') },
          { type: 'bar', stack: 'w', data: down, itemStyle: { color: lowerIsGood ? goodC : badC, borderRadius: 2 },
            label: lbl(horiz ? 'right' : 'top', '−') },
          { type: 'bar', stack: 'w', data: tot, barMaxWidth: 46, itemStyle: { color: p.accent, borderRadius: 2 },
            label: lbl(horiz ? 'right' : 'top') },
        ],
      });
    });
  };
})(window.V2);
