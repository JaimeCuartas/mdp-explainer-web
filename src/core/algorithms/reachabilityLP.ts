import type { Highs } from 'highs';
import type { MDPAction } from '../../types/mdp';
import type { MDPGraph } from './mdpGraph';
import { computeReachabilityProbabilities } from './reachability';
import type {
  ReachabilityMethod,
  ReachabilityMode,
  ReachabilityOptions,
  ReachabilityProbabilities,
} from './types';

// Linear-programming counterpart of computeReachabilityProbabilities, solved
// with HiGHS (compiled to WebAssembly). Each non-effect state s gets a variable
// x_s in [0, 1]; effect states are the constant 1. A state in policyStateIds (or
// every state, in 'policy' mode) has the single "action" that mixes its actions
// by action.policy, exactly as value iteration does.
//
// - 'max' and 'policy': minimise sum(x) subject to x_s >= sum_t P(s,a,t) x_t for
//   every action a. The feasible points are the pre-fixed points of the Bellman
//   operator, whose componentwise least element is its least fixed point, i.e.
//   the reachability probabilities.
// - 'min': maximise sum(x) subject to x_s <= sum_t P(s,a,t) x_t for every action
//   a. This gives the greatest fixed point, which is the min reachability only
//   once the states that can avoid the effect forever are fixed to 0, so those
//   are found by a graph search first.

/** Same signature as computeReachabilityProbabilities, so the two are interchangeable. */
export type ReachabilitySolver = (
  graph: MDPGraph,
  mode: ReachabilityMode,
  options?: ReachabilityOptions,
) => ReachabilityProbabilities;

let highsPromise: Promise<Highs> | null = null;

function loadHighs(): Promise<Highs> {
  // Imported on first use so value-iteration-only sessions never download the ~3.5MB wasm.
  // Loading compiles it, so do it once and reuse the instance (each solve is independent).
  highsPromise ??= import('highs').then(({ default: highsLoader }) => highsLoader());
  return highsPromise;
}

/** Resolves the reachability computation for `method`, loading HiGHS if it's needed. */
export async function loadReachabilitySolver(
  method: ReachabilityMethod = 'value-iteration',
): Promise<ReachabilitySolver> {
  if (method === 'value-iteration') {
    return computeReachabilityProbabilities;
  }
  const highs = await loadHighs();
  return (graph, mode, options) => computeReachabilityProbabilitiesLP(highs, graph, mode, options);
}

/** One "action" of a state as seen by the LP: target state id -> probability. */
type Distribution = Map<string, number>;

function addProbability(distribution: Distribution, targetId: string, probability: number): void {
  distribution.set(targetId, (distribution.get(targetId) ?? 0) + probability);
}

function actionDistribution(graph: MDPGraph, action: MDPAction, weight = 1): Distribution {
  const distribution: Distribution = new Map();
  for (const transition of graph.transitionsByAction.get(action.id) ?? []) {
    addProbability(distribution, transition.targetStateId, weight * transition.probability);
  }
  return distribution;
}

/**
 * The distributions each non-effect state chooses from: the policy mixture for
 * states that follow the policy, otherwise one per action. States without
 * actions get none, so they stay at 0 like in value iteration.
 */
function stateDistributions(
  graph: MDPGraph,
  mode: ReachabilityMode,
  options: ReachabilityOptions,
): Map<string, Distribution[]> {
  const distributionsByState = new Map<string, Distribution[]>();
  for (const state of graph.states) {
    if (state.isTargetEffect) {
      continue;
    }
    const stateActions = graph.actionsByState.get(state.id) ?? [];
    if (stateActions.length === 0) {
      distributionsByState.set(state.id, []);
    } else if (mode === 'policy' || options.policyStateIds?.has(state.id)) {
      const mixture: Distribution = new Map();
      for (const action of stateActions) {
        for (const [targetId, probability] of actionDistribution(graph, action, action.policy ?? 0)) {
          addProbability(mixture, targetId, probability);
        }
      }
      distributionsByState.set(state.id, [mixture]);
    } else {
      distributionsByState.set(
        state.id,
        stateActions.map((action) => actionDistribution(graph, action)),
      );
    }
  }
  return distributionsByState;
}

/**
 * Non-effect states from which some choice of distributions avoids the effect
 * forever (min reachability 0): the complement of the states that are forced
 * to reach it with positive probability.
 */
function minZeroStates(graph: MDPGraph, distributionsByState: Map<string, Distribution[]>): Set<string> {
  const forced = new Set(graph.states.filter((state) => state.isTargetEffect).map((state) => state.id));
  const hitsForced = (distribution: Distribution) =>
    [...distribution].some(([targetId, probability]) => probability > 0 && forced.has(targetId));

  let changed = true;
  while (changed) {
    changed = false;
    for (const [stateId, distributions] of distributionsByState) {
      if (!forced.has(stateId) && distributions.length > 0 && distributions.every(hitsForced)) {
        forced.add(stateId);
        changed = true;
      }
    }
  }
  return new Set([...distributionsByState.keys()].filter((stateId) => !forced.has(stateId)));
}

function formatCoefficient(value: number): string {
  // Plain decimal notation; HiGHS reads exponents too, but this keeps the model readable when debugging.
  return Number.isInteger(value) ? String(value) : value.toPrecision(17).replace(/\.?0+$/, '');
}

function formatTerm(coefficient: number, variable: string): string {
  const sign = coefficient < 0 ? '-' : '+';
  return `${sign} ${formatCoefficient(Math.abs(coefficient))} ${variable}`;
}

const COEFFICIENT_EPSILON = 1e-15;

export function computeReachabilityProbabilitiesLP(
  highs: Highs,
  graph: MDPGraph,
  mode: ReachabilityMode,
  options: ReachabilityOptions = {},
): ReachabilityProbabilities {
  const distributionsByState = stateDistributions(graph, mode, options);
  const zeroStates = mode === 'min' ? minZeroStates(graph, distributionsByState) : new Set<string>();

  const probabilities: Record<string, number> = {};
  const variableByState = new Map<string, string>();
  for (const state of graph.states) {
    if (state.isTargetEffect) {
      probabilities[state.id] = 1;
    } else if (zeroStates.has(state.id)) {
      probabilities[state.id] = 0;
    } else {
      // State ids may contain characters the LP format doesn't allow, so use positional names.
      variableByState.set(state.id, `x${variableByState.size}`);
    }
  }

  if (variableByState.size === 0) {
    return { probabilities, iterations: 0, converged: true };
  }

  // Row for distribution d of state s:  x_s - sum_t d(t) x_t  (>= or <=)  sum_{t constant} d(t) * value(t).
  const relation = mode === 'min' ? '<=' : '>=';
  const rows: string[] = [];
  for (const [stateId, variable] of variableByState) {
    for (const distribution of distributionsByState.get(stateId) ?? []) {
      const coefficients = new Map<string, number>([[variable, 1]]);
      let constant = 0;
      for (const [targetId, probability] of distribution) {
        const targetVariable = variableByState.get(targetId);
        if (targetVariable === undefined) {
          constant += probability * (probabilities[targetId] ?? 0);
        } else {
          coefficients.set(targetVariable, (coefficients.get(targetVariable) ?? 0) - probability);
        }
      }
      const terms = [...coefficients]
        .filter(([, coefficient]) => Math.abs(coefficient) > COEFFICIENT_EPSILON)
        .map(([name, coefficient]) => formatTerm(coefficient, name));
      if (terms.length === 0) {
        // 0 >= constant or 0 <= constant: always true here (a probability-1 self-loop has constant 0).
        continue;
      }
      rows.push(` r${rows.length}: ${terms.join(' ')} ${relation} ${formatCoefficient(constant)}`);
    }
  }

  const variables = [...variableByState.values()];
  const model = [
    mode === 'min' ? 'Maximize' : 'Minimize',
    ` obj: ${variables.join(' + ')}`,
    'Subject To',
    // The LP format needs at least one row; this one is always satisfied.
    ...(rows.length > 0 ? rows : [` r0: ${variables[0]} >= 0`]),
    'Bounds',
    ...variables.map((name) => ` 0 <= ${name} <= 1`),
    'End',
  ].join('\n');

  const solution = highs.solve(model);
  if (solution.Status !== 'Optimal') {
    throw new Error(`Linear program for ${mode} reachability failed: ${solution.Status}`);
  }

  for (const [stateId, variable] of variableByState) {
    const column = solution.Columns[variable];
    // Clamp tiny solver round-off outside [0, 1].
    probabilities[stateId] = Math.min(1, Math.max(0, column && 'Primal' in column ? column.Primal : 0));
  }

  return { probabilities, iterations: 0, converged: true };
}
