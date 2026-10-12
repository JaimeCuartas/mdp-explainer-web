import { useState } from 'react';
import { InlineMath } from 'react-katex';
import { LoaderCircle } from 'lucide-react';
import { enumerateXpsTargetCXps } from '../../core/algorithms/explain';
import { buildMDPGraph } from '../../core/algorithms/mdpGraph';
import { evaluatePolicyReachability } from '../../core/algorithms/reachability';
import type { ExplanationResult } from '../../core/algorithms/types';
import type { ExplanationHighlight, ExplanationKind } from '../../types/explanation';
import type { MDPState, MDPAction, MDPTransition } from '../../types/mdp';
import { ExplanationList } from './ExplanationList';

interface TargetCXpPanelProps {
  states: MDPState[];
  actions: MDPAction[];
  transitions: MDPTransition[];
  highlight: ExplanationHighlight | null;
  onHighlightChange: (highlight: ExplanationHighlight | null) => void;
}

export function TargetCXpPanel({ states, actions, transitions, highlight, onHighlightChange }: TargetCXpPanelProps) {
  const [result, setResult] = useState<ExplanationResult | null>(null);
  const [p0, setP0] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasEffectStates = states.some((state) => state.isTargetEffect);
  const labelById = new Map(states.map((state) => [state.id, state.label]));
  // Falls back to the id for states deleted since the enumeration ran.
  const labelOf = (stateId: string) => labelById.get(stateId) ?? stateId;

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

  const handleRun = async () => {
    setIsRunning(true);
    setError(null);
    onHighlightChange(null);
    try {
      const initialState = states.find((state) => state.isInitial) ?? states[0];
      const reference = evaluatePolicyReachability(states, actions, transitions).probabilities[initialState.id];
      const explanations = await enumerateXpsTargetCXps(buildMDPGraph(states, actions, transitions), reference);
      setP0(reference);
      setResult(explanations);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <section className="xp-panel">
      {!hasEffectStates && (
        <p className="inspector-meta">Mark at least one state as "Target Effect" in its Inspector first.</p>
      )}

      <button type="button" className="action-button" disabled={!hasEffectStates || isRunning} onClick={handleRun}>
        {isRunning && <LoaderCircle size={16} className="spin" />}
        {isRunning ? 'Computing…' : 'Target CXp'}
      </button>

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
            labelOf={labelOf}
            selectedIndex={highlight?.kind === 'axp' ? highlight.index : null}
            onSelect={(index) => handleSelect('axp', index, axps[index])}
          />
          <ExplanationList
            title="CXps"
            variant="cxp"
            sets={cxps}
            labelOf={labelOf}
            selectedIndex={highlight?.kind === 'cxp' ? highlight.index : null}
            onSelect={(index) => handleSelect('cxp', index, cxps[index])}
          />
        </>
      )}
    </section>
  );
}
