import { FULL_BODY_DAYS } from './starterPlans';
import { searchText } from './weeklyInsights';
import type { WorkoutHistory } from '../types';

export function fullBodyDay(session: WorkoutHistory) {
  if (session.recoveryWeekStart || session.trainingMode === 'express') return null;
  const name = searchText(session.planName);
  return FULL_BODY_DAYS.find((day) => day.planId === session.planId)
    ?? FULL_BODY_DAYS.find((day) => name === `full body ${day.workout.toLowerCase()}`)
    ?? null;
}

export function comparisonGroup(session: WorkoutHistory): string {
  const day = fullBodyDay(session);
  const plan = day?.planId ?? session.planId ?? searchText(session.planName);
  return JSON.stringify([session.recoveryWeekStart ? 'recovery' : session.trainingMode ?? 'complete', plan]);
}

type Exercise = WorkoutHistory['exercises'][number];

export function compareHistoryExercises(first: WorkoutHistory, second: WorkoutHistory) {
  const remaining = [...second.exercises];
  const pairs: Array<{ first?: Exercise; second?: Exercise }> = [];
  for (const exercise of first.exercises) {
    const name = searchText(exercise.exerciseName);
    let index = remaining.findIndex((other) => other.exerciseId === exercise.exerciseId && searchText(other.exerciseName) === name);
    if (index < 0 && first.exercises.filter((other) => searchText(other.exerciseName) === name).length === 1) {
      const candidates = second.exercises.filter((other) => searchText(other.exerciseName) === name);
      if (candidates.length === 1) index = remaining.indexOf(candidates[0]);
    }
    pairs.push({ first: exercise, second: index >= 0 ? remaining.splice(index, 1)[0] : undefined });
  }
  for (const exercise of remaining) pairs.push({ second: exercise });
  return pairs;
}
