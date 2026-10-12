import type { MDPState, MDPAction, MDPTransition } from "../../types/mdp";
import { buildMDPGraph } from "./mdpGraph";
import type { MDPGraph } from "./mdpGraph";
import type {
  ReachabilityMode,
  ReachabilityOptions,
  ReachabilityProbabilities,
  ReachabilityResult,
} from "./types";

const DEFAULT_MAX_ITERATIONS = 1000;
const DEFAULT_TOLERANCE = 1e-9;

function expectedActionProbability(
  action: MDPAction,
  transitionsByAction: Map<string, MDPTransition[]>,
  probabilities: Record<string, number>,
): number {
  const actionTransitions = transitionsByAction.get(action.id) ?? [];
  let expectedProbability = 0;
  for (const transition of actionTransitions) {
    expectedProbability +=
      transition.probability * probabilities[transition.targetStateId];
  }
  return expectedProbability;
}

/**
 * Computes, for every state, the probability of eventually reaching a state
 * flagged `isTargetEffect` — the standard MDP model-checking reachability
 * query (PRISM's Pmax=?[F effect] / Pmin=?[F effect]), solved by value
 * iteration with effect states pinned to 1 and dead ends (no actions, not an
 * effect state) pinned to 0. `mode` resolves each state's choice by its best
 * ('max') or worst ('min') action, or by the stochastic policy ('policy');
 * states in `options.policyStateIds` always follow the policy.
 *
 * Probabilities only: see `computeReachabilityPolicy` for the policy that
 * achieves the max/min.
 */
export function computeReachabilityProbabilities(
  graph: MDPGraph,
  mode: ReachabilityMode,
  options: ReachabilityOptions = {},
): ReachabilityProbabilities {
  const { states, actionsByState, transitionsByAction } = graph;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const probabilities: Record<string, number> = {};
  const nonEffectStates: MDPState[] = [];

  for (const state of states) {
    if (state.isTargetEffect) {
      probabilities[state.id] = 1;
    } else {
      probabilities[state.id] = 0;
      nonEffectStates.push(state);
    }
  }

  let iterations = 0;
  let converged = false;

  for (; iterations < maxIterations; iterations++) {
    const nextProbabilities: Record<string, number> = {};

    for (const state of nonEffectStates) {
      const stateActions = actionsByState.get(state.id) ?? [];
      if (stateActions.length === 0) {
        nextProbabilities[state.id] = 0;
        continue;
      }

      const stateMode = options.policyStateIds?.has(state.id)
        ? "policy"
        : mode;
      let chosenValue =
        stateMode === "max" ? -Infinity : stateMode === "min" ? Infinity : 0.0;
      for (const action of stateActions) {
        const expectedProbability = expectedActionProbability(
          action,
          transitionsByAction,
          probabilities,
        );
        if (stateMode === "max") {
          chosenValue = Math.max(chosenValue, expectedProbability);
        } else if (stateMode === "min") {
          chosenValue = Math.min(chosenValue, expectedProbability);
        } else {
          chosenValue += expectedProbability * (action.policy ?? 0);
        }
      }
      nextProbabilities[state.id] = chosenValue;
    }

    let maxDelta = 0;
    for (const state of nonEffectStates) {
      maxDelta = Math.max(
        maxDelta,
        Math.abs(nextProbabilities[state.id] - probabilities[state.id]),
      );
      probabilities[state.id] = nextProbabilities[state.id];
    }

    if (maxDelta < tolerance) {
      converged = true;
      iterations += 1;
      break;
    }
  }

  return { probabilities, iterations, converged };
}

/**
 * The deterministic policy achieving the max ('max') or min ('min')
 * reachability probability, alongside those probabilities. Effect states get
 * no action (null): reaching them already ends the query.
 */
export function computeReachabilityPolicy(
  states: MDPState[],
  actions: MDPAction[],
  transitions: MDPTransition[],
  mode: Exclude<ReachabilityMode, "policy">,
  options: ReachabilityOptions = {},
): ReachabilityResult {
  const graph = buildMDPGraph(states, actions, transitions);
  const result = computeReachabilityProbabilities(graph, mode, options);

  const policy: Record<string, string | null> = {};
  for (const state of states) {
    if (state.isTargetEffect) {
      policy[state.id] = null;
      continue;
    }

    const stateActions = graph.actionsByState.get(state.id) ?? [];
    let bestAction: MDPAction | null = null;
    let chosenValue = mode === "max" ? -Infinity : Infinity;
    for (const action of stateActions) {
      const expectedProbability = expectedActionProbability(
        action,
        graph.transitionsByAction,
        result.probabilities,
      );
      const isBetter =
        mode === "max"
          ? expectedProbability > chosenValue
          : expectedProbability < chosenValue;
      if (isBetter) {
        chosenValue = expectedProbability;
        bestAction = action;
      }
    }
    policy[state.id] = bestAction ? bestAction.id : null;
  }

  return { ...result, policy };
}

/**
 * The probability of eventually reaching an effect state when every state
 * follows the current stochastic policy (`action.policy`).
 */
export function evaluatePolicyReachability(
  states: MDPState[],
  actions: MDPAction[],
  transitions: MDPTransition[],
  options: ReachabilityOptions = {},
): ReachabilityProbabilities {
  return computeReachabilityProbabilities(
    buildMDPGraph(states, actions, transitions),
    "policy",
    options,
  );
}
