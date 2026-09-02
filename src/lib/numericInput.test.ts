import { describe, expect, it } from 'vitest';

import { normalizeNumericValue, parseNumericDraft } from './numericInput';

describe('edição de números', () => {
  it('permite deixar o campo vazio enquanto o usuário redigita', () => {
    expect(parseNumericDraft('', false)).toBeNull();
    expect(parseNumericDraft('   ', true)).toBeNull();
  });

  it('aceita vírgula decimal do teclado do iPhone', () => {
    expect(parseNumericDraft('82,5', true)).toBe(82.5);
  });

  it('limita e arredonda o valor somente ao normalizar', () => {
    expect(normalizeNumericValue(82.3, { min: 0, step: 0.5 })).toBe(82.5);
    expect(normalizeNumericValue(30, { min: 1, max: 20, integer: true })).toBe(20);
  });
});

