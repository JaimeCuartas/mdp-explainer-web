import { InlineMath } from 'react-katex';

interface ExplanationListProps {
  title: string;
  variant: 'axp' | 'cxp';
  sets: string[][];
  labelOf: (stateId: string) => string;
}

export function ExplanationList({ title, variant, sets, labelOf }: ExplanationListProps) {
  return (
    <section className={`xp-list xp-list--${variant}`}>
      <header className="xp-list-header">
        <span>{title}</span>
        <span className="xp-list-count">{sets.length}</span>
      </header>

      {sets.length === 0 ? (
        <p className="xp-list-empty">None found.</p>
      ) : (
        // Scrolls on its own so a long enumeration doesn't push the rest of the sidebar away.
        <ol className="xp-list-items">
          {sets.map((set, index) => (
            <li key={index} className="xp-list-item">
              <span className="xp-list-index">{index + 1}</span>
              <span className="xp-set">
                {set.length === 0 ? (
                  <span className="xp-chip xp-chip--empty">∅</span>
                ) : (
                  set.map((stateId) => (
                    <span key={stateId} className="xp-chip">
                      <InlineMath math={labelOf(stateId)} />
                    </span>
                  ))
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
