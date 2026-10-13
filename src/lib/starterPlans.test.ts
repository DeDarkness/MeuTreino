import { describe, expect, it } from 'vitest';

import type { AppState } from '../types';
import { createSeedState, validateAppState } from './database';
import { createWeeklyWorkoutPlans, getSuggestedPlanId, installWeeklyWorkoutPlans, STARTER_PLAN_VERSION } from './starterPlans';

describe('treinos semanais prontos', () => {
  it('cadastra o Full Body A/B/C com os 27 exercícios e 69 séries informados', () => {
    const plans = createWeeklyWorkoutPlans('2026-09-02T12:00:00.000Z');
    expect(plans.map((plan) => plan.name)).toEqual(['Full Body A', 'Full Body B', 'Full Body C']);
    expect(plans.reduce((total, plan) => total + plan.exercises.length, 0)).toBe(27);
    expect(plans.reduce(
      (total, plan) => total + plan.exercises.reduce((sets, item) => sets + item.targetSets, 0),
      0,
    )).toBe(69);
    expect(plans.map((plan) => plan.exercises.reduce((sets, item) => sets + item.targetSets, 0))).toEqual([22, 23, 24]);
    expect(plans[0].exercises[0]).toMatchObject({ targetSets: 4, targetReps: 8, restSeconds: 180 });
    expect(plans[0].exercises[0].notes).toContain('5–8 repetições · RIR 1–2');
    expect(plans[0].exercises[5].supersetGroup).toBe('A');
    expect(plans[0].exercises[6].supersetGroup).toBe('A');
  });

  it('sugere o treino correspondente ao dia atual', () => {
    expect(getSuggestedPlanId(1)).toBe('plan-full-body-a');
    expect(getSuggestedPlanId(3)).toBe('plan-full-body-b');
    expect(getSuggestedPlanId(5)).toBe('plan-full-body-c');
    expect(getSuggestedPlanId(0)).toBe('plan-full-body-a');
  });

  it('substitui somente as fichas de exemplo e preserva dados pessoais', () => {
    const currentState = createSeedState('2026-09-01T12:00:00.000Z');
    const legacyState: AppState = {
      ...currentState,
      starterPlanVersion: undefined,
      plans: [
        { ...currentState.plans[0], id: 'plan-treino-a' },
        { ...currentState.plans[1], id: 'plan-treino-b' },
        { ...currentState.plans[0], id: 'plano-pessoal', name: 'Meu plano pessoal' },
      ],
    };

    const upgraded = installWeeklyWorkoutPlans(legacyState, '2026-09-02T12:00:00.000Z');
    expect(upgraded.starterPlanVersion).toBe(STARTER_PLAN_VERSION);
    expect(upgraded.plans).toHaveLength(4);
    expect(upgraded.plans.some((plan) => plan.id === 'plano-pessoal')).toBe(true);
    expect(upgraded.plans.some((plan) => plan.id === 'plan-treino-a')).toBe(false);
  });

  it('troca a rotina antiga, mas mantém planos pessoais e o histórico', () => {
    const currentState = createSeedState('2026-09-01T12:00:00.000Z');
    const oldBundledPlan = { ...currentState.plans[0], id: 'plan-segunda', name: 'Segunda-feira' };
    const personalPlan = { ...currentState.plans[1], id: 'plano-pessoal', name: 'Meu plano pessoal' };
    const history = [{
      id: 'historico-antigo',
      planId: 'plan-segunda',
      planName: 'Segunda-feira',
      startedAt: '2026-08-25T12:00:00.000Z',
      finishedAt: '2026-08-25T13:00:00.000Z',
      durationSeconds: 3600,
      exercises: [],
    }];
    const upgraded = installWeeklyWorkoutPlans({
      ...currentState,
      starterPlanVersion: 1,
      plans: [oldBundledPlan, personalPlan],
      history,
    }, '2026-09-02T12:00:00.000Z');

    expect(upgraded.plans.map((plan) => plan.id)).toEqual([
      'plan-full-body-a',
      'plan-full-body-b',
      'plan-full-body-c',
      'plano-pessoal',
    ]);
    expect(upgraded.history).toEqual(history);
  });

  it('aceita os dados da versão anterior para executar a migração', () => {
    const previousVersion = { ...createSeedState(), starterPlanVersion: 1 };
    expect(validateAppState(previousVersion).starterPlanVersion).toBe(1);
  });

  it('remove somente uma sessão de exemplo que ainda não foi usada', () => {
    const currentState = createSeedState('2026-09-01T12:00:00.000Z');
    const legacyPlan = { ...currentState.plans[0], id: 'plan-treino-a', name: 'Treino A' };
    const legacyWorkout = {
      id: 'sessao-exemplo',
      planId: legacyPlan.id,
      planName: legacyPlan.name,
      startedAt: '2026-09-01T12:00:00.000Z',
      updatedAt: '2026-09-01T12:00:00.000Z',
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      restStartedAt: null,
      restEndsAt: null,
      restDurationSeconds: null,
      exercises: legacyPlan.exercises.map((item) => ({
        exerciseId: item.id,
        exerciseName: item.name,
        restSeconds: item.restSeconds,
        sets: Array.from({ length: item.targetSets }, (_, index) => ({
          id: `${item.id}-${index + 1}`,
          setNumber: index + 1,
          targetReps: item.targetReps,
          reps: item.targetReps,
          weight: null,
          completed: false,
          completedAt: null,
        })),
      })),
    };
    const legacyState: AppState = {
      ...currentState,
      starterPlanVersion: undefined,
      plans: [legacyPlan],
      activeWorkout: legacyWorkout,
    };

    expect(installWeeklyWorkoutPlans(legacyState).activeWorkout).toBeNull();
    legacyWorkout.exercises[0].sets[0].completed = true;
    expect(installWeeklyWorkoutPlans({ ...legacyState, activeWorkout: legacyWorkout }).activeWorkout).not.toBeNull();
  });
});
