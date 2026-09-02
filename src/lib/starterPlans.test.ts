import { describe, expect, it } from 'vitest';

import type { AppState } from '../types';
import { createSeedState } from './database';
import { createWeeklyWorkoutPlans, getSuggestedPlanId, installWeeklyWorkoutPlans, STARTER_PLAN_VERSION } from './starterPlans';

describe('treinos semanais prontos', () => {
  it('cadastra os seis dias e os 39 exercícios informados', () => {
    const plans = createWeeklyWorkoutPlans('2026-09-02T12:00:00.000Z');
    expect(plans.map((plan) => plan.name)).toEqual([
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ]);
    expect(plans.reduce((total, plan) => total + plan.exercises.length, 0)).toBe(39);
    expect(plans.reduce(
      (total, plan) => total + plan.exercises.reduce((sets, item) => sets + item.targetSets, 0),
      0,
    )).toBe(130);
    expect(plans[0].exercises[0]).toMatchObject({ targetSets: 3, targetReps: 12, restSeconds: 120 });
    expect(plans[0].exercises[0].notes).toContain('8–12');
  });

  it('sugere o treino correspondente ao dia atual', () => {
    expect(getSuggestedPlanId(1)).toBe('plan-segunda');
    expect(getSuggestedPlanId(3)).toBe('plan-quarta');
    expect(getSuggestedPlanId(6)).toBe('plan-sabado');
    expect(getSuggestedPlanId(0)).toBe('plan-segunda');
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
    expect(upgraded.plans).toHaveLength(7);
    expect(upgraded.plans.some((plan) => plan.id === 'plano-pessoal')).toBe(true);
    expect(upgraded.plans.some((plan) => plan.id === 'plan-treino-a')).toBe(false);
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
