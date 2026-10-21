/* Shell: theme, palette, chart registry, routing, page assembly. */
window.V2 = window.V2 || {};

(function (V2) {
  const DATA = '../data/v2/';
  const charts = [];   // {el, build} — rebuilt on theme toggle and resize

  // ── Palette (read from CSS vars so both themes work) ─────────────────────
  V2.pal = function () {
    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    return {
      ink: v('--ink'), ink2: v('--ink-2'), ink3: v('--ink-3'), rule: v('--rule'), card: v('--card'),
      accent: v('--accent'), red: v('--red'), amber: v('--amber'), green: v('--green'),
      g1: v('--grey-1'), g2: v('--grey-2'), g3: v('--grey-3'),
      font: v('--font'), mono: v('--mono'),
    };
  };

  // Shared ECharts base: axis + tooltip styling.
  V2.base = function (p) {
    return {
      textStyle: { fontFamily: p.font, color: p.ink2 },
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      tooltip: {
        backgroundColor: p.card, borderColor: p.rule, textStyle: { color: p.ink, fontFamily: p.font, fontSize: 12 },
      },
      animationDuration: 600,
    };
  };
  V2.axis = function (p, extra) {
    return Object.assign({
      axisLine: { lineStyle: { color: p.rule } }, axisTick: { show: false },
      axisLabel: { color: p.ink3, fontSize: 11 }, splitLine: { lineStyle: { color: p.g3 } },
    }, extra || {});
  };

  V2.chart = function (el, build) {
    const inst = echarts.init(el, null, { renderer: 'svg' });
    const entry = { el, inst, build };
    inst.setOption(build(V2.pal()));
    charts.push(entry);
    return inst;
  };

  // Re-run one chart's build with current state (merge, so bars and lines animate).
  V2.update = function (inst) {
    const c = charts.find(x => x.inst === inst);
    if (c) c.inst.setOption(c.build(V2.pal()));
  };

  function redrawAll() {
    const p = V2.pal();
    charts.forEach(c => { c.inst.clear(); c.inst.setOption(c.build(p)); c.inst.resize(); });
  }

  // ── Formatting ───────────────────────────────────────────────────────────
  V2.fmt = (v, d = 1) => v == null ? '—' : v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
  V2.signed = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + V2.fmt(Math.abs(v), d);
  V2.el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  // ── Info button: "i" in the card corner, opens on hover, focus or tap ────
  let infoSeq = 0;
  V2.info = function (card, o) {
    const id = 'info-' + (++infoSeq);
    card.classList.add('has-info');
    const wrap = V2.el(`
      <div class="info">
        <button type="button" class="info-btn" aria-expanded="false" aria-controls="${id}" aria-label="What does this chart show?">i</button>
        <div class="info-pop" id="${id}" role="tooltip">
          <div class="info-k">What it shows</div><p>${o.what}</p>
          ${o.says ? `<div class="info-k">What it says</div><p class="info-says">${o.says}</p>` : ''}
          ${o.source ? `<div class="info-src">${o.source}</div>` : ''}
        </div>
      </div>`);
    const btn = wrap.querySelector('button');
    const set = open => { wrap.classList.toggle('open', open); btn.setAttribute('aria-expanded', open); };
    btn.addEventListener('click', e => { e.stopPropagation(); set(!wrap.classList.contains('open')); });
    wrap.addEventListener('mouseenter', () => set(true));
    wrap.addEventListener('mouseleave', () => set(false));
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) set(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
    card.appendChild(wrap);
    // Lets live charts refresh the "What it says" text.
    return says => { const s = wrap.querySelector('.info-says'); if (s) s.innerHTML = says; };
  };

  // ── Theme (light default, toggle only) ───────────────────────────────────
  function initTheme() {
    let t = 'light';
    try { t = localStorage.getItem('bgdp-dk-v2-theme') || 'light'; } catch (e) { /* storage blocked */ }
    document.documentElement.setAttribute('data-theme', t);
    document.getElementById('toggle').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('bgdp-dk-v2-theme', next); } catch (e) { /* ignore */ }
      redrawAll();
    });
  }

  // ── Routing ──────────────────────────────────────────────────────────────
  const PAGES = {
    overview: { title: 'Overview', render: p => V2.pages.overview(p) },
    eco: { title: 'Ecological limits', render: p => V2.pages.eco(p) },
    soc: { title: 'Societal foundations', render: p => V2.pages.soc(p) },
    edu: { title: 'Education', render: p => V2.pages.edu(p) },
  };
  V2.pages = V2.pages || {};

  const cache = {};
  V2.load = async function (name) {
    if (!cache[name]) cache[name] = fetch(DATA + name + '.json').then(r => r.json());
    return cache[name];
  };

  async function route() {
    const id = (location.hash || '#overview').slice(1);
    const page = PAGES[id] || PAGES.overview;
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
    charts.forEach(c => c.inst.dispose());
    charts.length = 0;
    const root = document.getElementById('page');
    root.innerHTML = '';
    document.getElementById('crumb-page').textContent = page.title;
    await page.render(root);
    window.scrollTo(0, 0);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => charts.forEach(c => c.inst.resize()), 120);
  });
  window.addEventListener('hashchange', route);
  document.addEventListener('DOMContentLoaded', () => { initTheme(); route().then(() => V2.tour && V2.tour.start()); V2.navStatus(); });
})(window.V2);
