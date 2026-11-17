import { useState } from 'react';
import { InlineMath } from 'react-katex';
import { LoaderCircle } from 'lucide-react';
import { enumerateXpsTargetAXps, enumerateXpsTargetCXps } from '../../core/algorithms/explain';
import {
  extractInflatedAXp,
  extractInflatedAXpReverse,
  extractInflatedCXp,
  extractInflatedCXpReverse,
  extractOptimalInflatedAXp,
} from '../../core/algorithms/inflatedXPs';
import type { InflationLevels } from '../../core/algorithms/inflatedXPs';
import { buildMDPGraph } from '../../core/algorithms/mdpGraph';
import { loadReachabilitySolver } from '../../core/algorithms/reachabilityLP';
import type { ExplanationBound, ExplanationResult, ReachabilityMethod } from '../../core/algorithms/types';
import type { ExplanationHighlight, ExplanationKind } from '../../types/explanation';
import type { MDPState, MDPAction, MDPTransition } from '../../types/mdp';
import { ExplanationList } from './ExplanationList';
import { PercentageSlider } from './PercentageSlider';
import { SegmentedControl } from './SegmentedControl';
import type { SegmentedOption } from './SegmentedControl';

// Allowed relative deviation from p0, as a percentage (options.deviation = 0.20).
const DEFAULT_DEVIATION_PERCENT = 20;

// Which bounds of the allowed range isAXp checks.
const BOUND_OPTIONS: readonly SegmentedOption<ExplanationBound>[] = [
  { value: 'min', label: 'Min Only (≥)' },
  { value: 'max', label: 'Max Only (≤)' },
  { value: 'both', label: 'Both (Range)' },
];
const DEFAULT_BOUND: ExplanationBound = 'min';

// How p0 and every isAXp check compute reachability; both give the same explanations.
const METHOD_OPTIONS: readonly SegmentedOption<ReachabilityMethod>[] = [
  { value: 'value-iteration', label: 'Value Iteration' },
  { value: 'linear-programming', label: 'Linear Programming' },
];
const DEFAULT_METHOD: ReachabilityMethod = 'value-iteration';

// The inflated runs are an experiment: each extracts a single AXp or a single CXp,
// with a level per state, visiting the states in model order or in reverse. The
// optimal run returns the best AXp on the grid and the CXps it needed.
type RunTarget =
  | ExplanationKind
  | 'inflated'
  | 'inflated-reverse'
  | 'inflated-cxp'
  | 'inflated-cxp-reverse'
  | 'inflated-optimal';

type Enumerate = typeof enumerateXpsTargetCXps;
// Same shape for every run; the inflated ones also return the levels of their
// explanation, and the optimal one the levels of each CXp.
type EnumerateWithLevels = (
  ...args: Parameters<Enumerate>
) => Promise<ExplanationResult & { levels?: InflationLevels; cxpLevels?: InflationLevels[] }>;

// `description` names the two "Reverse" buttons apart for screen readers and tooltips.
const ENUMERATIONS: Record<RunTarget, { label: string; description?: string; enumerate: EnumerateWithLevels }> = {
  cxp: { label: 'Target CXp', enumerate: enumerateXpsTargetCXps },
  axp: { label: 'Target AXp', enumerate: enumerateXpsTargetAXps },
  'inflated-reverse': {
    label: 'Reverse',
    description: 'Inflated AXp, states in reverse order',
    enumerate: extractInflatedAXpReverse,
  },
  inflated: { label: 'Inflated AXp', enumerate: extractInflatedAXp },
  'inflated-cxp': { label: 'Inflated CXp', enumerate: extractInflatedCXp },
  'inflated-cxp-reverse': {
    label: 'Reverse',
    description: 'Inflated CXp, states in reverse order',
    enumerate: extractInflatedCXpReverse,
  },
  'inflated-optimal': { label: 'Optimal AXp', enumerate: extractOptimalInflatedAXp },
};

interface ExplanationsPanelProps {
  states: MDPState[];
  actions: MDPAction[];
  transitions: MDPTransition[];
  highlight: ExplanationHighlight | null;
  onHighlightChange: (highlight: ExplanationHighlight | null) => void;
}

export function ExplanationsPanel({
  states,
  actions,
  transitions,
  highlight,
  onHighlightChange,
}: ExplanationsPanelProps) {
  const [result, setResult] = useState<ExplanationResult | null>(null);
  // Levels of the last inflated AXp; null after an ordinary enumeration.
  const [levels, setLevels] = useState<InflationLevels | null>(null);
  const [cxpLevels, setCxpLevels] = useState<InflationLevels[] | null>(null);
  const [p0, setP0] = useState<number | null>(null);
  // Which enumeration is running, if any; all fill the same AXp and CXp lists.
  const [runningTarget, setRunningTarget] = useState<RunTarget | null>(null);
  const isRunning = runningTarget !== null;
  const [error, setError] = useState<string | null>(null);
  const [deviationPercent, setDeviationPercent] = useState(DEFAULT_DEVIATION_PERCENT);
  const [bound, setBound] = useState<ExplanationBound>(DEFAULT_BOUND);
  const [method, setMethod] = useState<ReachabilityMethod>(DEFAULT_METHOD);

  const hasEffectStates = states.some((state) => state.isTargetEffect);
  const labelById = new Map(states.map((state) => [state.id, state.label]));
  // Falls back to the id for states deleted since the enumeration ran.
  const labelOf = (stateId: string) => labelById.get(stateId) ?? stateId;
  // Chips of an inflated result also show the state's level; each CXp of the
  // optimal run has its own levels.
  const withLevel = (stateId: string, levelsOfSet: InflationLevels | null | undefined) =>
    levelsOfSet?.[stateId] === undefined
      ? labelOf(stateId)
      : `${labelOf(stateId)}\\;{\\scriptstyle \\lambda = ${levelsOfSet[stateId].toFixed(1)}}`;
  const axpLabelOf = (stateId: string) => withLevel(stateId, levels);
  const cxpLabelOf = (stateId: string, setIndex: number) => withLevel(stateId, cxpLevels?.[setIndex] ?? levels);

  // The Hitman returns states in the order it first saw them; list them in model order instead.
  const stateIndexById = new Map(states.map((state, index) => [state.id, index]));
  const sortSet = (set: string[]) =>
    [...set].sort(
      (a, b) => (stateIndexById.get(a) ?? Number.MAX_SAFE_INTEGER) - (stateIndexById.get(b) ?? Number.MAX_SAFE_INTEGER),
    );

  const axps = result?.axps.map(sortSet) ?? [];
  const cxps = result?.cxps.map(sortSet) ?? [];

  // Clicking the highlighted explanation again clears the highlight.
  const handleSelect = (kind: ExplanationKind, index: number, stateIds: string[]) => {
    const isAlreadySelected = highlight?.kind === kind && highlight.index === index;
    onHighlightChange(isAlreadySelected ? null : { kind, index, stateIds });
  };

  const handleRun = async (target: RunTarget) => {
    setRunningTarget(target);
    setError(null);
    onHighlightChange(null);
    try {
      const initialState = states.find((state) => state.isInitial) ?? states[0];
      const graph = buildMDPGraph(states, actions, transitions);
      const solve = await loadReachabilitySolver(method);
      const reference = solve(graph, 'policy').probabilities[initialState.id];
      const explanations = await ENUMERATIONS[target].enumerate(graph, reference, {
        deviation: deviationPercent / 100,
        bound,
        method,
      });
      setP0(reference);
      setResult(explanations);
      setLevels(explanations.levels ?? null);
      setCxpLevels(explanations.cxpLevels ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningTarget(null);
    }
  };

  return (
    <section className="xp-panel">
      {!hasEffectStates && (
        <p className="inspector-meta">Mark at least one state as "Target Effect" in its Inspector first.</p>
      )}

      <div className="xp-run-buttons">
        {(['cxp', 'axp', 'inflated', 'inflated-reverse', 'inflated-cxp', 'inflated-cxp-reverse', 'inflated-optimal'] as const).map((target) => (
          <button
            key={target}
            type="button"
            className="action-button"
            title={ENUMERATIONS[target].description}
            aria-label={ENUMERATIONS[target].description}
            disabled={!hasEffectStates || isRunning}
            onClick={() => handleRun(target)}
          >
            {runningTarget === target && <LoaderCircle size={16} className="spin" />}
            {runningTarget === target ? 'Computing…' : ENUMERATIONS[target].label}
          </button>
        ))}
      </div>

      <PercentageSlider
        label="Deviation from p₀"
        value={deviationPercent}
        disabled={isRunning}
        onChange={setDeviationPercent}
      />

      <SegmentedControl
        label="AXp check"
        options={BOUND_OPTIONS}
        value={bound}
        disabled={isRunning}
        onChange={setBound}
      />

      <SegmentedControl
        label="Reachability solver"
        options={METHOD_OPTIONS}
        value={method}
        disabled={isRunning}
        onChange={setMethod}
      />

      {error && <p className="xp-error">{error}</p>}

      {result && p0 !== null && (
        <>
          <p className="inspector-meta">
            <InlineMath math={`p_0 = ${p0.toFixed(3)}`} />
          </p>
          <ExplanationList
            title="AXps"
            variant="axp"
            sets={axps}
            labelOf={axpLabelOf}
            selectedIndex={highlight?.kind === 'axp' ? highlight.index : null}
            onSelect={(index) => handleSelect('axp', index, axps[index])}
          />
          <ExplanationList
            title="CXps"
            variant="cxp"
            sets={cxps}
            labelOf={cxpLabelOf}
            selectedIndex={highlight?.kind === 'cxp' ? highlight.index : null}
            onSelect={(index) => handleSelect('cxp', index, cxps[index])}
          />
        </>
      )}
    </section>
  );
}
