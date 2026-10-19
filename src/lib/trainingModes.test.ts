import { describe, expect, it } from 'vitest';

import { createSeedState, validateAppState } from './database';
import { applyPreSurgicalProtocol, createWeeklyWorkoutPlans, upgradeEliteProtocol } from './starterPlans';
import { canUseExpress, getModeExercises, plannedSets, weeklyMuscleVolumes } from './trainingModes';
import { startWorkoutFromPlan } from './workout';

describe('MeuTreino Elite: modo Express e métricas', () => {
  const plans = createWeeklyWorkoutPlans('2026-10-18T21:00:00.000Z');

  it('calcula os 60 sets completos e 45 Express sem modificar as fichas', () => {
    expect(plans.map((plan) => plannedSets(plan))).toEqual([20, 19, 21]);
    expect(plans.map((plan) => plannedSets(plan, 'express'))).toEqual([15, 15, 15]);
    expect(plans.map((plan) => plannedSets(plan))).toEqual([20, 19, 21]);
    expect(plans.every(canUseExpress)).toBe(true);
    expect(getModeExercises(plans[1], 'express').length).toBe(8);
    expect(plans[1].exercises.length).toBe(9);
  });

  it('não propõe Express em ficha personalizada sem prescrição de corte', () => {
    const custom = { ...plans[0], id: 'my-plan', notes: 'Personalizado' };
    expect(canUseExpress(custom)).toBe(false);
    expect(() => plannedSets(custom, 'express')).toThrow();
  });

  it('não aplica cortes por posição em uma ficha reordenada', () => {
    const reordered = { ...plans[0], exercises: [...plans[0].exercises].reverse() };
    expect(canUseExpress(reordered)).toBe(false);
    expect(() => getModeExercises(reordered, 'express')).toThrow();
  });

  it('preserva o protocolo e a sessão Express em um backup JSON', () => {
    const state = applyPreSurgicalProtocol(createSeedState());
    const active = startWorkoutFromPlan(state, state.plans[0].id, undefined, 'express').state;
    expect(validateAppState(JSON.parse(JSON.stringify(active)))).toEqual(active);
  });

  it('atualiza uma única vez, arquiva a ficha antiga e preserva histórico e preferências', () => {
    const seed = createSeedState();
    const old = { ...seed, eliteProtocolVersion: undefined,
      plans: seed.plans.map((plan) => ({ ...plan, notes: 'Ficha anterior' })) };
    const migrated = upgradeEliteProtocol(old);
    expect(migrated.plans).toHaveLength(6);
    expect(migrated.plans.slice(0, 3).map((plan) => plannedSets(plan))).toEqual([20, 19, 21]);
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
    expect(upgradeEliteProtocol({ ...active, activeWorkout: null }).eliteProtocolVersion).toBe(1);
  });

  it('rejeita versões inválidas do marcador de migração', () => {
    expect(() => validateAppState({ ...createSeedState(), eliteProtocolVersion: 2 })).toThrow();
    expect(() => validateAppState({ ...createSeedState(), eliteProtocolVersion: -1 })).toThrow();
  });

  it('conta apenas o grupo dominante, sem duplicar a sobreposição', () => {
    const volumes = Object.fromEntries(weeklyMuscleVolumes(plans).map((item) => [item.muscle, item.sets]));
    expect(volumes).toMatchObject({ quadriceps: 9, peito: 8, costas: 10, posterior: 6, panturrilhas: 6, core: 4 });
    expect(Object.values(volumes).reduce((a, b) => a + b, 0)).toBe(60);
  });

  it('inicia uma sessão Express, preserva a ficha e não toca no histórico', () => {
    const seeded = createSeedState('2026-10-18T20:00:00.000Z');
    const installed = applyPreSurgicalProtocol(seeded);
    const original = installed.plans[0];
    const changed = startWorkoutFromPlan(installed, original.id, '2026-10-18T22:45:00.000Z', 'express');
    expect(changed.workout.planName).toContain('Express');
    expect(changed.workout.exercises.reduce((n, e) => n + e.sets.length, 0)).toBe(15);
    expect(changed.state.plans[0]).toEqual(original);
    expect(changed.state.history).toEqual(installed.history);
    expect(() => startWorkoutFromPlan(changed.state, original.id)).toThrow('sessão em andamento');
  });
});
