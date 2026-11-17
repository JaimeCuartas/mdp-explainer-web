import type { Highs } from "highs";
import type { MDPGraph } from "./mdpGraph";
import type {
  ExplanationBound,
  ExplanationOptions,
  ExplanationResult,
} from "./types";

export type InflationLevels = Record<string, number>;

export interface InflatedExplanationResult extends ExplanationResult {
  levels: InflationLevels;
}

const DEFAULT_DEVIATION = 0.2;
const DEFAULT_BOUND: ExplanationBound = "min";
const THRESHOLD_SLACK = 1e-5;
const DEFAULT_MAX_ITERATIONS = 1000;
const DEFAULT_TOLERANCE = 1e-9;

const LEVEL_STEPS = 10;
const levelOfStep = (step: number) => step / LEVEL_STEPS;

export function computeInflatedReachability(
  graph: MDPGraph,
  mode: "min" | "max",
  levels: InflationLevels,
  options: ExplanationOptions = {},
): Record<string, number> {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;

  const probabilities: Record<string, number> = {};
  const nonEffectStates = graph.states.filter((state) => !state.isTargetEffect);
  for (const state of graph.states) {
    probabilities[state.id] = state.isTargetEffect ? 1 : 0;
  }

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const next: Record<string, number> = {};

    for (const state of nonEffectStates) {
      const stateActions = graph.actionsByState.get(state.id) ?? [];
      if (stateActions.length === 0) {
        next[state.id] = 0;
        continue;
      }

      const actionValues: number[] = [];
      let policyValue = 0;
      for (const action of stateActions) {
        let value = 0;
        for (const transition of graph.transitionsByAction.get(action.id) ??
          []) {
          value +=
            transition.probability * probabilities[transition.targetStateId];
        }
        actionValues.push(value);
        policyValue += (action.policy ?? 0) * value;
      }

      // Follow the policy with probability lambda,
      // otherwise take the action
      const lambda = levels[state.id] ?? 0;
      let chosen = mode === "max" ? -Infinity : Infinity;
      for (const actionValue of actionValues) {
        const inflatedValue = lambda * policyValue + (1 - lambda) * actionValue;
        chosen =
          mode === "max"
            ? Math.max(chosen, inflatedValue)
            : Math.min(chosen, inflatedValue);
      }
      next[state.id] = chosen;
    }

    let maxDelta = 0;
    for (const state of nonEffectStates) {
      maxDelta = Math.max(
        maxDelta,
        Math.abs(next[state.id] - probabilities[state.id]),
      );
      probabilities[state.id] = next[state.id];
    }
    if (maxDelta < tolerance) {
      break;
    }
  }

  return probabilities;
}

export function isAXpInflated(
  graph: MDPGraph,
  levels: InflationLevels,
  p0: number,
  options: ExplanationOptions = {},
): boolean {
  const initialState =
    graph.states.find((state) => state.isInitial) ?? graph.states[0];
  if (!initialState) {
    return false;
  }

  const deviation = options.deviation ?? DEFAULT_DEVIATION;
  const bound = options.bound ?? DEFAULT_BOUND;

  if (bound !== "max") {
    const minThreshold = p0 - deviation;
    const minProb = computeInflatedReachability(graph, "min", levels, options)[
      initialState.id
    ];
    if (minProb < minThreshold - THRESHOLD_SLACK) {
      return false;
    }
  }

  if (bound !== "min") {
    const maxThreshold = Math.min(1, p0 + deviation);
    const maxProb = computeInflatedReachability(graph, "max", levels, options)[
      initialState.id
    ];
    if (maxProb > maxThreshold + THRESHOLD_SLACK) {
      return false;
    }
  }

  return true;
}

export async function extractInflatedAXp(
  graph: MDPGraph,
  p0: number,
  options: ExplanationOptions = {},
): Promise<InflatedExplanationResult> {
  return extractInflatedAXpInOrder(
    graph,
    p0,
    options,
    nonEffectStateIdsOf(graph),
  );
}

export async function extractInflatedAXpReverse(
  graph: MDPGraph,
  p0: number,
  options: ExplanationOptions = {},
): Promise<InflatedExplanationResult> {
  return extractInflatedAXpInOrder(
    graph,
    p0,
    options,
    nonEffectStateIdsOf(graph).reverse(),
  );
}

function nonEffectStateIdsOf(graph: MDPGraph): string[] {
  return graph.states
    .filter((state) => !state.isTargetEffect)
    .map((state) => state.id);
}

function extractInflatedAXpInOrder(
  graph: MDPGraph,
  p0: number,
  options: ExplanationOptions,
  order: string[],
): InflatedExplanationResult {
  const nonEffectStateIds = nonEffectStateIdsOf(graph);

  const lambda: InflationLevels = {};
  for (const stateId of nonEffectStateIds) {
    lambda[stateId] = 1;
  }

  if (!isAXpInflated(graph, lambda, p0, options)) {
    return { axps: [], cxps: [], levels: {} };
  }

  for (const stateId of order) {
    lambda[stateId] = 0;
    if (isAXpInflated(graph, lambda, p0, options)) {
      continue;
    }

    let low = 0;
    let high = LEVEL_STEPS;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      lambda[stateId] = levelOfStep(middle);
      if (isAXpInflated(graph, lambda, p0, options)) {
        high = middle;
      } else {
        low = middle;
      }
    }
    lambda[stateId] = levelOfStep(high);
  }

  const axp = nonEffectStateIds.filter((stateId) => lambda[stateId] > 0);
  const axpLevels: InflationLevels = {};
  for (const stateId of axp) {
    axpLevels[stateId] = lambda[stateId];
  }
  return { axps: [axp], cxps: [], levels: axpLevels };
}

export async function extractInflatedCXp(
  graph: MDPGraph,
  p0: number,
  options: ExplanationOptions = {},
): Promise<InflatedExplanationResult> {
  return extractInflatedCXpInOrder(
    graph,
    p0,
    options,
    nonEffectStateIdsOf(graph),
  );
}

export async function extractInflatedCXpReverse(
  graph: MDPGraph,
  p0: number,
  options: ExplanationOptions = {},
): Promise<InflatedExplanationResult> {
  return extractInflatedCXpInOrder(
    graph,
    p0,
    options,
    nonEffectStateIdsOf(graph).reverse(),
  );
}

function extractInflatedCXpInOrder(
  graph: MDPGraph,
  p0: number,
  options: ExplanationOptions,
  order: string[],
): InflatedExplanationResult {
  const nonEffectStateIds = nonEffectStateIdsOf(graph);

  const lambda: InflationLevels = {};
  for (const stateId of nonEffectStateIds) {
    lambda[stateId] = 0;
  }

  if (isAXpInflated(graph, lambda, p0, options)) {
    return { axps: [], cxps: [], levels: {} };
  }

  for (const stateId of order) {
    lambda[stateId] = 1;
    if (!isAXpInflated(graph, lambda, p0, options)) {
      continue;
    }

    let low = 0;
    let high = LEVEL_STEPS;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      lambda[stateId] = levelOfStep(middle);
      if (isAXpInflated(graph, lambda, p0, options)) {
        high = middle;
      } else {
        low = middle;
      }
    }
    lambda[stateId] = levelOfStep(low);
  }

  const cxp = nonEffectStateIds.filter((stateId) => lambda[stateId] < 1);
  const cxpLevels: InflationLevels = {};
  for (const stateId of cxp) {
    cxpLevels[stateId] = lambda[stateId];
  }
  return { axps: [], cxps: [cxp], levels: cxpLevels };
}

export interface OptimalInflatedExplanationResult extends InflatedExplanationResult {
  cxpLevels: InflationLevels[];
}

const MAX_HITTING_SET_ITERATIONS = 1000;

let highsPromise: Promise<Highs> | null = null;

function loadHighs(): Promise<Highs> {
  highsPromise ??= import("highs").then(({ default: highsLoader }) =>
    highsLoader(),
  );
  return highsPromise;
}

const stepOfLevel = (level: number) => Math.round(level * LEVEL_STEPS);

function choiceStateIdsOf(graph: MDPGraph): string[] {
  return nonEffectStateIdsOf(graph).filter(
    (stateId) => (graph.actionsByState.get(stateId) ?? []).length > 1,
  );
}

function extractInflatedCXpFrom(
  graph: MDPGraph,
  p0: number,
  options: ExplanationOptions,
  start: InflationLevels,
  order: string[],
): InflationLevels {
  const lambda: InflationLevels = { ...start };

  for (const stateId of order) {
    const startStep = stepOfLevel(lambda[stateId] ?? 0);
    lambda[stateId] = 1;
    if (!isAXpInflated(graph, lambda, p0, options)) {
      continue;
    }

    let low = startStep;
    let high = LEVEL_STEPS;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      lambda[stateId] = levelOfStep(middle);
      if (isAXpInflated(graph, lambda, p0, options)) {
        high = middle;
      } else {
        low = middle;
      }
    }
    lambda[stateId] = levelOfStep(low);
  }

  return lambda;
}

function optimalHittingLevels(
  highs: Highs,
  stateIds: string[],
  cxps: InflationLevels[],
): InflationLevels {
  const levels: InflationLevels = {};
  if (stateIds.length === 0) {
    return levels;
  }

  const variable = (stateIndex: number, step: number) =>
    `y${stateIndex}_${step}`;
  const variables: string[] = [];
  const rows: string[] = [];
  stateIds.forEach((_, i) => {
    for (let k = 1; k <= LEVEL_STEPS; k++) {
      variables.push(variable(i, k));
      if (k > 1) {
        rows.push(
          ` order${i}_${k}: ${variable(i, k)} - ${variable(i, k - 1)} <= 0`,
        );
      }
    }
  });

  cxps.forEach((cxp, j) => {
    const terms = stateIds
      .map((stateId, i) => ({ i, step: stepOfLevel(cxp[stateId] ?? 1) }))
      .filter(({ step }) => step < LEVEL_STEPS)
      .map(({ i, step }) => variable(i, step + 1));
    rows.push(` hit${j}: ${terms.join(" + ")} >= 1`);
  });

  const model = [
    "Minimize",
    ` obj: ${variables.join(" + ")}`,
    "Subject To",
    ...rows,
    "Binary",
    ...variables.map((name) => ` ${name}`),
    "End",
  ].join("\n");

  const solution = highs.solve(model);
  if (solution.Status !== "Optimal") {
    throw new Error(`Hitting set problem failed: ${solution.Status}`);
  }

  stateIds.forEach((stateId, i) => {
    let steps = 0;
    for (let k = 1; k <= LEVEL_STEPS; k++) {
      const column = solution.Columns[variable(i, k)];
      if (column && "Primal" in column && column.Primal > 0.5) {
        steps++;
      }
    }
    levels[stateId] = levelOfStep(steps);
  });
  return levels;
}

export async function extractOptimalInflatedAXp(
  graph: MDPGraph,
  p0: number,
  options: ExplanationOptions = {},
): Promise<OptimalInflatedExplanationResult> {
  const nonEffectStateIds = nonEffectStateIdsOf(graph);
  const stateIds = choiceStateIdsOf(graph);

  const allFixed: InflationLevels = {};
  for (const stateId of nonEffectStateIds) {
    allFixed[stateId] = 1;
  }
  if (!isAXpInflated(graph, allFixed, p0, options)) {
    return { axps: [], cxps: [], levels: {}, cxpLevels: [] };
  }

  const highs = await loadHighs();
  const cxps: InflationLevels[] = [];

  for (let iteration = 0; iteration < MAX_HITTING_SET_ITERATIONS; iteration++) {
    const candidate = optimalHittingLevels(highs, stateIds, cxps);
    if (isAXpInflated(graph, candidate, p0, options)) {
      const axp = stateIds.filter((stateId) => candidate[stateId] > 0);
      const cxpStates = cxps.map((cxp) =>
        stateIds.filter((stateId) => cxp[stateId] < 1),
      );
      return {
        axps: [axp],
        cxps: cxpStates,
        levels: Object.fromEntries(
          axp.map((stateId) => [stateId, candidate[stateId]]),
        ),
        cxpLevels: cxps.map((cxp, j) =>
          Object.fromEntries(
            cxpStates[j].map((stateId) => [stateId, cxp[stateId]]),
          ),
        ),
      };
    }
    cxps.push(extractInflatedCXpFrom(graph, p0, options, candidate, stateIds));
  }

  throw new Error(
    `No optimal inflated AXp after ${MAX_HITTING_SET_ITERATIONS} iterations.`,
  );
}
