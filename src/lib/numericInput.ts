export function parseNumericDraft(value: string, allowDecimal: boolean): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const pattern = allowDecimal ? /^\d+(?:[.,]\d*)?$/ : /^\d+$/;
  if (!pattern.test(trimmed)) return null;

  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeNumericValue(
  value: number,
  { min, max = Number.POSITIVE_INFINITY, step = 1, integer = false }: {
    min: number;
    max?: number;
    step?: number;
    integer?: boolean;
  },
) {
  const bounded = Math.min(max, Math.max(min, value));
  if (integer) return Math.round(bounded);

  const decimals = step.toString().split('.')[1]?.length ?? 0;
  return Number((Math.round(bounded / step) * step).toFixed(decimals));
}

