import type { MDPState, MDPAction, MDPTransition } from '../../types/mdp';
import { saveTextToFile, sanitizeFileName } from './fileSaver';

const FILE_EXTENSION = '.dzn';

// MiniZinc's `array3d(states, actions, states, ...)` format needs one shared
// `actions` set applied uniformly to every state (like N/E/S/W in a grid
// world) — but in our model, each action belongs to exactly one state. We
// bridge that by using the union of distinct action *labels* as the MiniZinc
// action set, and filling any (state, action-label) pair that state doesn't
// actually have with an all-zero row, the same way the format represents a
// terminal state's unavailable actions.

function toIdentifierBase(label: string): string {
  const withoutTextWrapper = label.replace(/\\text\{([^}]*)\}/g, '$1');
  const withoutBackslashes = withoutTextWrapper.replace(/\\/g, '');
  const withoutBraces = withoutBackslashes.replace(/[{}]/g, '');
  const cleaned = withoutBraces.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.length > 0 ? cleaned : 'x';
}

function ensureStartsWithLetter(identifier: string): string {
  return /^[a-zA-Z]/.test(identifier) ? identifier : `s${identifier}`;
}

// Builds MiniZinc identifiers for a list of labels, avoiding collisions both
// within this list and against anything already in `used` (enum members in
// MiniZinc share one global namespace, so state and action names must all be
// distinct from each other, not just within their own set).
function buildUniqueIdentifiers(labels: string[], used: Set<string>): string[] {
  return labels.map((label) => {
    const base = ensureStartsWithLetter(toIdentifierBase(label));
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    return candidate;
  });
}

function formatDznFloat(value: number): string {
  const rounded = Math.round(value * 1e9) / 1e9;
  return Number.isInteger(rounded) ? `${rounded}.0` : String(rounded);
}

interface TransitionEntry {
  probability: number;
  reward: number;
}

/**
 * Builds the MiniZinc .dzn source as a plain string. Pure and framework-free,
 * so it can run anywhere this ever gets called from (including, eventually,
 * a WebAssembly build).
 */
export function buildMiniZincDzn(
  states: MDPState[],
  actions: MDPAction[],
  transitions: MDPTransition[],
  discountFactor = 1.0
): string {
  const usedIdentifiers = new Set<string>();
  const stateNames = buildUniqueIdentifiers(
    states.map((state) => state.id),
    usedIdentifiers
  );

  const distinctActionLabels: string[] = [];
  const seenLabels = new Set<string>();
  for (const action of actions) {
    if (!seenLabels.has(action.label)) {
      seenLabels.add(action.label);
      distinctActionLabels.push(action.label);
    }
  }
  const actionNames = buildUniqueIdentifiers(distinctActionLabels, usedIdentifiers);

  // stateId -> actionLabel -> targetStateId -> { probability, reward }
  const lookup = new Map<string, Map<string, Map<string, TransitionEntry>>>();
  for (const action of actions) {
    let byLabel = lookup.get(action.sourceStateId);
    if (!byLabel) {
      byLabel = new Map();
      lookup.set(action.sourceStateId, byLabel);
    }
    if (!byLabel.has(action.label)) {
      byLabel.set(action.label, new Map());
    }
    const byTarget = byLabel.get(action.label);
    if (!byTarget) {
      continue;
    }
    for (const transition of transitions) {
      if (transition.actionId === action.id) {
        byTarget.set(transition.targetStateId, {
          probability: transition.probability,
          reward: transition.reward ?? 0,
        });
      }
    }
  }

  const columnWidth = Math.max(...stateNames.map((name) => name.length)) + 2;
  const headerComment = `    %${stateNames.map((name) => name.padEnd(columnWidth)).join('')}`;

  function buildArrayBody(pick: (entry: TransitionEntry | undefined) => number): string {
    const lines: string[] = [];
    for (let si = 0; si < states.length; si++) {
      for (let ai = 0; ai < distinctActionLabels.length; ai++) {
        lines.push(headerComment);
        const byTarget = lookup.get(states[si].id)?.get(distinctActionLabels[ai]);
        const row = states.map((targetState) => formatDznFloat(pick(byTarget?.get(targetState.id))));
        lines.push(`    ${row.join(', ')},`);
      }
    }
    // The format has no trailing comma before the closing bracket.
    const lastIndex = lines.length - 1;
    lines[lastIndex] = lines[lastIndex].replace(/,\s*$/, '');
    return lines.join('\n');
  }

  const probabilityBody = buildArrayBody((entry) => entry?.probability ?? 0);
  const rewardBody = buildArrayBody((entry) => entry?.reward ?? 0);

  const initialStateIndex = states.findIndex((state) => state.isInitial);
  const effectStateNames = states
    .map((state, index) => (state.isTargetEffect ? stateNames[index] : null))
    .filter((name): name is string => name !== null);

  return [
    `states  = {${stateNames.join(',')}};`,
    `actions = {${actionNames.join(',')}};`,
    '',
    ...(initialStateIndex >= 0 ? [`init_state = ${stateNames[initialStateIndex]};`] : []),
    `effect_states = {${effectStateNames.join(',')}};`,
    '',
    'P = array3d(states,actions,states,[',
    probabilityBody,
    ']);',
    '',
    'R = array3d(states,actions,states,[',
    rewardBody,
    ']);',
    '',
    `g = ${formatDznFloat(discountFactor)};`,
    '',
  ].join('\n');
}

export async function exportMDPToMiniZincDzn(
  states: MDPState[],
  actions: MDPAction[],
  transitions: MDPTransition[],
  title: string,
  discountFactor = 1.0
): Promise<void> {
  const content = buildMiniZincDzn(states, actions, transitions, discountFactor);
  const fileName = `${sanitizeFileName(title)}${FILE_EXTENSION}`;

  await saveTextToFile(content, fileName, {
    description: 'MiniZinc data file',
    mimeType: 'text/plain',
    extensions: ['.dzn'],
  });
}
