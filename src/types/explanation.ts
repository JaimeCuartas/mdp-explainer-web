export type ExplanationKind = 'axp' | 'cxp';

/** The AXp/CXp picked in the sidebar list, whose states the canvas highlights. */
export interface ExplanationHighlight {
  kind: ExplanationKind;
  /** Position of the explanation in its list, so the list can mark the row as selected. */
  index: number;
  stateIds: string[];
}
