import { useState } from 'react';
import { InlineMath } from 'react-katex';
import { ChevronDown } from 'lucide-react';
import type { ExplanationKind } from '../../types/explanation';

interface ExplanationListProps {
  title: string;
  variant: ExplanationKind;
  sets: string[][];
  labelOf: (stateId: string) => string;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export function ExplanationList({ title, variant, sets, labelOf, selectedIndex, onSelect }: ExplanationListProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <section className={`xp-list xp-list--${variant}`}>
      <button
        type="button"
        className="xp-list-header"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>{title}</span>
        <span className="xp-list-header-end">
          <span className="xp-list-count">{sets.length}</span>
          <ChevronDown size={16} className={`accordion-chevron${isOpen ? ' accordion-chevron--open' : ''}`} />
        </span>
      </button>

      {!isOpen ? null : sets.length === 0 ? (
        <p className="xp-list-empty">None found.</p>
      ) : (
        // Scrolls on its own so a long enumeration doesn't push the rest of the sidebar away.
        <ol className="xp-list-items">
          {sets.map((set, index) => (
            <li key={index}>
              <button
                type="button"
                className={`xp-list-item${index === selectedIndex ? ' xp-list-item--selected' : ''}`}
                aria-pressed={index === selectedIndex}
                onClick={() => onSelect(index)}
              >
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
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
