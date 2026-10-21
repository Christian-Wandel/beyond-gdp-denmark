/* First-visit guided tour: four spotlit steps, then never again (localStorage flag).
   Ported from cv-chat. The ring is one element doing two jobs: a transparent hole over
   the target, plus a huge box-shadow spread that dims the rest of the page. */
window.V2 = window.V2 || {};

(function (V2) {
  const SEEN_KEY = 'bgdp-dk-v2-tour-seen';
  const STR = {
    skip: 'Skip', next: 'Next', done: 'Got it', close: 'Close the guide',
    stepOf: (n, total) => `Step ${n} of ${total}`,
  };

  let tour, ring, card, steps = [], idx = 0, active = false;
  const $ = id => document.getElementById(id);
  function buildSteps() {
    const page = ($('crumb-page') || {}).textContent || 'Overview';
    // The status cards exist on the Overview only. When their row stacks taller than the
    // screen, spotlight the first card instead of the whole row.
    const first = document.querySelector('#page .card.theme');
    const row = first && first.parentElement;
    const status = row && row.offsetHeight > window.innerHeight * 0.6 ? first : row;
    return [
      { el: document.querySelector('#page h1.page'), title: 'How is Denmark doing?',
        body: 'This dashboard tracks Denmark beyond GDP: climate, society and education. The headline sums up the latest data.' },
      { el: status, title: 'Start with the status',
        body: 'Each card is one theme. Green is better than ten years ago, amber is mixed, red is worse. Click "Open" on a card for the detail.' },
      { el: document.querySelector('.nav'), title: 'Switch theme here',
        body: `You are on the ${page} page. Use this menu to move between the Overview and the three themes. The dot shows the status of each theme.` },
      { el: document.querySelector('#page .info-btn'), title: 'Click the i for the story',
        body: 'Every chart has an i button. It says what the chart shows and what it means.' },
    ].filter(s => s.el);
  }

  function place() {
    const step = steps[idx];
    if (!step) return;
    const pad = 6;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    let r = step.el.getBoundingClientRect();

    let top = r.top - pad, left = r.left - pad;
    // The nav scrolls sideways on phones and can be wider than the screen.
    const w = Math.min(r.width + pad * 2, vw), h = Math.min(r.height + pad * 2, vh);
    // Clamp so a target that does not fit keeps the hole on-screen.
    left = Math.max(0, Math.min(left, vw - w));
    top = Math.max(0, Math.min(top, vh - h));
    Object.assign(ring.style, { top: top + 'px', left: left + 'px', width: w + 'px', height: h + 'px' });

    // Card below the target when there is room, otherwise above; then clamped to the viewport.
    const gap = 14, cw = card.offsetWidth, ch = card.offsetHeight;
    let cTop = top + h + gap;
    if (cTop + ch > vh - 12) cTop = top - ch - gap;
    cTop = Math.max(12, Math.min(cTop, vh - ch - 12));
    const cLeft = Math.max(12, Math.min(left + w / 2 - cw / 2, vw - cw - 12));
    card.style.top = cTop + 'px';
    card.style.left = cLeft + 'px';
  }

  function render() {
    const step = steps[idx];
    if (!step) return;
    const last = idx === steps.length - 1;
    $('tourStep').textContent = STR.stepOf(idx + 1, steps.length);
    $('tourTitle').textContent = step.title;
    $('tourBody').textContent = step.body;
    $('tourSkip').textContent = STR.skip;
    $('tourNext').textContent = last ? STR.done : STR.next;
    $('tourClose').setAttribute('aria-label', STR.close);

    // The page scrolls (unlike cv-chat), so bring an off-screen target into view first.
    const r = step.el.getBoundingClientRect();
    const vh = document.documentElement.clientHeight;
    if (r.top < 0 || r.bottom > vh) step.el.scrollIntoView({ block: 'center' });

    place();
    // Re-place once the card has its final height for this step's text.
    requestAnimationFrame(place);
  }

  function end() {
    active = false;
    tour.hidden = true;
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* private mode: shows again next visit */ }
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place);
  }

  function next() {
    if (idx >= steps.length - 1) { end(); return; }
    idx++;
    render();
    $('tourNext').focus();
  }

  function onKey(e) {
    if (!active) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
  }

  let wired = false;
  function wire() {
    if (wired) return;
    wired = true;
    $('tourNext').addEventListener('click', next);
    $('tourSkip').addEventListener('click', end);
    $('tourClose').addEventListener('click', end);
    // Clicking the dimmed area dismisses; clicks on the card itself must not.
    tour.addEventListener('click', e => { if (e.target === tour) end(); });
  }

  V2.tour = {
    start() {
      tour = $('tour'); ring = $('tourRing'); card = $('tourCard');
      if (!tour || !ring || !card) return;
      try {
        if (localStorage.getItem(SEEN_KEY)) return;
      } catch (e) {
        return; // no storage, no way to remember a dismissal: don't nag
      }
      steps = buildSteps();
      if (!steps.length) return;
      wire();
      idx = 0;
      active = true;
      tour.hidden = false;
      render();
      $('tourNext').focus();
      document.addEventListener('keydown', onKey, true);
      window.addEventListener('resize', place);
      window.addEventListener('scroll', place, { passive: true });
    },
  };
})(window.V2);
