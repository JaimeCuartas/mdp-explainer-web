import type { MDPAction } from '../../types/mdp';

/**
 * The uniform random policy: actionId -> pi(a|s) = 1 / (number of actions
 * available at the action's source state).
 */
export function computeUniformPolicy(actions: MDPAction[]): Record<string, number> {
  const actionCountByState = new Map<string, number>();
  for (const action of actions) {
    actionCountByState.set(action.sourceStateId, (actionCountByState.get(action.sourceStateId) ?? 0) + 1);
  }

  const policy: Record<string, number> = {};
  for (const action of actions) {
    policy[action.id] = 1 / (actionCountByState.get(action.sourceStateId) ?? 1);
  }
  return policy;
}
