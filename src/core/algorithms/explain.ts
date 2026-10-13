import { Hitman } from './hitman';
import type { MDPGraph } from './mdpGraph';
import { computeReachabilityProbabilities } from './reachability';
import type { ExplanationBound, ExplanationOptions, ExplanationResult } from './types';

const DEFAULT_DEVIATION = 0.2;
const DEFAULT_BOUND: ExplanationBound = 'min';
const THRESHOLD_SLACK = 1e-5;

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
  const bound = options.bound ?? DEFAULT_BOUND;
  const reachabilityOptions = { ...options, policyStateIds: new Set(candidate) };

  if (bound !== 'max') {
    const minThreshold = p0 * (1 - deviation);
    const minProb = computeReachabilityProbabilities(graph, 'min', reachabilityOptions).probabilities[initialState.id];
    if (minProb < minThreshold - THRESHOLD_SLACK) {
      return false;
    }
  }

  if (bound !== 'min') {
    const maxThreshold = Math.min(1, p0 * (1 + deviation));
    const maxProb = computeReachabilityProbabilities(graph, 'max', reachabilityOptions).probabilities[initialState.id];
    if (maxProb > maxThreshold + THRESHOLD_SLACK) {
      return false;
    }
  }

  return true;
}

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

export function grow(
  graph: MDPGraph,
  candidate: readonly string[],
  allNonEffectIds: readonly string[],
  p0: number,
  options: ExplanationOptions = {},
): string[] {
  const candidateSet = new Set(candidate);
  const initialFixedIds = allNonEffectIds.filter((id) => !candidateSet.has(id));

  if (isAXp(graph, initialFixedIds, p0, options)) {
    return [];
  }

  const fixedSet = new Set(initialFixedIds);
  const minimalCXp: string[] = [];

  for (const stateId of candidate) {
    if (!isAXp(graph, [...fixedSet, stateId], p0, options)) {
      fixedSet.add(stateId);
    } else {
      minimalCXp.push(stateId);
    }
  }

  return minimalCXp;
}


export async function enumerateXpsTargetCXps(
  graph: MDPGraph,
  p0: number,
  options: ExplanationOptions = {},
): Promise<ExplanationResult> {
  const nonEffectStateIds = graph.states.filter((state) => !state.isTargetEffect).map((state) => state.id);
  const axps: string[][] = [];
  const cxps: string[][] = [];

  const hitman = await Hitman.create<string>();
  try {
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
  } finally {
    hitman.release();
  }

  return { axps, cxps };
}


export async function enumerateXpsTargetAXps(
  graph: MDPGraph,
  p0: number,
  options: ExplanationOptions = {},
): Promise<ExplanationResult> {
  const nonEffectStateIds = graph.states.filter((state) => !state.isTargetEffect).map((state) => state.id);
  const axps: string[][] = [];
  const cxps: string[][] = [];

  const hitman = await Hitman.create<string>();
  try {
    for (;;) {
      const candidate = await hitman.get();
      if (candidate === null) {
        break;
      }

      if (isAXp(graph, candidate, p0, options)) {
        axps.push(candidate);
        hitman.block(candidate);
      } else {
        const candidateSet = new Set(candidate);
        const complement = nonEffectStateIds.filter((id) => !candidateSet.has(id));

        const cxp = grow(graph, complement,nonEffectStateIds, p0, options);
        cxps.push(cxp);
        hitman.hit(cxp);
      }
    }
  } finally {
    hitman.release();
  }

  return { axps, cxps };
}
