import type { MDPState, MDPAction, MDPTransition } from "../../types/mdp";
import { buildMDPGraph } from "./mdpGraph";
import type {
  ReachabilityMode,
  ReachabilityOptions,
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
 * Computes, for every state, the maximum or minimum probability of eventually
 * reaching a state flagged `isTargetEffect` — the standard MDP model-checking
 * reachability query (PRISM's Pmax=?[F effect] / Pmin=?[F effect]), solved by
 * value iteration with effect states pinned to 1 and dead ends (no actions,
 * not an effect state) pinned to 0.
 */
export function computeReachabilityProbability(
  states: MDPState[],
  actions: MDPAction[],
  transitions: MDPTransition[],
  mode: ReachabilityMode,
  options: ReachabilityOptions = {},
): ReachabilityResult {
  const { actionsByState, transitionsByAction } = buildMDPGraph(
    states,
    actions,
    transitions,
  );

  return computeReachability(
    states,
    actionsByState,
    transitionsByAction,
    mode,
    options,
  );
}

export function computeReachability(
  states: MDPState[],
  actionsByState: Map<string, MDPAction[]>,
  transitionsByAction: Map<string, MDPTransition[]>,
  mode: ReachabilityMode,
  options: ReachabilityOptions = {},
) {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const probabilities: Record<string, number> = {};
  const nonEffectStates: MDPState[] = []

  for (const state of states){
      if (state.isTargetEffect) {
          probabilities[state.id] = 1;
      } else {
          probabilities[state.id] = 0;
          nonEffectStateIds.push(state);
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

      let chosenValue = mode === "max" ? -Infinity : mode === "min" ? Infinity : 0.0;
      for (const action of stateActions) {
        const expectedProbability = expectedActionProbability(
          action,
          transitionsByAction,
          probabilities,
        );
        if (mode === "max"){
            chosenValue = Math.max(chosenValue, expectedProbability);
        }
        else if (mode === "min"){
            chosenValue = Math.min(chosenValue, expectedProbability);
        }
        else {
            chosenValue += expectedProbability*(action?.policy ?? 0);
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
      console.log("has conv");
      converged = true;
      iterations += 1;
      break;
    }
  }

  const policy: Record<string, string | null> = {};
  for (const state of states) {
    if (effectStateIds.has(state.id)) {
      policy[state.id] = null;
      continue;
    }

    const stateActions = actionsByState.get(state.id) ?? [];
    let bestAction: MDPAction | null = null;
    let chosenValue = mode === "max" ? -Infinity : Infinity;
    for (const action of stateActions) {
      const expectedProbability = expectedActionProbability(
        action,
        transitionsByAction,
        probabilities,
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

  console.log(probabilities);

  return { probabilities, policy, iterations, converged };
}
