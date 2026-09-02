import { useEffect, useRef, useState } from 'react';

import { normalizeNumericValue, parseNumericDraft } from '../lib/numericInput';

type NumericDraftOptions = {
  value: number;
  min: number;
  max?: number;
  step?: number;
  integer?: boolean;
  onChange: (value: number) => void;
};

export function useNumericDraft({
  value,
  min,
  max,
  step = 1,
  integer = false,
  onChange,
}: NumericDraftOptions) {
  const [draft, setDraft] = useState(() => String(value));
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) setDraft(String(value));
  }, [value]);

  const normalize = (next: number) => normalizeNumericValue(next, { min, max, step, integer });
  const parsedDraft = () => parseNumericDraft(draft, !integer);

  const updateDraft = (nextDraft: string) => {
    setDraft(nextDraft);
    const parsed = parseNumericDraft(nextDraft, !integer);
    if (parsed !== null) onChange(normalize(parsed));
  };

  const commit = () => {
    editingRef.current = false;
    const parsed = parsedDraft();
    const next = parsed === null ? value : normalize(parsed);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  const adjust = (amount: number) => {
    const next = normalize((parsedDraft() ?? value) + amount);
    setDraft(String(next));
    onChange(next);
  };

  return {
    draft,
    onFocus: () => { editingRef.current = true; },
    onBlur: commit,
    onDraftChange: updateDraft,
    decrement: () => adjust(-step),
    increment: () => adjust(step),
  };
}

