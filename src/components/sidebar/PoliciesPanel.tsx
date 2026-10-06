import { useState } from 'react';
import { InlineMath } from 'react-katex';
import { computeOptimalPolicy } from '../../core/algorithms/valueIteration';
import type { ValueIterationResult } from '../../core/algorithms/types';
import type { MDPState, MDPAction, MDPTransition } from '../../types/mdp';
import { AccordionSection } from './AccordionSection';

interface PoliciesPanelProps {
  states: MDPState[];
  actions: MDPAction[];
  transitions: MDPTransition[];
  selectedStateId: string | null;
  onUpdateAction: (id: string, updates: Partial<MDPAction>) => void;
}

export function PoliciesPanel({ states, actions, transitions, selectedStateId, onUpdateAction }: PoliciesPanelProps) {
  const [gamma, setGamma] = useState(0.9);
  const [result, setResult] = useState<ValueIterationResult | null>(null);

  const handleCompute = () => {
    const computed = computeOptimalPolicy(states, actions, transitions, { discountFactor: gamma });
    setResult(computed);

    // One-hot encode the computed deterministic policy into each action's own
    // editable pi(a|s): the chosen action at a state gets 1, its siblings get 0.
    for (const action of actions) {
      const chosenActionId = computed.policy[action.sourceStateId];
      onUpdateAction(action.id, { policy: action.id === chosenActionId ? 1 : 0 });
    }
  };

  const selectedState = states.find((state) => state.id === selectedStateId) ?? null;
  const bestActionId = selectedState && result ? result.policy[selectedState.id] : undefined;
  const bestAction = bestActionId ? actions.find((action) => action.id === bestActionId) : null;

  return (
    <AccordionSection label="Policies">
      <label className="inspector-field">
        <span>
          <InlineMath math="\gamma" />
        </span>
        <input
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={gamma}
          onChange={(event) => setGamma(Number(event.target.value))}
        />
      </label>

      <button type="button" className="action-button" onClick={handleCompute}>
        Compute Optimal Policy
      </button>

      {result &&
        (selectedState ? (
          bestAction ? (
            <>
              <p className="inspector-meta">
                <InlineMath math={`\\pi(${selectedState.label}) = ${bestAction.label}`} />
              </p>
              <p className="inspector-meta">
                <InlineMath math={`V(${selectedState.label}) = ${result.values[selectedState.id].toFixed(3)}`} />
              </p>
            </>
          ) : (
            <p className="inspector-meta">No action is available from this state.</p>
          )
        ) : (
          <p className="inspector-meta">Select a state on the canvas to see its optimal action.</p>
        ))}
    </AccordionSection>
  );
}
