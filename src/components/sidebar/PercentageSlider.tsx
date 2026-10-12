import { useId, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

const MIN_PERCENT = 0;
const MAX_PERCENT = 100;
const INTEGER_PATTERN = /^-?\d*$/;

interface PercentageSliderProps {
  /** Current value, an integer percentage in [0, 100]. */
  value: number;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
}

function clampPercent(value: number): number {
  return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, Math.round(value)));
}

/**
 * Office-style zoom slider with an editable percentage field, kept in sync both
 * ways. The field only holds local text while it's being edited, so leaving it
 * empty or invalid falls back to the last valid `value` on blur/Enter.
 */
export function PercentageSlider({ value, onChange, label, disabled = false }: PercentageSliderProps) {
  const inputId = useId();
  // In-progress text of the field; null when it simply mirrors `value`.
  const [draft, setDraft] = useState<string | null>(null);

  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraft(null);
    onChange(clampPercent(Number(event.target.value)));
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value.trim();
    // Reject keystrokes that can't lead to an integer (letters, decimals) by keeping the old text.
    if (!INTEGER_PATTERN.test(text)) {
      return;
    }
    // Empty or a lone minus sign: let the user keep typing, the slider stays put.
    if (text === '' || text === '-') {
      setDraft(text);
      return;
    }
    const clamped = clampPercent(Number.parseInt(text, 10));
    // Show the clamped value as soon as the typed one goes out of range.
    setDraft(clamped === Number.parseInt(text, 10) ? text : String(clamped));
    onChange(clamped);
  };

  const commitDraft = () => setDraft(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commitDraft();
    }
  };

  return (
    <div className="percentage-slider">
      <label className="percentage-slider-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="percentage-slider-controls">
        <input
          type="range"
          className="percentage-slider-range"
          min={MIN_PERCENT}
          max={MAX_PERCENT}
          step={1}
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={`${value}%`}
          onChange={handleSliderChange}
        />
        <span className={`percentage-slider-field${disabled ? ' percentage-slider-field--disabled' : ''}`}>
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            className="percentage-slider-input"
            value={draft ?? String(value)}
            disabled={disabled}
            onChange={handleInputChange}
            onBlur={commitDraft}
            onKeyDown={handleKeyDown}
          />
          <span className="percentage-slider-suffix" aria-hidden="true">
            %
          </span>
        </span>
      </div>
    </div>
  );
}
