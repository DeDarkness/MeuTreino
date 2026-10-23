import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WeeklyDashboard } from '../src/components/WeeklyDashboard';
import { HomeScreen } from '../src/screens/HomeScreen';
import { createWeeklyWorkoutPlans } from '../src/lib/starterPlans';
import { formatWeight, fromStoredWeight } from '../src/lib/format';
import { createSeedState } from '../src/lib/database';
import { finishActiveWorkout, startWorkoutFromPlan } from '../src/lib/workout';
import { RecoveryPanel } from '../src/components/RecoveryPanel';

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
      recoveryItems: [], queuedMissedPlans: [], onStartRecovery: async () => undefined, onDiscardRecovery: () => undefined, onQueueMissedPlan: () => undefined,
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
  it('mostra pendências sem tratá-las como volume realizado nem meta', () => {
    const seed = createSeedState();
    const pending = finishActiveWorkout(startWorkoutFromPlan(seed, seed.plans[0].id).state).state;
    const html = renderToStaticMarkup(createElement(RecoveryPanel, {
      items: pending.recoveryItems!, activeWorkout: null, onStart: async () => undefined, onDiscard: () => undefined,
    }));
    expect(html).toContain('22 séries pendentes');
    expect(html).toContain('0 séries selecionadas');
    expect(html).toContain('Não são metas nem indicação de volume');
    expect(html).toContain('Séries a repor de Hack squat');
    expect(html).not.toContain('Express');
    expect(pending.history).toEqual([]);
  });
});
