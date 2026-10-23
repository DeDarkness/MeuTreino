import { describe, expect, it } from 'vitest';

import { createSeedState, validateAppState } from './database';
import { applyPreSurgicalProtocol, createWeeklyWorkoutPlans, ELITE_PROTOCOL_VERSION, upgradeEliteProtocol } from './starterPlans';
import { plannedSets, weeklyMuscleVolumes } from './trainingModes';
import { startWorkoutFromPlan } from './workout';

describe('MeuTreino Elite: apenas treino normal e métricas', () => {
  const plans = createWeeklyWorkoutPlans('2026-10-18T21:00:00.000Z');

  it('calcula os 66 sets normais sem modificar as fichas', () => {
    expect(plans.map((plan) => plannedSets(plan))).toEqual([22, 23, 21]);
    expect(plans[1].exercises.length).toBe(11);
  });

  it('inicia fichas personalizadas sem cortes', () => {
    const custom = { ...plans[0], id: 'my-plan', notes: 'Personalizado' };
    const state = { ...createSeedState(), plans: [custom] };
    expect(startWorkoutFromPlan(state, custom.id).workout.exercises.map((exercise) => exercise.sets.length))
      .toEqual(custom.exercises.map((exercise) => exercise.targetSets));
  });

  it('não aplica cortes por posição em uma ficha reordenada', () => {
    const reordered = { ...plans[0], exercises: [...plans[0].exercises].reverse() };
    const state = { ...createSeedState(), plans: [reordered] };
    expect(startWorkoutFromPlan(state, reordered.id).workout.exercises.map((exercise) => exercise.sets.length))
      .toEqual(reordered.exercises.map((exercise) => exercise.targetSets));
  });

  it('preserva o protocolo e a sessão Express em um backup JSON', () => {
    const state = applyPreSurgicalProtocol(createSeedState());
    const active = startWorkoutFromPlan(state, state.plans[0].id).state;
    // Compatibility only: an already-running session from an old app is preserved.
    active.activeWorkout!.trainingMode = 'express';
    active.activeWorkout!.planName += ' · Express';
    active.activeWorkout!.exercises[0].sets = active.activeWorkout!.exercises[0].sets.slice(0, 1);
    expect(validateAppState(JSON.parse(JSON.stringify(active)))).toEqual(active);
  });

  it('atualiza uma única vez, arquiva a ficha antiga e preserva histórico e preferências', () => {
    const seed = createSeedState();
    const old = { ...seed, eliteProtocolVersion: undefined,
      plans: seed.plans.map((plan) => ({ ...plan, notes: 'Ficha anterior' })) };
    const migrated = upgradeEliteProtocol(old);
    expect(migrated.plans).toHaveLength(6);
    expect(migrated.plans.slice(0, 3).map((plan) => plannedSets(plan))).toEqual([22, 23, 21]);
    expect(migrated.history).toBe(old.history);
    expect(migrated.preferences).toBe(old.preferences);
    expect(validateAppState(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
    migrated.plans[0].name = 'Meu A editado depois';
    expect(upgradeEliteProtocol(migrated)).toBe(migrated);
    expect(migrated.plans[0].name).toBe('Meu A editado depois');
  });

  it('adia a migração até a sessão em andamento terminar', () => {
    const seed = createSeedState();
    const old = { ...seed, eliteProtocolVersion: undefined };
    const active = startWorkoutFromPlan(old, old.plans[0].id).state;
    expect(upgradeEliteProtocol(active)).toBe(active);
    expect(upgradeEliteProtocol({ ...active, activeWorkout: null }).eliteProtocolVersion).toBe(ELITE_PROTOCOL_VERSION);
  });

  it('rejeita versões inválidas do marcador de migração', () => {
    expect(() => validateAppState({ ...createSeedState(), eliteProtocolVersion: ELITE_PROTOCOL_VERSION + 1 })).toThrow();
    expect(() => validateAppState({ ...createSeedState(), eliteProtocolVersion: -1 })).toThrow();
  });

  it('conta apenas o grupo dominante, sem duplicar a sobreposição', () => {
    const volumes = Object.fromEntries(weeklyMuscleVolumes(plans).map((item) => [item.muscle, item.sets]));
    expect(volumes).toMatchObject({ quadriceps: 9, peito: 8, costas: 12, biceps: 6, triceps: 6, posterior: 6, panturrilhas: 6, core: 4 });
    expect(Object.values(volumes).reduce((a, b) => a + b, 0)).toBe(66);
  });

  it('inicia apenas a sessão normal, mesmo com preferências Express antigas', () => {
    const seeded = createSeedState('2026-10-18T20:00:00.000Z');
    const installed = applyPreSurgicalProtocol(seeded);
    const original = installed.plans[0];
    installed.preferences.weeklyPlanModes = { [original.id]: 'express' };
    const changed = startWorkoutFromPlan(installed, original.id, '2026-10-18T22:45:00.000Z');
    expect(changed.workout.planName).toBe(original.name);
    expect(changed.workout.trainingMode).toBe('complete');
    expect(changed.workout.exercises.reduce((n, e) => n + e.sets.length, 0)).toBe(22);
    expect(changed.state.plans[0]).toEqual(original);
    expect(changed.state.history).toEqual(installed.history);
    expect(() => startWorkoutFromPlan(changed.state, original.id)).toThrow('sessão em andamento');
  });
});
