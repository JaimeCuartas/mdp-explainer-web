import { Hitman } from './hitman';
import type { MDPGraph } from './mdpGraph';
import { computeReachability } from './reachability';
import type { ExplanationOptions, ExplanationResult, ReachabilityBounds } from './types';

const DEFAULT_DEVIATION = 0.2;
// Slack on the threshold checks so value-iteration noise doesn't flip a verdict.
const THRESHOLD_SLACK = 1e-5;

/**
 * Min/max reachability when the candidate states keep following the policy and
 * every other non-effect state is free to pick its worst (min) or best (max)
 * action.
 */
export function computeBounds(
  graph: MDPGraph,
  candidate: readonly string[],
  options: ExplanationOptions = {},
): ReachabilityBounds {
  const { states, actionsByState, transitionsByAction } = graph;
  const reachabilityOptions = { ...options, policyStateIds: new Set(candidate) };

  return {
    min: computeReachability(states, actionsByState, transitionsByAction, 'min', reachabilityOptions).probabilities,
    max: computeReachability(states, actionsByState, transitionsByAction, 'max', reachabilityOptions).probabilities,
  };
}

/**
 * Whether fixing the candidate states to the policy is sufficient to keep the
 * initial state's reachability within the allowed deviation of p0.
 */
export function isAXp(
  graph: MDPGraph,
  candidate: readonly string[],
  p0: number,
  options: ExplanationOptions = {},
): boolean {
  const initialState = graph.states.find((state) => state.isInitial) ?? graph.states[0];
  if (!initialState) {
    return false;
  }

  const deviation = options.deviation ?? DEFAULT_DEVIATION;
  const minThreshold = p0 * (1 - deviation);
  const maxThreshold = Math.min(1, p0 * (1 + deviation));

  const bounds = computeBounds(graph, candidate, options);
  const reachMin = bounds.min[initialState.id];
  const reachMax = bounds.max[initialState.id];

  return reachMin >= minThreshold - THRESHOLD_SLACK && reachMax <= maxThreshold + THRESHOLD_SLACK;
}

/**
 * Deletion-based reduction of a sufficient candidate to a subset-minimal AXp.
 * Returns [] if the candidate is not sufficient to begin with.
 */
export function shrink(
  graph: MDPGraph,
  candidate: readonly string[],
  p0: number,
  options: ExplanationOptions = {},
): string[] {
  let currentCandidate = [...candidate];

  if (!isAXp(graph, currentCandidate, p0, options)) {
    return [];
  }

  for (const stateId of candidate) {
    const reducedCandidate = currentCandidate.filter((id) => id !== stateId);
    if (isAXp(graph, reducedCandidate, p0, options)) {
      currentCandidate = reducedCandidate;
    }
  }

  return currentCandidate;
}

/**
 * Enumerates all AXps (and, as a by-product, CXps) over the non-effect states
 * via AXp/CXp hitting-set duality: each minimal hitting set proposed by the
 * Hitman is either a CXp (its complement is not sufficient) or its complement
 * shrinks to a new AXp.
 */
export async function enumerateXpsTargetCXps(
  graph: MDPGraph,
  p0: number,
  options: ExplanationOptions = {},
): Promise<ExplanationResult> {
  const nonEffectStateIds = graph.states.filter((state) => !state.isTargetEffect).map((state) => state.id);
  const axps: string[][] = [];
  const cxps: string[][] = [];

  const hitman = await Hitman.create<string>();
  for (;;) {
    const candidate = await hitman.get();
    if (candidate === null) {
      break;
    }

    const candidateIds = new Set(candidate);
    const complement = nonEffectStateIds.filter((id) => !candidateIds.has(id));

    if (isAXp(graph, complement, p0, options)) {
      const axp = shrink(graph, complement, p0, options);
      axps.push(axp);
      hitman.hit(axp);
    } else {
      cxps.push(candidate);
      hitman.block(candidate);
    }
  }

  return { axps, cxps };
}
