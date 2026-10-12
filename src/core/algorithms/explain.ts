import type { MDPState, MDPAction, MDPTransition } from '../../types/mdp';
import { buildMDPGraph } from './mdpGraph';
import type { ReachabilityMode, ReachabilityOptions, ReachabilityResult } from './types';

const DEFAULT_MAX_ITERATIONS = 1000;
const DEFAULT_TOLERANCE = 1e-9;

export function isWeakAXp(
  states: MDPState[],
  actions: MDPAction[],
  transitions: MDPTransition[],
  options: ReachabilityOptions = {}
): boolean {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;

  const { actionsByState, transitionsByAction } = buildMDPGraph(states, actions, transitions);
  const effectStateIds = new Set(states.filter((state) => state.isTargetEffect).map((state) => state.id));

  const probabilities: Record<string, number> = {};
  for (const state of states) {
    probabilities[state.id] = effectStateIds.has(state.id) ? 1 : 0;
  }

  computeReachability(buildMDPGraph)

  let iterations = 0;
  let converged = false;


  return false;
}
