import type {
  ActiveWorkoutExercise,
  ActiveWorkoutSet,
  Exercise,
  WeightUnit,
  WorkoutHistory,
} from '../types';

export type ExerciseSessionMetric = {
  workoutId: string;
  finishedAt: string;
  maxWeight: number | null;
  maxReps: number;
  volume: number;
  estimatedOneRepMax: number | null;
};

export type ExerciseProgress = {
  key: string;
  exerciseId: string;
  exerciseName: string;
  sessions: ExerciseSessionMetric[];
  maxWeight: number | null;
  maxReps: number;
  bestVolume: number;
  bestEstimatedOneRepMax: number | null;
};

export type LoadSuggestion = {
  currentWeight: number;
  suggestedWeight: number;
  increment: number;
  targetReps: number;
  basedOn: string;
};

export function buildExerciseProgress(history: WorkoutHistory[]): ExerciseProgress[] {
  const grouped = new Map<string, ExerciseProgress>();
  const chronological = [...history].sort((left, right) => Date.parse(left.finishedAt) - Date.parse(right.finishedAt));

  for (const workout of chronological) {
    for (const exercise of workout.exercises) {
      if (exercise.sets.length === 0) continue;
      const key = normalized(exercise.exerciseName);
      const weightedSets = exercise.sets.filter((set) => set.weight !== null && set.weight > 0);
      const maxWeight = weightedSets.length ? Math.max(...weightedSets.map((set) => set.weight!)) : null;
      const estimated = weightedSets.length
        ? Math.max(...weightedSets.map((set) => estimateOneRepMax(set.weight!, set.reps)))
        : null;
      const session: ExerciseSessionMetric = {
        workoutId: workout.id,
        finishedAt: workout.finishedAt,
        maxWeight,
        maxReps: Math.max(...exercise.sets.map((set) => set.reps)),
        volume: exercise.sets.reduce((sum, set) => sum + (set.weight ?? 0) * set.reps, 0),
        estimatedOneRepMax: estimated,
      };
      const current = grouped.get(key) ?? {
        key,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        sessions: [],
        maxWeight: null,
        maxReps: 0,
        bestVolume: 0,
        bestEstimatedOneRepMax: null,
      };
      current.sessions.push(session);
      current.maxWeight = maximumNullable(current.maxWeight, session.maxWeight);
      current.maxReps = Math.max(current.maxReps, session.maxReps);
      current.bestVolume = Math.max(current.bestVolume, session.volume);
      current.bestEstimatedOneRepMax = maximumNullable(current.bestEstimatedOneRepMax, session.estimatedOneRepMax);
      grouped.set(key, current);
    }
  }

  return [...grouped.values()].sort((left, right) => left.exerciseName.localeCompare(right.exerciseName, 'pt-BR'));
}

export function getLoadSuggestion(
  history: WorkoutHistory[],
  exercise: Pick<Exercise, 'id' | 'name' | 'targetSets' | 'targetReps' | 'notes'> | ActiveWorkoutExercise,
  unit: WeightUnit,
): LoadSuggestion | null {
  const targetSets = 'targetSets' in exercise ? exercise.targetSets : exercise.sets.length;
  const targetReps = 'targetReps' in exercise
    ? upperRepTarget(exercise.notes, exercise.targetReps)
    : upperRepTarget(exercise.notes, Math.max(...exercise.sets.map((set) => set.targetReps)));
  const latest = [...history]
    .sort((left, right) => Date.parse(right.finishedAt) - Date.parse(left.finishedAt))
    .map((workout) => ({
      workout,
      exercise: workout.exercises.find((candidate) =>
        candidate.exerciseId === ('id' in exercise ? exercise.id : exercise.exerciseId)
        || normalized(candidate.exerciseName) === normalized('name' in exercise ? exercise.name : exercise.exerciseName)),
    }))
    .find((candidate) => candidate.exercise)?.exercise;

  if (!latest || latest.sets.length < targetSets) return null;
  if (!latest.sets.every((set) => set.reps >= targetReps && set.weight !== null && set.weight > 0)) return null;

  const currentWeight = Math.min(...latest.sets.map((set) => set.weight!));
  const increment = unit === 'lb' ? 5 / 2.2046226218 : 2.5;
  return {
    currentWeight,
    suggestedWeight: roundStoredWeight(currentWeight + increment),
    increment: roundStoredWeight(increment),
    targetReps,
    basedOn: latest.exerciseName,
  };
}

export function getPotentialRecordLabels(
  history: WorkoutHistory[],
  exercise: Pick<ActiveWorkoutExercise, 'exerciseId' | 'exerciseName'>,
  set: Pick<ActiveWorkoutSet, 'reps' | 'weight'>,
): string[] {
  const previousSets = history.flatMap((workout) => workout.exercises
    .filter((candidate) => candidate.exerciseId === exercise.exerciseId || normalized(candidate.exerciseName) === normalized(exercise.exerciseName))
    .flatMap((candidate) => candidate.sets));
  if (previousSets.length === 0) return [];

  const labels: string[] = [];
  const previousMaxReps = Math.max(...previousSets.map((candidate) => candidate.reps));
  if (set.reps > previousMaxReps) labels.push('Mais repetições');

  if (set.weight !== null && set.weight > 0) {
    const previousWeighted = previousSets.filter((candidate) => candidate.weight !== null && candidate.weight > 0);
    if (previousWeighted.length > 0) {
      const previousMaxWeight = Math.max(...previousWeighted.map((candidate) => candidate.weight!));
      if (set.weight > previousMaxWeight) labels.unshift('Maior carga');
      const previousStrength = Math.max(...previousWeighted.map((candidate) => estimateOneRepMax(candidate.weight!, candidate.reps)));
      if (estimateOneRepMax(set.weight, set.reps) > previousStrength && !labels.includes('Maior carga')) labels.push('Recorde de força');
    }
  }
  return labels;
}

export function estimateOneRepMax(weight: number, reps: number) {
  return weight * (1 + Math.max(0, reps) / 30);
}

function upperRepTarget(notes: string | undefined, fallback: number) {
  const match = notes?.match(/Meta:\s*\d+\s*[–-]\s*(\d+)\s*repetições/i);
  return match ? Number(match[1]) : fallback;
}

function maximumNullable(left: number | null, right: number | null) {
  if (left === null) return right;
  if (right === null) return left;
  return Math.max(left, right);
}

function roundStoredWeight(value: number) {
  return Math.round(value * 100) / 100;
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR');
}
