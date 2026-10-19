import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WeeklyDashboard } from '../src/components/WeeklyDashboard';
import { createWeeklyWorkoutPlans } from '../src/lib/starterPlans';
import { formatWeight, fromStoredWeight } from '../src/lib/format';

vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: () => ({
  offlineReady: [false, vi.fn()], needRefresh: [true, vi.fn()], updateServiceWorker: vi.fn(),
}) }));
import { UpdatePrompt } from '../src/components/UpdatePrompt';

describe('interface Elite e controles de integridade', () => {
  it('apresenta o planejamento misto de 50 séries sem afirmar que já foram realizadas', () => {
    const html = renderToStaticMarkup(createElement(WeeklyDashboard, {
      plans: createWeeklyWorkoutPlans(), history: [], modes: { 'plan-full-body-b': 'express', 'plan-full-body-c': 'express' }, onModesChange: () => undefined,
    }));
    expect(html).toContain('/50');
    expect(html).toContain('registros da semana selecionada');
    expect(html).toContain('séries realizadas / plano');
  });
  it('não permite recarregar por atualização com uma sessão ativa', () => {
    const html = renderToStaticMarkup(createElement(UpdatePrompt, { workoutInProgress: true }));
    expect(html).toContain('disabled=""');
    expect(html).toContain('Termine o treino para atualizar');
  });
  it('libera atualização quando não existe sessão ativa', () => {
    const html = renderToStaticMarkup(createElement(UpdatePrompt, {}));
    expect(html).not.toContain('disabled=""');
  });
  it('não perde as casas decimais de microcargas', () => {
    expect(formatWeight(82.25, 'kg')).toBe('82,25 kg');
    expect(fromStoredWeight(82.25, 'kg')).toBe(82.25);
  });
});
