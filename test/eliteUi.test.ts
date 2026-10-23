import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WeeklyDashboard } from '../src/components/WeeklyDashboard';
import { HomeScreen } from '../src/screens/HomeScreen';
import { createWeeklyWorkoutPlans } from '../src/lib/starterPlans';
import { formatWeight, fromStoredWeight } from '../src/lib/format';

vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: () => ({
  offlineReady: [false, vi.fn()], needRefresh: [true, vi.fn()], updateServiceWorker: vi.fn(),
}) }));
import { UpdatePrompt } from '../src/components/UpdatePrompt';

describe('interface Elite e controles de integridade', () => {
  it('apresenta as 66 séries normais sem afirmar que já foram realizadas', () => {
    const html = renderToStaticMarkup(createElement(WeeklyDashboard, {
      plans: createWeeklyWorkoutPlans(), history: [],
    }));
    expect(html).toContain('/66');
    expect(html).not.toContain('Express');
    expect(html).toContain('registros da semana selecionada');
    expect(html).toContain('séries realizadas / plano');
  });
  it('não oferece Express nem seletor de modo na tela inicial', () => {
    const html = renderToStaticMarkup(createElement(HomeScreen, {
      plans: createWeeklyWorkoutPlans(), history: [], activeWorkout: null, showInstallPrompt: false,
      onStart: () => undefined, onContinue: () => undefined, onGoPlans: () => undefined, onGoHistory: () => undefined,
    }));
    expect(html).not.toContain('Express');
    expect(html).not.toContain('Duração do treino');
    expect(html).toContain('Iniciar');
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
