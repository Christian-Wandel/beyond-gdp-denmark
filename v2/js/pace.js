/* Pace: history + required path + trend projection, and the annual-change histogram. */
window.V2 = window.V2 || {};

(function (V2) {
  /**
   * Line chart. h: {series:{y:v}, target?, yMin?}, pc: pace block, unit label.
   * Without h.target the chart shows history only (no required path); the
   * trend line shows only when pc.target_year is after the latest year.
   */
  V2.paceLine = function (el, h, pc, unit, getLeverMt) {
    const hist = Object.keys(h.series).map(Number).sort((a, b) => a - b).map(y => [y, h.series[y]]);
    const hasTarget = h.target != null;
    const req = hasTarget ? Object.entries(pc.required_path || {}).map(([y, v]) => [+y, v]) : [];
    const xMax = Math.max(pc.target_year || 0, hist[hist.length - 1][0]);
    const proj = [];
    for (let y = pc.latest_year; pc.target_year > pc.latest_year && y <= pc.target_year; y++) {
      proj.push([y, pc.latest * (1 + pc.actual_rate) ** (y - pc.latest_year)]);
    }
    // Levers phased in on a straight line from the latest year to the target year,
    // on top of the latest level (no other change assumed).
    const leverPath = () => {
      const L = getLeverMt ? getLeverMt() : 0;
      if (!L) return [];
      const n = pc.target_year - pc.latest_year;
      return Array.from({ length: n + 1 }, (_, i) => [pc.latest_year + i, pc.latest - L * i / n]);
    };
    return V2.chart(el, p => Object.assign(V2.base(p), {
      animationDurationUpdate: 450,
      grid: { left: 8, right: 70, top: 30, bottom: 8, containLabel: true },
      tooltip: Object.assign(V2.base(p).tooltip, {
        trigger: 'axis', valueFormatter: v => V2.fmt(v, 1) + ' ' + unit,
      }),
      legend: { top: 0, left: 0, itemWidth: 18, itemHeight: 2, textStyle: { color: p.ink2, fontSize: 11 },
        data: ['Actual'].concat(hasTarget ? ['Required path'] : [], proj.length ? ['Current trend'] : [], getLeverMt ? ['Levers only'] : []) },
      xAxis: V2.axis(p, { type: 'value', min: hist[0][0], max: xMax, interval: 5,
        axisLabel: { color: p.ink3, fontSize: 11, formatter: v => String(v) }, splitLine: { show: false } }),
      yAxis: V2.axis(p, { type: 'value', min: h.yMin ?? 0, axisLabel: { color: p.ink3, fontSize: 11, formatter: v => v } }),
      series: [
        { name: 'Actual', type: 'line', data: hist, symbol: 'none', lineStyle: { color: p.accent, width: 2.5 },
          itemStyle: { color: p.accent }, areaStyle: { color: p.accent, opacity: 0.06 },
          markLine: hasTarget ? { symbol: 'none', silent: true,
            lineStyle: { color: p.green, type: 'solid', width: 1.5 },
            label: { color: p.green, formatter: `Target ${V2.fmt(h.target, 1)}`, position: 'end', fontSize: 11 },
            data: [{ yAxis: h.target }] } : undefined },
        { name: 'Required path', type: 'line', data: req, symbol: 'none',
          lineStyle: { color: p.red, type: 'dashed', width: 2 }, itemStyle: { color: p.red } },
        { name: 'Current trend', type: 'line', data: proj, symbol: 'none',
          lineStyle: { color: p.ink3, type: 'dotted', width: 2 }, itemStyle: { color: p.ink3 },
          endLabel: { show: true, color: p.ink2, fontSize: 11, offset: [0, 7], formatter: o => V2.fmt(o.value[1], 1) } },
        { name: 'Levers only', type: 'line', data: leverPath(), symbol: 'none',
          lineStyle: { color: p.green, width: 2.5 }, itemStyle: { color: p.green },
          endLabel: { show: true, color: p.green, fontSize: 11, fontWeight: 600, offset: [0, -7], formatter: o => V2.fmt(o.value[1], 1) } },
      ],
    }));
  };

  /**
   * Histogram of past annual % changes, with the required pace marked.
   * Without pc.required_pct, years split at 0 into improved / worsened;
   * pc.lowerIsBetter says which side is better.
   */
  V2.changeHistogram = function (el, pc, binWidth = 2) {
    const vals = Object.values(pc.annual_changes);
    const noTarget = pc.required_pct == null;
    const cut = noTarget ? 0 : pc.required_pct;
    const down = noTarget ? !!pc.lowerIsBetter : pc.required_pct < 0;
    const [fastName, slowName] = noTarget ? ['Improved', 'Worsened'] : ['Fast enough', 'Too slow'];
    const lo = Math.floor(Math.min(...vals, cut) / binWidth) * binWidth;
    const hi = Math.ceil(Math.max(...vals) / binWidth) * binWidth;
    const bins = [];
    for (let a = lo; a < hi; a += binWidth) bins.push({ a, b: a + binWidth, fast: 0, slow: 0 });
    // Count each year as fast or slow on its own value, so a bin that straddles
    // the required pace is split exactly (stacked bar).
    const isFast = v => down ? (noTarget ? v < cut : v <= cut) : (noTarget ? v > cut : v >= cut);
    vals.forEach(v => {
      const b = bins[Math.min(Math.floor((v - lo) / binWidth), bins.length - 1)];
      isFast(v) ? b.fast++ : b.slow++;
    });
    const reqIdx = Math.min(Math.floor((cut - lo) / binWidth), bins.length - 1);
    const label = b => `${V2.signed(b.a, 0)} to ${V2.signed(b.b, 0)} %`;
    return V2.chart(el, p => Object.assign(V2.base(p), {
      grid: { left: 8, right: 12, top: 40, bottom: 20, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: p.ink2, fontSize: 11 } },
      tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: ps => `${label(bins[ps[0].dataIndex])}<br>` + ps.map(s => `${s.seriesName}: <b>${s.value}</b>`).join('<br>') }),
      xAxis: V2.axis(p, { type: 'category', data: bins.map(b => V2.signed(b.a, 0)),
        name: 'Change from the year before, %', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: p.ink3, fontSize: 11 } }),
      yAxis: V2.axis(p, { type: 'value', minInterval: 1 }),
      series: [
        { name: fastName, type: 'bar', stack: 'h', barCategoryGap: '12%',
          data: bins.map(b => b.fast), itemStyle: { color: p.accent },
          markLine: noTarget ? undefined : { symbol: 'none', silent: true, lineStyle: { color: p.red, type: 'dashed', width: 2 },
            label: { formatter: `Needed ${V2.signed(pc.required_pct)} %/yr`, color: p.red, fontSize: 11, position: 'insideEndTop' },
            data: [{ xAxis: reqIdx }] } },
        { name: slowName, type: 'bar', stack: 'h', data: bins.map(b => b.slow),
          itemStyle: { color: p.g2, borderRadius: [3, 3, 0, 0] } },
      ],
    }));
  };
})(window.V2);
