import { useState } from 'react';
import { InlineMath } from 'react-katex';
import { computeOptimalPolicy } from '../../core/algorithms/valueIteration';
import { computeReachabilityPolicy } from '../../core/algorithms/reachability';
import type { MDPState, MDPAction, MDPTransition } from '../../types/mdp';
import { AccordionSection } from './AccordionSection';

interface PoliciesPanelProps {
  states: MDPState[];
  actions: MDPAction[];
  transitions: MDPTransition[];
  selectedStateId: string | null;
  discountFactor: number;
  onDiscountFactorChange: (value: number) => void;
  onUpdateAction: (id: string, updates: Partial<MDPAction>) => void;
}

export function PoliciesPanel({
  states,
  actions,
  transitions,
  selectedStateId,
  discountFactor,
  onDiscountFactorChange,
  onUpdateAction,
}: PoliciesPanelProps) {
  // stateId -> chosen action id of the last computed policy.
  const [policy, setPolicy] = useState<Record<string, string | null> | null>(null);

  const hasEffectStates = states.some((state) => state.isTargetEffect);

  // One-hot encode a computed deterministic policy into each action's own
  // editable pi(a|s): the chosen action at a state gets 1, its siblings get 0.
  // States without a chosen action (e.g. effect states under reachability) keep their policy.
  const applyPolicy = (nextPolicy: Record<string, string | null>) => {
    setPolicy(nextPolicy);
    for (const action of actions) {
      const chosenActionId = nextPolicy[action.sourceStateId];
      if (chosenActionId) {
        onUpdateAction(action.id, { policy: action.id === chosenActionId ? 1 : 0 });
      }
    }
  };

  const selectedState = states.find((state) => state.id === selectedStateId) ?? null;
  const chosenActionId = selectedState && policy ? policy[selectedState.id] : undefined;
  const chosenAction = chosenActionId ? actions.find((action) => action.id === chosenActionId) : null;

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
          value={discountFactor}
          onChange={(event) => onDiscountFactorChange(Number(event.target.value))}
        />
      </label>

      <button
        type="button"
        className="action-button"
        onClick={() => applyPolicy(computeOptimalPolicy(states, actions, transitions, { discountFactor }).policy)}
      >
        Compute Optimal Policy
      </button>

      {!hasEffectStates && (
        <p className="inspector-meta">Mark at least one state as "Target Effect" in its Inspector first.</p>
      )}

      <button
        type="button"
        className="action-button"
        onClick={() => applyPolicy(computeReachabilityPolicy(states, actions, transitions, 'max').policy)}
      >
        Best-Case Reachability
      </button>

      <button
        type="button"
        className="action-button secondary"
        onClick={() => applyPolicy(computeReachabilityPolicy(states, actions, transitions, 'min').policy)}
      >
        Worst-Case Reachability
      </button>

      {policy &&
        (selectedState ? (
          <p className="inspector-meta">
            {chosenAction ? (
              <InlineMath math={`\\pi(${selectedState.label}) = ${chosenAction.label}`} />
            ) : (
              'No action is chosen at this state.'
            )}
          </p>
        ) : (
          <p className="inspector-meta">Select a state on the canvas to see its chosen action.</p>
        ))}
    </AccordionSection>
  );
}
