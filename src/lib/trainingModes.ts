import type { MuscleGroup, WorkoutPlan } from '../types';

export function plannedSets(plan: WorkoutPlan): number {
  return plan.exercises.reduce((sum, item) => sum + item.targetSets, 0);
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
