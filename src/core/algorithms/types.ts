// Plain-data result/option shapes for every algorithm in this folder. Kept as
// simple records of primitives (no classes, no framework types) so a future
// WebAssembly implementation can expose the same shape without the JS side
// needing to change.

export interface ValueIterationOptions {
  /** Discount factor (gamma) applied to future reward. */
  discountFactor?: number;
  maxIterations?: number;
  /** Stop once the largest change in any state's value drops below this. */
  tolerance?: number;
}

export interface ValueIterationResult {
  /** stateId -> expected discounted reward under the optimal policy. */
  values: Record<string, number>;
  /** stateId -> id of the best action, or null if the state has no actions. */
  policy: Record<string, string | null>;
  iterations: number;
  converged: boolean;
}

export interface PolicyEvaluationResult {
  /** stateId -> expected discounted reward when following the current stochastic policy. */
  values: Record<string, number>;
  iterations: number;
  converged: boolean;
}

export type ReachabilityMode = 'max' | 'min' | 'policy';

export interface ReachabilityOptions {
  maxIterations?: number;
  tolerance?: number;
  /**
   * States that keep following the stochastic policy (`action.policy`)
   * regardless of `mode`; every other non-effect state is resolved by `mode`.
   */
  policyStateIds?: ReadonlySet<string>;
}

export interface ReachabilityProbabilities {
  /** stateId -> probability of eventually reaching an effect state. */
  probabilities: Record<string, number>;
  iterations: number;
  converged: boolean;
}

export interface ReachabilityResult extends ReachabilityProbabilities {
  /** stateId -> id of the action achieving that probability, or null. */
  policy: Record<string, string | null>;
}

/**
 * Which side of the allowed range an AXp must guarantee: 'min' checks only the
 * lower bound (min reachability >= threshold), 'max' only the upper bound
 * (max reachability <= threshold), 'both' the whole range.
 */
export type ExplanationBound = 'min' | 'max' | 'both';

export interface ExplanationOptions extends ReachabilityOptions {
  /**
   * Allowed relative deviation from the reference probability p0: a candidate
   * is sufficient when its min/max reachability stays within
   * [p0 * (1 - deviation), min(1, p0 * (1 + deviation))].
   */
  deviation?: number;
  /** Bounds that isAXp checks; defaults to 'min'. */
  bound?: ExplanationBound;
}

export interface ReachabilityBounds {
  /** stateId -> min reachability when only the candidate states follow the policy. */
  min: Record<string, number>;
  /** stateId -> max reachability when only the candidate states follow the policy. */
  max: Record<string, number>;
}

export interface ExplanationResult {
  /** Subset-minimal abductive explanations, as lists of state ids. */
  axps: string[][];
  /** Subset-minimal contrastive explanations, as lists of state ids. */
  cxps: string[][];
}
