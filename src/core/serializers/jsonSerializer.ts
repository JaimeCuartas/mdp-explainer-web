import type { MDPState, MDPAction, MDPTransition } from '../../types/mdp';
import type { MDPFileFormat, MDPVisualNode } from '../../types/fileFormat';
import { saveTextToFile, sanitizeFileName } from './fileSaver';

const FILE_EXTENSION = '.mdp.json';

export async function exportMDPToFile(
  states: MDPState[],
  actions: MDPAction[],
  transitions: MDPTransition[],
  nodesPosition: Record<string, { x: number; y: number }>,
  title: string,
  nodesSize: Record<string, { width: number; height: number }> = {},
  actionPositions: Record<string, { x: number; y: number }> = {}
): Promise<void> {
  const nodes: Record<string, MDPVisualNode> = {};
  for (const state of states) {
    const size = nodesSize[state.id];
    nodes[state.id] = {
      id: state.id,
      position: nodesPosition[state.id] ?? { x: 0, y: 0 },
      ...(size ? { size } : {}),
    };
  }
  for (const action of actions) {
    nodes[action.id] = {
      id: action.id,
      position: actionPositions[action.id] ?? { x: 0, y: 0 },
    };
  }

  const fileData: MDPFileFormat = {
    version: '1.0',
    metadata: {
      title,
      updatedAt: new Date().toISOString(),
    },
    logical: { states, actions, transitions },
    graphical: { nodes },
  };

  const json = JSON.stringify(fileData, null, 2);
  const fileName = `${sanitizeFileName(title)}${FILE_EXTENSION}`;

  await saveTextToFile(json, fileName, {
    description: 'MDP JSON file',
    mimeType: 'application/json',
    extensions: ['.json'],
  });
}

export function importMDPFromFile(file: File): Promise<MDPFileFormat> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Unable to read the selected file.'));
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(reader.result as string);
        resolve(validateMDPFileFormat(parsed));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('The selected file is not valid JSON.'));
      }
    };

    reader.readAsText(file);
  });
}

function validateMDPFileFormat(data: unknown): MDPFileFormat {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid .mdp.json file: expected a JSON object.');
  }

  const candidate = data as Partial<MDPFileFormat>;

  if (candidate.version !== '1.0') {
    throw new Error('Invalid .mdp.json file: unsupported or missing "version".');
  }

  if (!candidate.metadata || typeof candidate.metadata.title !== 'string') {
    throw new Error('Invalid .mdp.json file: missing "metadata.title".');
  }

  const logical = candidate.logical;
  if (
    !logical ||
    !Array.isArray(logical.states) ||
    !Array.isArray(logical.actions) ||
    !Array.isArray(logical.transitions)
  ) {
    throw new Error('Invalid .mdp.json file: "logical" must contain states, actions, and transitions arrays.');
  }

  const graphical = candidate.graphical;
  if (!graphical || typeof graphical.nodes !== 'object' || graphical.nodes === null) {
    throw new Error('Invalid .mdp.json file: missing "graphical.nodes".');
  }

  return candidate as MDPFileFormat;
}
