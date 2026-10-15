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

const OPTIMALITY_TOLERANCE = 1e-6;

function optimalActions(
  graph: MDPGraph,
  probabilities: Record<string, number>,
): Map<string, MDPAction[]> {
  const optimalActionsByState = new Map<string, MDPAction[]>();
  for (const state of graph.states) {
    if (state.isTargetEffect) {
      continue;
    }
    optimalActionsByState.set(
      state.id,
      (graph.actionsByState.get(state.id) ?? []).filter(
        (action) =>
          Math.abs(
            expectedActionProbability(action, graph.transitionsByAction, probabilities) -
              probabilities[state.id],
          ) <= OPTIMALITY_TOLERANCE,
      ),
    );
  }
  return optimalActionsByState;
}

function extractMinPolicy(
  optimalActionsByState: Map<string, MDPAction[]>,
): Record<string, string | null> {
  const policy: Record<string, string | null> = {};

  for (const [stateId, stateOptimalActions] of optimalActionsByState) {
    policy[stateId] = stateOptimalActions[0]?.id ?? null;
  }

  return policy;
}

function extractMaxPolicy(
  graph: MDPGraph,
  optimalActionsByState: Map<string, MDPAction[]>,
): Record<string, string | null> {
  const policy: Record<string, string | null> = {};
  const reached = new Set(
    graph.states.filter((state) => state.isTargetEffect).map((state) => state.id),
  );

  let changed = true;
  while (changed) {
    changed = false;
    for (const [stateId, stateOptimalActions] of optimalActionsByState) {
      if (reached.has(stateId)) {
        continue;
      }
      const progressingAction = stateOptimalActions.find((action) =>
        (graph.transitionsByAction.get(action.id) ?? []).some(
          (transition) =>
            transition.probability > 0 && reached.has(transition.targetStateId),
        ),
      );
      if (progressingAction) {
        policy[stateId] = progressingAction.id;
        reached.add(stateId);
        changed = true;
      }
    }
  }

  for (const [stateId, stateOptimalActions] of optimalActionsByState) {
    if (!reached.has(stateId)) {
      policy[stateId] = stateOptimalActions[0]?.id ?? null;
    }
  }

  return policy;
}

export function computeReachabilityPolicy(
  states: MDPState[],
  actions: MDPAction[],
  transitions: MDPTransition[],
  mode: Exclude<ReachabilityMode, "policy">,
  options: ReachabilityOptions = {},
): ReachabilityResult {
  const graph = buildMDPGraph(states, actions, transitions);
  const result = computeReachabilityProbabilities(graph, mode, options);
  const optimalActionsByState = optimalActions(graph, result.probabilities);

  const policy =
    mode === "max"
      ? extractMaxPolicy(graph, optimalActionsByState)
      : extractMinPolicy(optimalActionsByState);
  for (const state of states) {
    if (state.isTargetEffect) {
      policy[state.id] = null;
    }
  }
  console.log({...result, policy});

  return { ...result, policy };
}

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
