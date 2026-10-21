/* Hero bullet and KPI cards. */
window.V2 = window.V2 || {};

(function (V2) {
  const pct = (v, lo, hi) => Math.max(0, Math.min(100, 100 * (v - lo) / (hi - lo)));

  /**
   * Hero card for a "reduce toward target" indicator.
   * opts: {label, value, unit, status, statusText, stats:[[label,value]], scale:[lo,hi],
   *        bands:[[from,to,color]], bar, target, targetLabel, proj?, projLabel}
   */
  V2.hero = function (o) {
    const s = o.scale;
    const bands = o.bands.map(([a, b, c]) =>
      `<div class="band" style="left:${pct(a, ...s)}%;width:${pct(b, ...s) - pct(a, ...s)}%;background:${c}"></div>`).join('');
    const stats = o.stats.map(([l, v, id]) => `<div${id ? ` data-stat="${id}"` : ''}>${l}<b>${v}</b></div>`).join('');
    return V2.el(`
      <div class="card hero s12">
        <div class="hero-top">
          <div>
            <span class="status ${o.status}">${o.statusText}</span>
            <div class="hero-num">${o.value}<small>${o.unit}</small></div>
            <div class="hero-label">${o.label}</div>
          </div>
          <div class="hero-stats">${stats}</div>
        </div>
        <div class="bullet" role="img" aria-label="${o.aria}">
          ${bands}
          <div class="bar" style="width:${pct(o.bar, ...s)}%"></div>
          ${o.proj != null ? `<div class="mark proj" style="left:${pct(o.proj, ...s)}%"></div>` : ''}
          <div class="mark lev" hidden></div>
          <div class="mark" style="left:${pct(o.target, ...s)}%"></div>
          <div class="tag up" style="left:${pct(o.target, ...s)}%">${o.targetLabel}</div>
          ${o.proj != null ? `<div class="tag down" style="left:${pct(o.proj, ...s)}%">${o.projLabel}</div>` : ''}
          <div class="tag up start">${o.barLabel}</div>
        </div>
        ${o.insight ? `<div class="insight ${o.status}">${o.insight}</div>` : ''}
      </div>`);
  };

  /** Move the lever marker on a hero bullet; hide it when value is null. */
  V2.heroLever = function (card, value, scale) {
    const m = card.querySelector('.mark.lev');
    m.hidden = value == null;
    if (value != null) m.style.left = pct(value, ...scale) + '%';
  };

  /**
   * KPI card. k: {label, value, unit, decimals, series:{year:value}, direction,
   *              level, verdict, changeYears}
   */
  V2.kpi = function (k) {
    const ys = Object.keys(k.series).map(Number).sort((a, b) => a - b);
    const last = ys[ys.length - 1];
    const prev = ys.includes(last - 1) ? last - 1 : null;
    // Same 5-year window as the momentum verdict, so pill and verdict agree.
    const from = ys.filter(y => y <= last - (k.changeYears || 5)).pop() ?? ys[0];
    const ch = 100 * (k.series[last] / k.series[from] - 1);
    const yoy = prev != null ? 100 * (k.series[last] / k.series[prev] - 1) : null;
    const good = v => k.direction === 'lower_better' ? v < 0 : v > 0;
    const cls = v => Math.abs(v) < 0.5 ? 'flat' : good(v) ? 'good' : 'bad';
    const card = V2.el(`
      <div class="card kpi s3">
        <h3>${k.label}</h3>
        <div class="sub">${k.sub || ''}</div>
        <div class="val">${V2.fmt(k.value, k.decimals ?? 1)}<small>${k.unit}</small></div>
        <div class="meta">
          ${yoy != null ? `<span class="pill ${cls(yoy)}">${V2.signed(yoy)} % YoY</span>` : ''}
          <span class="pill ${cls(ch)}">${V2.signed(ch, 0)} % since ${from}</span>
        </div>
        <div class="spark"></div>
        <div class="verdict"><span class="lvl ${k.level}"></span>${k.verdict}</div>
      </div>`);
    card._spark = (el) => V2.chart(el, p => ({
      animation: false,
      grid: { left: 0, right: 0, top: 4, bottom: 0 },
      // Years on the x-axis, values on the y-axis (the old sparkline swapped these).
      xAxis: { type: 'value', min: ys[0], max: last, show: false },
      yAxis: { type: 'value', scale: true, show: false },
      tooltip: { show: false },
      series: [{
        type: 'line', data: ys.map(y => [y, k.series[y]]), symbol: 'none', smooth: false,
        lineStyle: { color: p.accent, width: 2 },
        areaStyle: { color: p.accent, opacity: 0.08 },
        markPoint: { symbol: 'circle', symbolSize: 6, itemStyle: { color: p.accent },
          data: [{ coord: [last, k.series[last]] }], label: { show: false } },
      }],
    }));
    return card;
  };
})(window.V2);
