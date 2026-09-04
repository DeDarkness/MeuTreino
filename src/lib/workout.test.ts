import { describe, expect, it } from 'vitest';

import { createSeedState, validateAppState } from './database';
import {
  addRestTime,
  completeActiveSet,
  deferActiveExercise,
  finishActiveWorkout,
  moveActiveExercise,
  selectActiveSet,
  startWorkoutFromPlan,
  toggleSkipActiveExercise,
  uncompleteActiveSet,
  updateActiveSet,
  updateActiveWorkoutNotes,
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

  it('permite escolher e editar qualquer série sem interromper o descanso', () => {
    const seed = createSeedState(startedAt);
    const started = startWorkoutFromPlan(seed, 'plan-segunda', startedAt).state;
    const firstExercise = started.activeWorkout!.exercises[0];
    const resting = completeActiveSet(
      started,
      firstExercise.exerciseId,
      firstExercise.sets[0].id,
      new Date('2026-09-01T12:00:10.000Z'),
    );
    const targetExercise = resting.activeWorkout!.exercises[1];
    const targetSet = targetExercise.sets[2];
    const selected = selectActiveSet(resting, targetExercise.exerciseId, targetSet.id, '2026-09-01T12:00:20.000Z');
    const edited = updateActiveSet(selected, targetExercise.exerciseId, targetSet.id, { reps: 9, weight: 87.5 });

    expect(edited.activeWorkout).toMatchObject({
      currentExerciseIndex: 1,
      currentSetIndex: 2,
      restEndsAt: '2026-09-01T12:02:10.000Z',
    });
    expect(edited.activeWorkout?.exercises[1].sets[2]).toMatchObject({ reps: 9, weight: 87.5 });
  });

  it('salva RIR, anotação e permite desfazer uma série concluída', () => {
    const seed = createSeedState(startedAt);
    const started = startWorkoutFromPlan(seed, 'plan-segunda', startedAt).state;
    const exercise = started.activeWorkout!.exercises[0];
    const set = exercise.sets[0];
    const withRir = updateActiveSet(started, exercise.exerciseId, set.id, { rir: 2 });
    const withNotes = updateActiveWorkoutNotes(withRir, 'Execução controlada.');
    const completed = completeActiveSet(withNotes, exercise.exerciseId, set.id, new Date('2026-09-01T12:01:00.000Z'));
    const finished = finishActiveWorkout(completed, new Date('2026-09-01T12:30:00.000Z'));
    const undone = uncompleteActiveSet(completed, exercise.exerciseId, set.id);

    expect(finished.history.notes).toBe('Execução controlada.');
    expect(finished.history.exercises[0].sets[0].rir).toBe(2);
    expect(undone.activeWorkout?.notes).toBe('Execução controlada.');
    expect(undone.activeWorkout?.exercises[0].sets[0]).toMatchObject({ rir: 2, completed: false, completedAt: null });
  });

  it('alterna exercícios de uma supersérie e só descansa ao fechar a rodada', () => {
    const seed = createSeedState(startedAt);
    seed.plans[0].exercises[0].supersetGroup = 'A';
    seed.plans[0].exercises[1].supersetGroup = 'A';
    const started = startWorkoutFromPlan(seed, 'plan-segunda', startedAt).state;
    const first = started.activeWorkout!.exercises[0];
    const second = started.activeWorkout!.exercises[1];
    const afterFirst = completeActiveSet(started, first.exerciseId, first.sets[0].id, new Date('2026-09-01T12:00:10.000Z'));
    expect(afterFirst.activeWorkout).toMatchObject({ currentExerciseIndex: 1, currentSetIndex: 0, restEndsAt: null });

    const afterSecond = completeActiveSet(afterFirst, second.exerciseId, second.sets[0].id, new Date('2026-09-01T12:00:20.000Z'));
    expect(afterSecond.activeWorkout).toMatchObject({ currentExerciseIndex: 0, currentSetIndex: 1, restEndsAt: '2026-09-01T12:01:50.000Z' });
  });

  it('permite reordenar, deixar para depois e pular um exercício vazio', () => {
    const seed = createSeedState(startedAt);
    const started = startWorkoutFromPlan(seed, 'plan-segunda', startedAt).state;
    const firstId = started.activeWorkout!.exercises[0].exerciseId;
    const moved = moveActiveExercise(started, firstId, 1);
    expect(moved.activeWorkout?.exercises[1].exerciseId).toBe(firstId);

    const deferred = deferActiveExercise(moved, firstId);
    expect(deferred.activeWorkout?.exercises.at(-1)?.exerciseId).toBe(firstId);
    expect(deferred.activeWorkout?.currentExerciseIndex).toBe(1);

    const current = deferred.activeWorkout!.exercises[deferred.activeWorkout!.currentExerciseIndex];
    const skipped = toggleSkipActiveExercise(deferred, current.exerciseId);
    expect(skipped.activeWorkout?.exercises.find((exercise) => exercise.exerciseId === current.exerciseId)?.skipped).toBe(true);
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
