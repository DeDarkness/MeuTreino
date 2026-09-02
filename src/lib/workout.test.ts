import { describe, expect, it } from 'vitest';

import { createSeedState, validateAppState } from './database';
import {
  addRestTime,
  completeActiveSet,
  finishActiveWorkout,
  startWorkoutFromPlan,
} from './workout';
import type { AppState } from '../types';

const startedAt = '2026-09-01T12:00:00.000Z';

describe('sessão de treino', () => {
  it('restaura a carga e as repetições mais recentes por série', () => {
    const seed = createSeedState(startedAt);
    const withHistory: AppState = {
      ...seed,
      history: [{
        id: 'history-1',
        planId: 'plan-segunda',
        planName: 'Segunda-feira',
        startedAt: '2026-08-30T12:00:00.000Z',
        finishedAt: '2026-08-30T13:00:00.000Z',
        durationSeconds: 3600,
        exercises: [{
          exerciseId: 'segunda-supino-inclinado-halteres',
          exerciseName: 'Supino inclinado com halteres',
          sets: [{ id: 'old-set-1', setNumber: 1, reps: 7, weight: 82.5, completedAt: '2026-08-30T12:05:00.000Z' }],
        }],
      }],
    };

    const { workout } = startWorkoutFromPlan(withHistory, 'plan-segunda', startedAt);
    expect(workout.exercises[0].sets[0]).toMatchObject({ reps: 7, weight: 82.5 });
    expect(workout.exercises[0].sets[1]).toMatchObject({ reps: 12, weight: null });
  });

  it('conclui a série, avança o cursor e usa um fim de descanso absoluto', () => {
    const seed = createSeedState(startedAt);
    const started = startWorkoutFromPlan(seed, 'plan-segunda', startedAt).state;
    const workout = started.activeWorkout!;
    const firstExercise = workout.exercises[0];
    const firstSet = firstExercise.sets[0];
    const completedAt = new Date('2026-09-01T12:00:10.000Z');

    const completed = completeActiveSet(started, firstExercise.exerciseId, firstSet.id, completedAt);
    expect(completed.activeWorkout?.exercises[0].sets[0].completed).toBe(true);
    expect(completed.activeWorkout).toMatchObject({
      currentExerciseIndex: 0,
      currentSetIndex: 1,
      restStartedAt: '2026-09-01T12:00:10.000Z',
      restEndsAt: '2026-09-01T12:02:10.000Z',
    });
  });

  it('acrescenta descanso e salva somente séries concluídas no histórico', () => {
    const seed = createSeedState(startedAt);
    const started = startWorkoutFromPlan(seed, 'plan-segunda', startedAt).state;
    const firstExercise = started.activeWorkout!.exercises[0];
    const completed = completeActiveSet(
      started,
      firstExercise.exerciseId,
      firstExercise.sets[0].id,
      new Date('2026-09-01T12:00:10.000Z'),
    );
    const extended = addRestTime(completed, 15, new Date('2026-09-01T12:00:20.000Z'));
    expect(extended.activeWorkout?.restEndsAt).toBe('2026-09-01T12:02:25.000Z');

    const finished = finishActiveWorkout(extended, new Date('2026-09-01T12:30:00.000Z'));
    expect(finished.state.activeWorkout).toBeNull();
    expect(finished.history.exercises).toHaveLength(1);
    expect(finished.history.exercises[0].sets).toHaveLength(1);
  });
});

describe('validação de dados', () => {
  it('rejeita quantidades capazes de travar a criação da sessão', () => {
    const invalid = createSeedState(startedAt);
    invalid.plans[0].exercises[0].targetSets = 100_000;
    expect(() => validateAppState(invalid)).toThrow(/targetSets/);
  });

  it('rejeita cursor de sessão fora dos limites', () => {
    const seed = createSeedState(startedAt);
    const started = startWorkoutFromPlan(seed, 'plan-segunda', startedAt).state;
    started.activeWorkout!.currentExerciseIndex = 999;
    expect(() => validateAppState(started)).toThrow(/currentExerciseIndex/);
  });
});
