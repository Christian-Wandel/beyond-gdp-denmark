/* Lever panel: sliders per lever, a gap-fill bar, and a change event the page listens to. */
window.V2 = window.V2 || {};

(function (V2) {
  /**
   * Piecewise-linear effect from the model points in scenarios.json.
   * points: [[adoption %, Mt], ...] sorted by adoption.
   */
  V2.leverEffect = function (points, pct) {
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1], [x1, y1] = points[i];
      if (pct <= x1) return y0 + (y1 - y0) * (pct - x0) / (x1 - x0);
    }
    return points[points.length - 1][1];
  };

  /**
   * defs: [{id, label, sector, points:[[pct, Mt]], goal?, goalLabel?, note}]
   * presets: [{label, values:{id: pct}}]
   * onChange(state) gets {values, effects:{id: Mt}, total}
   */
  V2.leverPanel = function (defs, presets, gapMt, missingText, onChange) {
    const values = Object.fromEntries(defs.map(d => [d.id, 0]));
    const card = V2.el(`
      <div class="card s7 levers">
        <h3>Pull the levers: how much of the ${V2.fmt(gapMt, 1)} Mt gap can they close?</h3>
        <div class="sub">Move a slider to set how far each change goes. The gap bar, the hero card and the pace chart update.</div>
        <div class="presets">${presets.map((p, i) => `<button type="button" data-i="${i}">${p.label}</button>`).join('')}</div>
        <ul class="lever-sliders">
          ${defs.map(d => `
            <li data-id="${d.id}">
              <div class="lv-head">
                <span class="chip" style="background:${V2.sectorColor(d.sector)}"></span>
                <span class="lv-name">${d.label}</span>
                <span class="lv-mt">0.0 Mt</span>
              </div>
              <div class="lv-ctl">
                <div class="lv-track">
                  <input type="range" min="0" max="100" step="5" value="0" aria-label="${d.label}, adoption in percent">
                  ${d.goal != null ? `<span class="lv-goal" style="left:${d.goal}%"><i></i>${d.goalLabel}</span>` : ''}
                </div>
                <span class="lv-pct">0 %</span>
              </div>
              <div class="lv-note">${d.note}</div>
            </li>`).join('')}
        </ul>
        <div class="missing">${missingText}</div>
        <div class="note">Effects come from <code>scenarios.json</code> (fuel-swap model on the 2024 energy mix), interpolated between its model points. One year at the chosen level; levers in the same sector may overlap.</div>
      </div>`);

    function emit() {
      const effects = Object.fromEntries(defs.map(d => [d.id, V2.leverEffect(d.points, values[d.id])]));
      const total = Object.values(effects).reduce((a, b) => a + b, 0);
      defs.forEach(d => {
        const li = card.querySelector(`li[data-id="${d.id}"]`);
        const inp = li.querySelector('input');
        inp.value = values[d.id];
        inp.style.setProperty('--v', values[d.id] + '%');
        inp.style.setProperty('--fill', V2.sectorColor(d.sector));
        li.querySelector('.lv-pct').textContent = values[d.id] + ' %';
        li.querySelector('.lv-mt').textContent = V2.fmt(effects[d.id], 1) + ' Mt';
        li.classList.toggle('on', values[d.id] > 0);
      });
      card.querySelectorAll('.presets button').forEach((b, i) => {
        const p = presets[i].values;
        b.classList.toggle('active', defs.every(d => (p[d.id] || 0) === values[d.id]));
      });
      onChange({ values: { ...values }, effects, total });
    }

    card.querySelectorAll('input[type=range]').forEach(inp => inp.addEventListener('input', e => {
      values[e.target.closest('li').dataset.id] = +e.target.value;
      emit();
    }));
    card.querySelectorAll('.presets button').forEach(b => b.addEventListener('click', () => {
      const p = presets[+b.dataset.i].values;
      defs.forEach(d => { values[d.id] = p[d.id] || 0; });
      emit();
    }));
    card._init = (startValues) => { Object.assign(values, startValues || {}); emit(); };
    return card;
  };

  /**
   * Stacked bar: the gap, filled by lever segments, rest uncovered.
   * ref: optional {label, value, color} drawn as a second bar for scale (e.g. agriculture).
   */
  V2.gapFill = function (el, defs, getState, gapMt, ref) {
    const cats = ref ? ['Gap to 2030', ref.label] : ['Gap to 2030'];
    const pad = arr => ref ? arr.concat(['-']) : arr;
    return V2.chart(el, p => {
      const st = getState();
      const left = Math.max(0, gapMt - st.total);
      const seg = d => ({
        name: d.label, type: 'bar', stack: 'gap', barWidth: 34,
        data: pad([st.effects[d.id] || 0]),
        itemStyle: { color: V2.sectorColor(d.sector, p), borderColor: p.card, borderWidth: 1.5 },
        label: { show: (st.effects[d.id] || 0) / gapMt > 0.12, position: 'inside', color: '#fff',
          fontFamily: p.mono, fontSize: 11, formatter: o => V2.fmt(o.value, 1) },
      });
      const series = [
        ...defs.map(seg),
        { name: 'Not covered', type: 'bar', stack: 'gap', barWidth: 34, data: pad([left]),
          itemStyle: { color: p.red + '2E', borderColor: p.red, borderWidth: 1.5, borderType: 'dashed' },
          label: { show: left / gapMt > 0.2, position: 'inside', color: p.red, fontFamily: p.mono, fontSize: 11,
            fontWeight: 500, formatter: o => `${V2.fmt(o.value, 1)} Mt not covered` } },
      ];
      if (ref) {
        series.push({ name: ref.label, type: 'bar', stack: 'gap', barWidth: 34, data: ['-', ref.value],
          itemStyle: { color: ref.color }, label: { show: true, position: 'inside', color: '#fff',
            fontFamily: p.mono, fontSize: 11, formatter: o => `${V2.fmt(o.value, 1)} Mt, no lever` } });
      }
      return Object.assign(V2.base(p), {
        animationDurationUpdate: 450,
        grid: { left: 8, right: 20, top: 4, bottom: 4, containLabel: true },
        tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'item',
          formatter: o => `${o.seriesName}<br><b>${V2.fmt(o.value, 1)} Mt</b>` }),
        xAxis: V2.axis(p, { type: 'value', min: 0, max: Math.max(gapMt, st.total, ref ? ref.value : 0),
          splitLine: { show: false }, axisLabel: { color: p.ink3, fontSize: 11, formatter: v => v + ' Mt' } }),
        yAxis: V2.axis(p, { type: 'category', data: cats, inverse: true, axisLine: { show: false },
          axisLabel: { color: p.ink2, fontSize: 11.5, width: 80, overflow: 'break' } }),
        series,
      });
    });
  };
})(window.V2);
