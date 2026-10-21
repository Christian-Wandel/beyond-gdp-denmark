/* Own-record views: each measure against Denmark's own best and worst year since
   `from`. No targets and no hand-set marks. Quadrant, its text twin (watch list),
   and the worst-to-best range strip. */
window.V2 = window.V2 || {};

(function (V2) {
  const f = V2.fmt;
  const Q = { act: 'Act now', rec: 'Recovering', slip: 'Slipping', best: 'Near best' };
  // Lower half of the own range = nearer the worst year; change below 0 = worse than ten years ago.
  V2.recordQuadrantOf = (pos, ch) => pos < 50 ? (ch < 0 ? Q.act : Q.rec) : (ch < 0 ? Q.slip : Q.best);
  V2.Q = Q;
  const Q_CLASS = { [Q.act]: 'act', [Q.rec]: 'stay', [Q.slip]: 'warn', [Q.best]: 'ok' };
  const RANK = { [Q.act]: 0, [Q.slip]: 1, [Q.rec]: 2, [Q.best]: 3 };

  // Default value formatter from the indicator's unit.
  const UNIT_FV = {
    'tonnes CO2-eq/person': v => `${f(v, 1)} t`, 'tonnes/person': v => `${f(v, 1)} t`,
    '1000 m3': v => `${f(v / 1000, 0)} mio m³`, 'DKK million': v => `${f(v / 1000, 0)} bn kr`,
    years: v => `${f(v, 1)} yrs`, percent: v => `${f(v, 1)} %`, score_1_5: v => f(v, 2),
  };
  V2.recordFv = i => UNIT_FV[i.unit] || (/^DKK/.test(i.unit) ? v => `${f(v / 1000, 0)}k kr` : v => f(v, 1));

  /** Points for the quadrant and watch list. names: {id: label}; fvs: optional {id: formatter}. */
  V2.recordPoints = function (inds, names, fvs, from = 2008) {
    return inds.map(i => {
      const h = V2.insights.record(i, from);
      const pos = h.pos(h.last), ch = pos - h.pos(h.tenY);
      return { id: i.id, theme: i.theme, label: (names && names[i.id]) || i.label, h, pos, ch,
        fv: (fvs && fvs[i.id]) || V2.recordFv(i), q: V2.recordQuadrantOf(pos, ch) };
    });
  };

  // Point the label away from a close neighbour on the same height, else by edge.
  const labelSide = (d, pts) => {
    if (d.pos > 85) return 'left';
    const near = pts.filter(o => o !== d && Math.abs(o.ch - d.ch) < 8 && Math.abs(o.pos - d.pos) < 30);
    if (near.length) return near[0].pos > d.pos ? 'left' : 'right';
    return d.pos > 60 ? 'left' : 'right';
  };

  V2.recordQuadrant = function (el, pts) {
    const lim = Math.min(100, Math.ceil(Math.max(20, ...pts.map(d => Math.abs(d.ch))) * 1.25 / 25) * 25);
    return V2.chart(el, p => {
      const col = { [Q.act]: p.red, [Q.rec]: p.ink3, [Q.slip]: p.amber, [Q.best]: p.green };
      const area = (x0, x1, y0, y1, c) => [{ xAxis: x0, yAxis: y0, itemStyle: { color: c + '14' } }, { xAxis: x1, yAxis: y1 }];
      const corner = (pos, title, sub, color) => ({
        type: 'group', ...pos,
        children: [
          { type: 'text', style: { text: title, fill: color, font: `700 11px ${p.font}`, textAlign: pos.right != null ? 'right' : 'left' } },
          { type: 'text', top: 14, style: { text: sub, fill: p.ink3, font: `400 10.5px ${p.font}`, textAlign: pos.right != null ? 'right' : 'left' } },
        ],
      });
      return Object.assign(V2.base(p), {
        grid: { left: 52, right: 20, top: 16, bottom: 46 },
        tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'item',
          formatter: o => { const d = pts[o.dataIndex], h = d.h;
            return `<b>${d.label}</b><br>${h.last}: <b>${d.fv(h.latest)}</b> · ${h.tenY}: ${d.fv(h.ten)}<br>` +
              `Best ${h.bestY}: ${d.fv(h.best)} · worst ${h.worstY}: ${d.fv(h.worst)}<br><i>${d.q}</i>`; } }),
        xAxis: V2.axis(p, { type: 'value', min: 0, max: 100, interval: 25,
          name: 'Latest on its own range  (0 = worst year, 100 = best)',
          nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: p.ink3, fontSize: 11 }, splitLine: { show: false } }),
        yAxis: V2.axis(p, { type: 'value', min: -lim, max: lim, interval: 25,
          name: 'Move in ten years  (↑ better)',
          nameLocation: 'middle', nameGap: 36, nameTextStyle: { color: p.ink3, fontSize: 11 }, splitLine: { show: false },
          axisLabel: { color: p.ink3, fontSize: 11, formatter: v => (v > 0 ? '+' : '') + Math.round(v) } }),
        graphic: [
          corner({ left: 62, top: 24 }, 'RECOVERING', 'Near its worst, improving', p.ink2),
          corner({ left: 62, bottom: 58 }, 'ACT NOW', 'Near its worst, getting worse', p.red),
          corner({ right: 30, top: 24 }, 'NEAR BEST', 'Near its best, improving', p.green),
          corner({ right: 30, bottom: 58 }, 'SLIPPING', 'Near its best, getting worse', p.amber),
        ],
        series: [{
          type: 'scatter', symbolSize: 14, clip: false,
          data: pts.map(d => ({ value: [d.pos, d.ch], name: d.label,
            label: { position: labelSide(d, pts) },
            itemStyle: { color: col[d.q], borderColor: p.card, borderWidth: 2 } })),
          label: { show: true, formatter: o => o.name, color: p.ink, fontSize: 11.5, fontWeight: 500 },
          markArea: { silent: true, data: [
            area(0, 50, 0, lim, p.g1), area(0, 50, -lim, 0, p.red),
            area(50, 100, 0, lim, p.green), area(50, 100, -lim, 0, p.amber),
          ] },
          markLine: { symbol: 'none', silent: true, lineStyle: { color: p.ink3, type: 'solid', width: 1 }, label: { show: false },
            data: [{ xAxis: 50 }, { yAxis: 0 }] },
        }],
      });
    });
  };

  const watchRow = d => `
    <tr>
      <td>${d.label}<div class="eta">Best ${d.h.bestY}: ${d.fv(d.h.best)} · worst ${d.h.worstY}: ${d.fv(d.h.worst)}</div></td>
      <td class="num">${d.fv(d.h.latest)}<div class="eta">${d.h.last}</div></td>
      <td class="num">${d.fv(d.h.ten)}<div class="eta">${d.h.tenY}</div></td>
      <td class="q ${Q_CLASS[d.q]}">${d.q}</td>
    </tr>`;

  /** Watch list: same points as text, most urgent first. o: {only: [quadrant names], lead: extra <tr> HTML} */
  V2.recordWatch = function (pts, o = {}) {
    const rows = pts.filter(d => !o.only || o.only.includes(d.q))
      .sort((a, b) => RANK[a.q] - RANK[b.q] || a.pos - b.pos);
    return `
      <table class="watch">
        <thead><tr><th>Measure</th><th>Latest</th><th>Ten years before</th><th>Verdict</th></tr></thead>
        <tbody>${o.lead || ''}${rows.map(watchRow).join('')}</tbody>
      </table>`;
  };

  // Shared info-button text for the quadrant and the watch list.
  V2.recordInfo = {
    quadrant: from => `Each dot is one measure. Left to right: where its latest value sits between Denmark's worst year since ${from} (0) and its best year (100); for measures where lower is better the scale is turned, so right is always better. Bottom to top: how far it moved on that range in ten years (or since its first year, for short series). No targets or hand-set marks are used.`,
    watch: 'The quadrant chart as a table, most urgent first. Latest and ten-years-before are in the measure\'s own unit; the grey line under each name gives its best and worst year. Act now = in the lower half of its own range and worse than ten years ago. Slipping = upper half but worse. Recovering = lower half but better. Near best = upper half and better.',
  };

  /**
   * Range strip: each row runs from the worst value since `from` (left) to the best (right).
   * rows: [{name: narrow => label, h: record, fv}]
   */
  V2.recordRange = function (el, rows) {
    // Phones: no end labels (tooltip keeps them).
    const narrow = () => el.clientWidth < 520;
    const val = (i, k) => rows[i].fv(rows[i].h[k]);
    return V2.chart(el, p => Object.assign(V2.base(p), {
      grid: { left: 16, right: 16, top: 32, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: p.ink2, fontSize: 11 }, data: ['Latest', 'Ten years earlier'] },
      tooltip: Object.assign(V2.base(p).tooltip, { trigger: 'item', formatter: x => x.data.tip }),
      yAxis: V2.axis(p, { type: 'category', inverse: true, data: rows.map(r => r.name(narrow())), axisLine: { show: false },
        axisLabel: { color: p.ink2, fontSize: 11.5 } }),
      // Room left of 0 and right of 100 for the worst / best value labels.
      xAxis: V2.axis(p, { type: 'value', min: narrow() ? -6 : -38, max: narrow() ? 106 : 138, show: false }),
      series: [
        { type: 'custom', silent: true, tooltip: { show: false }, z: 1,
          renderItem: (params, api) => {
            const a = api.coord([0, params.dataIndex]), b = api.coord([100, params.dataIndex]);
            return { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: p.g2, lineWidth: 4, lineCap: 'round' } };
          }, data: rows.map(() => [0]) },
        { name: 'Worst', type: 'scatter', symbolSize: 1, z: 2, data: rows.map(r => ({ value: 0,
            tip: `Worst since ${r.h.first}: ${r.fv(r.h.worst)} (${r.h.worstY})` })),
          label: { show: !narrow(), position: 'left', distance: 8, color: p.ink3, fontSize: 10.5, fontFamily: p.mono,
            formatter: x => `${val(x.dataIndex, 'worst')} '${String(rows[x.dataIndex].h.worstY).slice(2)}` } },
        { name: 'Best', type: 'scatter', symbolSize: 1, z: 2, data: rows.map(r => ({ value: 100,
            tip: `Best since ${r.h.first}: ${r.fv(r.h.best)} (${r.h.bestY})` })),
          label: { show: !narrow(), position: 'right', distance: 8, color: p.ink3, fontSize: 10.5, fontFamily: p.mono,
            formatter: x => `${val(x.dataIndex, 'best')} '${String(rows[x.dataIndex].h.bestY).slice(2)}` } },
        { name: 'Ten years earlier', type: 'scatter', symbolSize: 11, z: 3,
          itemStyle: { color: p.card, borderColor: p.ink3, borderWidth: 2 },
          data: rows.map(r => ({ value: r.h.pos(r.h.tenY), tip: `${r.h.tenY}: ${r.fv(r.h.ten)}` })) },
        { name: 'Latest', type: 'scatter', symbolSize: 14, z: 4, itemStyle: { color: p.accent },
          data: rows.map(r => ({ value: r.h.pos(r.h.last), tip: `${r.h.last}: <b>${r.fv(r.h.latest)}</b>`,
            // Phones: a label near the right end would be cut off, so end it at the dot.
            label: narrow() && r.h.pos(r.h.last) > 70 ? { align: 'right', offset: [7, 0] } : undefined })),
          label: { show: true, position: 'top', distance: 6, color: p.ink, fontSize: 11, fontWeight: 600, fontFamily: p.mono,
            formatter: x => val(x.dataIndex, 'latest') } },
      ],
    }));
  };
})(window.V2);
