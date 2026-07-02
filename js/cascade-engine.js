/**
 * cascade-engine.js — pure, dependency-free propagation engine for the folkeskole
 * cascade what-if simulator. No DOM, no fetch, no globals: takes an edge list and a
 * push fraction, returns unitless relative deltas. Extracted from cascade.js so the
 * engine can be loaded and tested standalone (see tests/test_cascade_engine.js).
 *
 * Engine invariants (see docs/simulator_plan.md §3 for full rationale):
 *   - Output is always a unitless "illustrative impact index", never a real-unit
 *     forecast. `strength` is a qualitative 0-1 ordering, not a calibrated coefficient.
 *   - Deterministic topological propagation: edges without `loop: true` form a DAG and
 *     are processed in topological order so every child sees its parent's FINAL delta,
 *     even when the parent is reached via multiple incoming paths. Loop edges (currently
 *     just income->learning_outcomes) are applied exactly once, after the DAG pass, with
 *     no further re-propagation — this is the documented Phase-1 "single forward pass,
 *     no compounding" semantics, not an oversight.
 *   - Multi-path nodes keep the largest-magnitude incoming effect, not a sum — summing
 *     would double-count shared upstream causes.
 */

// Clamp the impact index to +/-1 so it always reads as "moves this much of the way
// toward its strongest possible response" — not an unbounded number that balloons for
// large presets like +100%.
function clampUnit(v) { return Math.max(-1, Math.min(1, v)); }

function edgeKey(e) { return `${e.from}->${e.to}`; }

// Edges the literature explicitly flags as concave / diminishing-returns — apply a
// concave transform only here, not as a general nonlinear engine (match complexity to
// what the source actually claims).
const CASCADE_CONCAVE_EDGES = new Set(['income->life_satisfaction']);

function applyEdge(parentDelta, e) {
  const sign = e.direction === 'negative' ? -1 : 1;
  let childDelta = parentDelta * (e.strength || 0) * sign;
  if (CASCADE_CONCAVE_EDGES.has(edgeKey(e))) {
    // sign(x)*sqrt(|x|) — an odd function, so antisymmetry (delta(+p) === -delta(-p))
    // holds exactly through this transform.
    childDelta = Math.sign(childDelta) * Math.sqrt(Math.abs(childDelta));
  }
  return childDelta;
}

// Kahn's algorithm topological sort over the non-loop edges. Returns node ids in an
// order where every node appears after all its non-loop parents.
function topoSort(nodeIds, dagEdges) {
  const byTo = {};
  const inDegree = {};
  nodeIds.forEach(id => { inDegree[id] = 0; });
  dagEdges.forEach(e => {
    (byTo[e.to] = byTo[e.to] || []).push(e.from);
    inDegree[e.to] = (inDegree[e.to] || 0) + 1;
  });

  const byFrom = {};
  dagEdges.forEach(e => { (byFrom[e.from] = byFrom[e.from] || []).push(e.to); });

  const queue = nodeIds.filter(id => (inDegree[id] || 0) === 0);
  const order = [];
  const seen = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    (byFrom[id] || []).forEach(child => {
      inDegree[child]--;
      if (inDegree[child] === 0) queue.push(child);
    });
  }
  // Any nodes not reached (shouldn't happen for a true DAG, but be defensive) get
  // appended at the end so propagation still runs, just not topologically guaranteed.
  nodeIds.forEach(id => { if (!seen.has(id)) order.push(id); });
  return order;
}

/**
 * Propagate a lever push through a set of cascade edges as unitless relative deltas.
 * @param {Array} edges - edges for one cascade (already filtered by `cascade` field)
 * @param {string} leverId - node id of the lever (gets pushFraction as its own delta)
 * @param {number} pushFraction - the (already clamped) normalized push, e.g. +0.2
 * @returns {{ deltas: Record<string, number>, dominantEdge: Record<string, object> }}
 */
function propagateCascade(edges, leverId, pushFraction) {
  const dagEdges = edges.filter(e => !e.loop);
  const loopEdges = edges.filter(e => e.loop);

  const nodeIds = new Set([leverId]);
  edges.forEach(e => { nodeIds.add(e.from); nodeIds.add(e.to); });

  const deltas = { [leverId]: pushFraction };
  const dominantEdge = {};

  const byFrom = {};
  dagEdges.forEach(e => { (byFrom[e.from] = byFrom[e.from] || []).push(e); });

  const order = topoSort([...nodeIds], dagEdges);

  order.forEach(nodeId => {
    const parentDelta = deltas[nodeId];
    if (parentDelta === undefined) return;
    (byFrom[nodeId] || []).forEach(e => {
      const childDelta = applyEdge(parentDelta, e);
      if (!(e.to in deltas) || Math.abs(childDelta) > Math.abs(deltas[e.to])) {
        deltas[e.to] = childDelta;
        dominantEdge[e.to] = e;
      }
    });
  });

  // Loop edges: single forward pass, applied once against whatever delta their
  // source node already settled on in the DAG pass — no re-expansion, no compounding.
  loopEdges.forEach(e => {
    const parentDelta = deltas[e.from];
    if (parentDelta === undefined) return;
    const childDelta = applyEdge(parentDelta, e);
    if (!(e.to in deltas) || Math.abs(childDelta) > Math.abs(deltas[e.to])) {
      deltas[e.to] = childDelta;
      dominantEdge[e.to] = e;
    }
  });

  return { deltas, dominantEdge };
}

if (typeof module !== 'undefined') {
  module.exports = { propagateCascade, clampUnit, edgeKey, CASCADE_CONCAVE_EDGES };
}
