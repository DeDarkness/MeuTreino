import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSeedState, loadState, readSafetySnapshot, saveState, validateAppState } from './database';
import { createWeeklyWorkoutPlans, ELITE_PROTOCOL_VERSION, upgradeEliteProtocol } from './starterPlans';
import { completeActiveSet, finishActiveWorkout, startWorkoutFromPlan } from './workout';

const legacyState = () => {
  const state = createSeedState();
  state.eliteProtocolVersion = 1;
  const core = state.plans[0].exercises.find((item) => item.id === 'full-body-a-abdomen')!;
  core.id = 'pre-pallof';
  core.name = 'Pallof press (antirrotação)';
  core.notes = 'Meta: 10–15 repetições · RIR 2 · cada lado; sem dor ou pressão abdominal desconfortável';
  return state;
};

afterEach(() => vi.unstubAllGlobals());

describe('troca pontual do core da segunda-feira', () => {
  it('usa crunch na polia com as mesmas séries, repetições e descanso na ficha nova', () => {
    const monday = createWeeklyWorkoutPlans()[0];
    expect(monday.exercises.find((item) => item.muscleGroup === 'core')).toMatchObject({
      id: 'full-body-a-abdomen', name: 'Crunch abdominal na polia', targetSets: 2,
      minReps: 10, targetReps: 15, restSeconds: 60, targetRirMin: 2,
    });
    expect(monday.exercises.reduce((sum, item) => sum + item.targetSets, 0)).toBe(22);
  });

  it('preserva parâmetros personalizados, outras fichas e exercícios', () => {
    const previous = legacyState();
    previous.plans[0].name = 'Meu A personalizado';
    previous.plans[0].exercises[0].targetSets = 4;
    Object.assign(previous.plans[0].exercises.at(-1)!, { targetSets: 3, restSeconds: 90, loadIncrementKg: 0.5 });
    const next = upgradeEliteProtocol(previous, '2026-10-19T13:00:00.000Z');
    const core = next.plans[0].exercises.at(-1)!;
    expect(core).toMatchObject({ name: 'Crunch abdominal na polia', targetSets: 3, restSeconds: 90, loadIncrementKg: 0.5 });
    expect(core.notes).not.toContain('cada lado');
    expect(next.plans[0].name).toBe('Meu A personalizado');
    expect(next.plans[0].exercises[0]).toBe(previous.plans[0].exercises[0]);
    expect(next.plans[1]).toBe(previous.plans[1]);
    expect(next.plans[2]).toBe(previous.plans[2]);
    expect(next.history).toBe(previous.history);
    expect(previous.plans[0].exercises.at(-1)!.id).toBe('pre-pallof');
    expect(validateAppState(next).eliteProtocolVersion).toBe(ELITE_PROTOCOL_VERSION);
  });

  it('mantém o histórico de Pallof e não herda sua carga para o crunch', () => {
    let state = startWorkoutFromPlan(legacyState(), 'plan-full-body-a').state;
    const core = state.activeWorkout!.exercises.at(-1)!;
    core.sets[0].weight = 45;
    state = completeActiveSet(state, core.exerciseId, core.sets[0].id);
    const finished = finishActiveWorkout(state);
    const migrated = upgradeEliteProtocol(finished.state);
    expect(migrated.history[0].exercises[0].exerciseName).toBe('Pallof press (antirrotação)');
    const next = startWorkoutFromPlan(migrated, 'plan-full-body-a').workout.exercises.at(-1)!;
    expect(next.exerciseName).toBe('Crunch abdominal na polia');
    expect(next.sets[0].weight).toBeNull();
  });

  it('não altera uma sessão ativa nem reaplica a troca após edição', () => {
    const active = startWorkoutFromPlan(legacyState(), 'plan-full-body-a').state;
    expect(upgradeEliteProtocol(active)).toBe(active);
    expect(active.activeWorkout!.exercises.at(-1)!.exerciseName).toContain('Pallof');
    const next = upgradeEliteProtocol({ ...active, activeWorkout: null });
    next.plans[0].exercises.at(-1)!.name = 'Minha edição posterior';
    expect(upgradeEliteProtocol(next)).toBe(next);
  });

  it('não recria um exercício removido ou substituído manualmente', () => {
    const previous = legacyState();
    previous.plans[0].exercises = previous.plans[0].exercises.filter((item) => item.id !== 'pre-pallof');
    const next = upgradeEliteProtocol(previous);
    expect(next.plans[0].exercises).toBe(previous.plans[0].exercises);
    expect(next.plans[0].notes).toContain('20 séries');
    expect(next.plans[0].exercises).toHaveLength(9);
  });

  it('faz cópia do estado anterior ao migrar dados já instalados', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    await saveState(legacyState());
    const loaded = await loadState();
    expect(loaded.plans[0].exercises.at(-1)!.name).toBe('Crunch abdominal na polia');
    const checkpoint = await readSafetySnapshot();
    expect(checkpoint?.value.plans[0].exercises.at(-1)!.name).toBe('Pallof press (antirrotação)');
    expect(checkpoint?.value.eliteProtocolVersion).toBe(1);
  });
});
