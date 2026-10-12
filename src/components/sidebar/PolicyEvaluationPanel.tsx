import { useState } from 'react';
import { InlineMath } from 'react-katex';
import { RefreshCw } from 'lucide-react';
import { evaluatePolicyReachability } from '../../core/algorithms/reachability';
import { evaluatePolicyValues } from '../../core/algorithms/valueIteration';
import type { MDPState, MDPAction, MDPTransition } from '../../types/mdp';
import { AccordionSection } from './AccordionSection';

interface PolicyEvaluationPanelProps {
  states: MDPState[];
  actions: MDPAction[];
  transitions: MDPTransition[];
  selectedStateId: string | null;
  /** The gamma set in the Policies accordion, used to discount V^pi. */
  discountFactor: number;
}

interface PolicyEvaluation {
  /** stateId -> expected discounted reward under the policy. */
  values: Record<string, number>;
  /** stateId -> probability of reaching an effect state under the policy. */
  probabilities: Record<string, number>;
}

export function PolicyEvaluationPanel({
  states,
  actions,
  transitions,
  selectedStateId,
  discountFactor,
}: PolicyEvaluationPanelProps) {
  const [evaluation, setEvaluation] = useState<PolicyEvaluation | null>(null);

  const handleRefresh = () => {
    setEvaluation({
      values: evaluatePolicyValues(states, actions, transitions, { discountFactor }).values,
      probabilities: evaluatePolicyReachability(states, actions, transitions).probabilities,
    });
  };

  const hasEffectStates = states.some((state) => state.isTargetEffect);
  const selectedState = states.find((state) => state.id === selectedStateId) ?? null;

  return (
    <AccordionSection label="Policy Evaluation">
      {!hasEffectStates && (
        <p className="inspector-meta">Mark at least one state as "Target Effect" to get non-zero probabilities.</p>
      )}

      <button type="button" className="action-button" onClick={handleRefresh}>
        <RefreshCw size={16} />
        Refresh
      </button>

      {evaluation &&
        (!selectedState ? (
          <p className="inspector-meta">Select a state on the canvas to see its value and probability.</p>
        ) : !(selectedState.id in evaluation.values) ? (
          <p className="inspector-meta">This state was added after the last evaluation. Refresh to include it.</p>
        ) : (
          <>
            <p className="inspector-meta">
              <InlineMath
                math={`V^{\\pi}(${selectedState.label}) = ${evaluation.values[selectedState.id].toFixed(3)}`}
              />
            </p>
            <p className="inspector-meta">
              <InlineMath
                math={`P^{\\pi}(${selectedState.label}) = ${evaluation.probabilities[selectedState.id].toFixed(3)}`}
              />
            </p>
          </>
        ))}
    </AccordionSection>
  );
}
