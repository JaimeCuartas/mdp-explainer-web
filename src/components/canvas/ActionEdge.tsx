import { BaseEdge, EdgeLabelRenderer, getStraightPath } from '@xyflow/react';
import type { Edge, EdgeProps } from '@xyflow/react';
import { InlineMath } from 'react-katex';

export interface ActionEdgeData extends Record<string, unknown> {
  label: string;
  policy?: number;
}

export type ActionFlowEdge = Edge<ActionEdgeData, 'action'>;

export function ActionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  data,
}: EdgeProps<ActionFlowEdge>) {
  const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  const label = data?.label ?? '';
  const labelMath = data?.policy !== undefined ? `${label} (${data.policy})` : label;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: '#f9fafb',
            pointerEvents: 'none',
            fontSize: '0.7rem',
          }}
        >
          <InlineMath math={labelMath} />
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
