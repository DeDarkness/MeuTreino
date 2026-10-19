import { createWeeklyWorkoutPlans } from './starterPlans';
import type { Exercise, MuscleGroup, WorkoutPlan } from '../types';

export type TrainingMode = 'complete' | 'express';

/** Explicit per-exercise profile; do not infer priorities from exercise name. */
const EXPRESS_SETS: Record<string, readonly number[]> = {
  'plan-full-body-a': [3, 3, 2, 2, 1, 1, 1, 1, 1], // 15
  'plan-full-body-b': [2, 3, 2, 2, 2, 1, 0, 1, 2], // 15
  'plan-full-body-c': [2, 3, 2, 2, 1, 1, 1, 1, 1, 1], // 15
};

/** The Express option is limited to the explicitly identified bundled protocol. */
export function canUseExpress(plan: WorkoutPlan): boolean {
  const bundled = createWeeklyWorkoutPlans('').find((item) => item.id === plan.id);
  return Boolean(EXPRESS_SETS[plan.id]
    && plan.notes?.startsWith('Pré-cirurgia')
    && plan.exercises.length === EXPRESS_SETS[plan.id].length
    && plan.exercises.every((exercise, index) =>
      exercise.id === bundled?.exercises[index]?.id
      && exercise.targetSets >= EXPRESS_SETS[plan.id][index]));
}

export function getModeExercises(plan: WorkoutPlan, mode: TrainingMode): Exercise[] {
  if (mode === 'complete') return plan.exercises;
  if (!canUseExpress(plan)) throw new Error('A versão Express está disponível apenas para as fichas Elite originais.');
  const counts = EXPRESS_SETS[plan.id];
  return plan.exercises.flatMap((exercise, index) => counts[index] > 0
    ? [{ ...exercise, targetSets: counts[index] }]
    : []);
}

export function plannedSets(plan: WorkoutPlan, mode: TrainingMode = 'complete'): number {
  return getModeExercises(plan, mode).reduce((sum, item) => sum + item.targetSets, 0);
}

/** Direct/dominant set counts only. Compound synergist work is not double-counted. */
export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  quadriceps: 'Quadríceps', posterior: 'Posteriores', gluteos: 'Glúteos',
  peito: 'Peito', costas: 'Costas', ombros: 'Deltoides (anterior/lateral)',
  deltoide_posterior: 'Deltoide posterior', biceps: 'Bíceps',
  triceps: 'Tríceps', panturrilhas: 'Panturrilhas', core: 'Core',
};

export function weeklyMuscleVolumes(plans: WorkoutPlan[]): Array<{ muscle: MuscleGroup; label: string; sets: number }> {
  const tally = new Map<MuscleGroup, number>();
  for (const plan of plans) {
    for (const exercise of plan.exercises) {
      if (!exercise.muscleGroup) continue;
      tally.set(exercise.muscleGroup, (tally.get(exercise.muscleGroup) ?? 0) + exercise.targetSets);
    }
  }
  return [...tally].map(([muscle, sets]) => ({ muscle, label: MUSCLE_LABELS[muscle], sets }))
    .sort((a, b) => b.sets - a.sets || a.label.localeCompare(b.label, 'pt-BR'));
}
