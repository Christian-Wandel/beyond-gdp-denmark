/**
 * Invariant tests for the cascade propagation engine (js/cascade-engine.js).
 *
 * Run: node tests/test_cascade_engine.js
 *
 * These assertions exist because the project's worst bug class so far (symmetric
 * visual output for opposite-sign inputs — the node-size-direction bug, 2026-07-01)
 * survived Playwright screenshot verification and was only caught by a human's own
 * intuition check. Mechanize that class of check here.
 */

const path = require('path');
const fs = require('fs');
const { propagateCascade, clampUnit } = require(path.join(__dirname, '..', 'js', 'cascade-engine.js'));

const relationshipsPath = path.join(__dirname, '..', 'data', 'relationships.json');
const relationships = JSON.parse(fs.readFileSync(relationshipsPath, 'utf-8'));

const FOCUS = 'education';
const edges = relationships.edges.filter(e => e.cascade === FOCUS);
const leverId = relationships.cascades[FOCUS].lever;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`PASS: ${message}`);
  } else {
    failed++;
    console.log(`FAIL: ${message}`);
  }
}

function almostEqual(a, b, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}

// ── Antisymmetry: deltas(+p) === -deltas(-p) for every node ────────────────────────
// Holds exactly because every transform in the engine (strength*sign multiplication,
// and the concave sign(x)*sqrt(|x|) transform) is an odd function.
{
  const pos = propagateCascade(edges, leverId, 0.2).deltas;
  const neg = propagateCascade(edges, leverId, -0.2).deltas;
  const nodeIds = new Set([...Object.keys(pos), ...Object.keys(neg)]);
  let allMatch = true;
  nodeIds.forEach(id => {
    const p = pos[id] ?? 0;
    const n = neg[id] ?? 0;
    if (!almostEqual(p, -n, 1e-9)) {
      allMatch = false;
      console.log(`  antisymmetry mismatch at "${id}": +0.2 -> ${p}, -0.2 -> ${n} (expected ${-n} === ${p})`);
    }
  });
  assert(allMatch, 'antisymmetry: deltas(+0.2) === -deltas(-0.2) for every node');
}

// ── Clamp: all |delta| <= 1 at the push boundary (+/-1) ─────────────────────────────
{
  const atMax = propagateCascade(edges, leverId, clampUnit(1)).deltas;
  const atMin = propagateCascade(edges, leverId, clampUnit(-1)).deltas;
  const allWithinBounds = [...Object.values(atMax), ...Object.values(atMin)]
    .every(d => Math.abs(d) <= 1 + 1e-9);
  assert(allWithinBounds, 'clamp: |delta| <= 1 for every node at pushFraction = +/-1');
}

// ── Zero push -> all deltas zero (besides the lever itself) ────────────────────────
{
  const { deltas } = propagateCascade(edges, leverId, 0);
  const allZero = Object.entries(deltas)
    .filter(([id]) => id !== leverId)
    .every(([, d]) => almostEqual(d, 0));
  assert(allZero, 'zero push: all non-lever deltas are exactly 0');
  assert(deltas[leverId] === 0, 'zero push: lever delta itself is 0');
}

// ── Monotonicity: a bigger push never produces a smaller ripple ────────────────────
{
  const small = propagateCascade(edges, leverId, 0.1).deltas;
  const big = propagateCascade(edges, leverId, 0.2).deltas;
  const nodeIds = new Set([...Object.keys(small), ...Object.keys(big)]);
  let allMonotonic = true;
  nodeIds.forEach(id => {
    const s = Math.abs(small[id] ?? 0);
    const b = Math.abs(big[id] ?? 0);
    if (b < s - 1e-9) {
      allMonotonic = false;
      console.log(`  monotonicity violation at "${id}": |delta(0.1)|=${s} > |delta(0.2)|=${b}`);
    }
  });
  assert(allMonotonic, 'monotonicity: |deltas(0.2)[n]| >= |deltas(0.1)[n]| for every node');
}

// ── Attenuation: for non-concave dominant edges, |child| <= |parent| ───────────────
// (strength is a 0-1 ordering, so a single hop can only shrink or hold magnitude —
// except on edges flagged concave, which can amplify small deltas via sqrt.)
{
  const { deltas, dominantEdge } = propagateCascade(edges, leverId, 0.2);
  const { CASCADE_CONCAVE_EDGES, edgeKey } = require(path.join(__dirname, '..', 'js', 'cascade-engine.js'));
  let allAttenuated = true;
  Object.entries(dominantEdge).forEach(([nodeId, e]) => {
    if (CASCADE_CONCAVE_EDGES.has(edgeKey(e))) return; // concave edges can amplify by design
    const parentDelta = Math.abs(deltas[e.from] ?? 0);
    const childDelta = Math.abs(deltas[nodeId] ?? 0);
    if (childDelta > parentDelta + 1e-9) {
      allAttenuated = false;
      console.log(`  attenuation violation on ${e.from}->${e.to}: |parent|=${parentDelta} < |child|=${childDelta}`);
    }
  });
  assert(allAttenuated, 'attenuation: |child delta| <= |parent delta| for non-concave dominant edges');
}

// ── Sanity: lever node itself carries the raw pushFraction ─────────────────────────
{
  const { deltas } = propagateCascade(edges, leverId, 0.37);
  assert(almostEqual(deltas[leverId], 0.37), 'lever node delta equals the raw pushFraction unchanged');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
