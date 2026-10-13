import { useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

/**
 * Toggle group of mutually exclusive options, exposed as a radio group: only
 * the selected segment is tabbable and the arrow keys move the selection.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: SegmentedControlProps<T>) {
  const labelId = useId();
  const segmentRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step === undefined) {
      return;
    }
    event.preventDefault();
    const current = options.findIndex((option) => option.value === value);
    const next = (current + step + options.length) % options.length;
    onChange(options[next].value);
    segmentRefs.current[next]?.focus();
  };

  return (
    <div className="segmented-control">
      <span id={labelId} className="segmented-control-label">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-disabled={disabled}
        className="segmented-control-options"
        onKeyDown={disabled ? undefined : handleKeyDown}
      >
        {options.map((option, index) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              ref={(element) => {
                segmentRefs.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              className={`segmented-control-option${isSelected ? ' segmented-control-option--selected' : ''}`}
              disabled={disabled}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
