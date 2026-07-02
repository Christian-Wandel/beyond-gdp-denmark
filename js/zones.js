/**
 * zones.js — minimal red/yellow/green zone helpers for the Denmark boundary dashboard.
 *
 * Mirrors the piecewise-linear normalization in build_denmark_dataset.py (norm_high /
 * norm_low) and converts anchors into ECharts markArea zone bands.
 */

function liveColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n, fb) => cs.getPropertyValue(n).trim() || fb;
  return {
    red:    v('--red',   '#ef4444'),
    amber:  v('--amber', '#f59e0b'),
    green:  v('--green', '#22c55e'),
    marker: v('--accent','#4f7fff'),
    target: '#6366f1',
    textLow: v('--chart-text-low', '#8b8fa8'),
    surface: v('--surface-2', '#1d2237'),
  };
}
// Static fallback (used in buildZoneBands which doesn't need live values at call time)
const COLORS = {
  red:    '#ef4444',
  amber:  '#f59e0b',
  green:  '#22c55e',
  marker: '#4f7fff',
  target: '#6366f1',
};

/**
 * Normalize a raw value to 0–100 given direction and bad/mid/good anchors.
 * Returns null for neutral direction or null value.
 */
function normScore(val, direction, anchors) {
  if (val == null || !isFinite(val)) return null;
  if (direction === 'higher_better') {
    const { bad, mid, good } = anchors;
    if (val <= bad)  return 0;
    if (val <= mid)  return 50 * (val - bad) / (mid - bad);
    if (val <= good) return 50 + 50 * (val - mid) / (good - mid);
    return 100;
  }
  if (direction === 'lower_better') {
    const { good, mid, bad } = anchors;
    if (val <= good) return 100;
    if (val <= mid)  return 50 + 50 * (mid - val) / (mid - good);
    if (val <= bad)  return 50 * (bad - val) / (bad - mid);
    return 0;
  }
  return null;
}

/** Map a 0–100 norm score to 'red' | 'amber' | 'green' | 'gray'. */
function scoreToLevel(score) {
  if (score == null) return 'gray';
  if (score >= 67) return 'green';
  if (score >= 33) return 'amber';
  return 'red';
}

/**
 * Build ECharts markArea zone bands from anchors.
 * Returns an array of [startPt, endPt] pairs for use in markArea.data.
 *
 * For lower_better: left = bad (red), right = good (green).
 * For higher_better: left = bad (red), right = good (green).
 * The axis always runs from chartMin to chartMax.
 */
function buildZoneBands(direction, anchors, chartMin, chartMax) {
  const { bad, mid, good } = direction === 'lower_better'
    ? { good: anchors.good, mid: anchors.mid, bad: anchors.bad }
    : anchors;

  const opacity = 0.45;
  const band = (x0, x1, color) => [
    { xAxis: x0, itemStyle: { color, opacity } },
    { xAxis: x1 },
  ];

  if (direction === 'lower_better') {
    return [
      band(chartMin, good, COLORS.green),
      band(good,     mid,  COLORS.amber),
      band(mid,      bad,  COLORS.red),
      band(bad,      chartMax, '#ef444488'),  // deep red overshoot
    ];
  }
  if (direction === 'higher_better') {
    return [
      band(chartMin, bad,  '#ef444488'),
      band(bad,      mid,  COLORS.red),
      band(mid,      good, COLORS.amber),
      band(good,     chartMax, COLORS.green),
    ];
  }
  // neutral — single gray band
  return [band(chartMin, chartMax, '#94a3b820')];
}

/**
 * Build the full ECharts option for a horizontal bullet + sparkline chart.
 *
 * @param {Object} cfg
 *   label         — indicator display name
 *   value         — current (latest year) raw value
 *   unit          — unit string
 *   direction     — 'lower_better' | 'higher_better' | 'neutral'
 *   anchors       — { bad, mid, good }
 *   series        — [{year, value}] full time series (for sparkline)
 *   targetValue   — optional policy target value (draws a labeled line)
 *   targetLabel   — label for target line (e.g. '2030 target')
 *   fmt           — optional value formatter fn (val → string)
 */
function buildBulletOption(cfg) {
  const { label, value, unit, direction, anchors, series = [], targetValue, targetLabel, fmt } = cfg;
  const fmtVal = fmt || (v => v == null ? '—' : Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 1 }));
  const LC = liveColors();

  // Determine axis range: extend beyond bad/good by 20% padding
  const { bad, mid, good } = direction === 'lower_better'
    ? { good: anchors.good, mid: anchors.mid, bad: anchors.bad }
    : anchors;

  const dataMin = Math.min(good, bad) * 0.0;
  const padding = (Math.max(good, bad) - Math.min(good, bad)) * 0.2;
  const chartMin = Math.max(0, Math.min(good, bad) - padding);
  const chartMax = Math.max(good, bad) + padding;

  const zoneBands = buildZoneBands(direction, anchors, chartMin, chartMax);

  // Sparkline: thin grey line across all years
  const sparkData = series
    .filter(d => d.value != null)
    .map(d => [d.year, d.value]);

  const markLines = [
    {
      xAxis: value,
      lineStyle: { color: COLORS.marker, width: 2.5, type: 'solid' },
      label: {
        formatter: fmtVal(value),
        position: 'insideEndTop',
        color: COLORS.marker,
        fontWeight: 'bold',
        fontSize: 14,
      },
    },
  ];

  if (targetValue != null) {
    markLines.push({
      xAxis: targetValue,
      lineStyle: { color: COLORS.target, width: 1.5, type: 'dashed' },
      label: {
        formatter: targetLabel || 'Target',
        position: 'insideEndBottom',
        color: COLORS.target,
        fontSize: 10,
      },
    });
  }

  return {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 400,
    tooltip: { trigger: 'none', show: false },
    grid: [
      { left: 12, right: 12, top: 8, height: 44 },       // bullet row
      { left: 12, right: 12, top: 64, bottom: 20 },      // sparkline row
    ],
    xAxis: [
      {
        gridIndex: 0,
        type: 'value',
        min: chartMin,
        max: chartMax,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
      },
      {
        gridIndex: 1,
        type: 'value',
        min: chartMin,
        max: chartMax,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          show: true,
          color: LC.textLow,
          fontSize: 12,
          formatter: v => fmtVal(v),
        },
      },
    ],
    yAxis: [
      {
        gridIndex: 0,
        type: 'category',
        data: [''],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
      },
      {
        gridIndex: 1,
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
    ],
    series: [
      // Bullet bar — a bar series that draws the zone bands via markArea
      {
        type: 'bar',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: [value != null ? Math.min(value, chartMax) : 0],
        barWidth: 22,
        itemStyle: { color: 'transparent' },
        emphasis: { disabled: true },
        markArea: {
          silent: true,
          data: zoneBands,
        },
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          data: markLines,
        },
      },
      // Sparkline — thin line across the full time series
      {
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: sparkData,
        symbol: 'none',
        lineStyle: { color: LC.textLow, width: 1.5 },
        areaStyle: { color: 'rgba(100,116,139,0.1)' },
        smooth: true,
        emphasis: { disabled: true },
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          data: targetValue != null ? [{
            xAxis: targetValue,
            lineStyle: { color: COLORS.target, width: 1, type: 'dashed' },
            label: { show: false },
          }] : [],
        },
      },
    ],
  };
}
