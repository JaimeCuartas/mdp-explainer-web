import { useState } from 'react';
import { AccordionSection } from './AccordionSection';

export function ExplainabilityPanel() {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <AccordionSection label="Explainability">
      <button
        type="button"
        className="action-button"
        onClick={() => setMessage('AXp computation is not implemented yet.')}
      >
        AXps
      </button>

      <button
        type="button"
        className="action-button secondary"
        onClick={() => setMessage('CXp computation is not implemented yet.')}
      >
        CXps
      </button>

      {message && <p className="inspector-meta">{message}</p>}
    </AccordionSection>
  );
}
