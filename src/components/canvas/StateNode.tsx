import { memo } from 'react';
import { Handle, NodeResizer, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { InlineMath } from 'react-katex';
import { MIN_NODE_SIZE } from '../../hooks/useMDP';
import type { NodePosition, NodeSize } from '../../hooks/useMDP';
import type { ExplanationKind } from '../../types/explanation';

export interface StateNodeData extends Record<string, unknown> {
  label: string;
  isInitial?: boolean;
  isCandidateCause?: boolean;
  isTargetEffect?: boolean;
  /** Set while an explanation is highlighted: its kind if this state is in it, 'dimmed' if not. */
  explanationHighlight?: ExplanationKind | 'dimmed';
  onResizeEnd: (size: NodeSize, position: NodePosition) => void;
}

export type StateFlowNode = Node<StateNodeData, 'state'>;

function StateNodeComponent({ data, selected }: NodeProps<StateFlowNode>) {
  const background = data.isCandidateCause ? '#dbeafe' : data.isTargetEffect ? '#fef3c7' : '#ffffff';
  const border = data.isInitial ? '2px solid #2563eb' : '1px solid #94a3b8';
  const highlightClass = data.explanationHighlight ? ` state-node-circle--${data.explanationHighlight}` : '';

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_NODE_SIZE}
        minHeight={MIN_NODE_SIZE}
        onResizeEnd={(_event, params) =>
          data.onResizeEnd({ width: params.width, height: params.height }, { x: params.x, y: params.y })
        }
      />
      <Handle type="target" position={Position.Top} />
      <div className={`state-node-circle${highlightClass}`} style={{ background, border }}>
        <InlineMath math={data.label} />
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export const StateNode = memo(StateNodeComponent);
