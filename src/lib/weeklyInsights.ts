import type { MuscleGroup, WorkoutHistory, WorkoutPlan } from '../types';

export function startOfLocalWeek(date = new Date()): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

export function weekSessions(history: WorkoutHistory[], date = new Date()): WorkoutHistory[] {
  const start = startOfLocalWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return history.filter((session) => Date.parse(session.finishedAt) >= start.getTime() && Date.parse(session.finishedAt) < end.getTime());
}

export function weeklyInsights(plans: WorkoutPlan[], history: WorkoutHistory[], date = new Date()) {
  const template = plans.filter((plan) => ['plan-full-body-a', 'plan-full-body-b', 'plan-full-body-c'].includes(plan.id));
  const programmed = template.length ? template : plans.filter((plan) => !plan.id.startsWith('plan-arquivo-'));
  const planned = new Map<MuscleGroup, number>();
  const actual = new Map<MuscleGroup, number>();
  let plannedSets = 0;
  let unclassifiedSets = 0;
  let actualSets = 0;
  for (const plan of programmed) {
    for (const exercise of plan.exercises) {
      plannedSets += exercise.targetSets;
      if (exercise.muscleGroup) planned.set(exercise.muscleGroup, (planned.get(exercise.muscleGroup) ?? 0) + exercise.targetSets);
    }
  }
  const sessions = weekSessions(history, date);
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      const count = exercise.sets.filter((set) => set.reps > 0).length;
      actualSets += count;
      // Old backups have no snapshot: match only unambiguous identity/name pairs.
      const candidates = plans.flatMap((plan) => plan.exercises).filter((item) => item.id === exercise.exerciseId && item.name === exercise.exerciseName);
      const groups = new Set(candidates.map((item) => item.muscleGroup).filter(Boolean));
      const muscle = exercise.muscleGroup ?? (groups.size === 1 ? [...groups][0] : undefined);
      if (muscle) actual.set(muscle, (actual.get(muscle) ?? 0) + count);
      else unclassifiedSets += count;
    }
  }
  const muscles = new Set([...planned.keys(), ...actual.keys()]);
  const rows = [...muscles].map((muscle) => ({ muscle, planned: planned.get(muscle) ?? 0, actual: actual.get(muscle) ?? 0 }))
    .sort((a, b) => b.planned - a.planned || a.muscle.localeCompare(b.muscle));
  return { rows, plannedSets, actualSets, unclassifiedSets, sessions, programmed };
}

export function searchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}
