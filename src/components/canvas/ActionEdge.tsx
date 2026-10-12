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
  // Rounded for display only, so e.g. a uniform 1/3 reads 0.333 while staying exact in the model.
  const labelMath = data?.policy !== undefined ? `${label} (${Number(data.policy.toFixed(3))})` : label;

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
