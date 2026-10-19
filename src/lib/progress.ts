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
  percentage: number;
};

type ProgressionExercise = (Pick<Exercise, 'id' | 'name' | 'targetSets' | 'targetReps'>
  & Partial<Pick<Exercise, 'notes' | 'targetRirMin' | 'targetRirMax' | 'loadIncrementKg'>>) | ActiveWorkoutExercise;

export type ProgressionAdvice = {
  kind: 'start' | 'maintain' | 'record-rir' | 'adjust-step' | 'increase';
  title: string;
  message: string;
  suggestion: LoadSuggestion | null;
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
      const estimates = weightedSets.map((set) => estimateOneRepMax(set.weight!, set.reps)).filter((value): value is number => value !== null);
      const estimated = estimates.length ? Math.max(...estimates) : null;
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
  exercise: ProgressionExercise,
  unit: WeightUnit,
): LoadSuggestion | null {
  return getProgressionAdvice(history, exercise, unit).suggestion;
}

export function getProgressionAdvice(history: WorkoutHistory[], exercise: ProgressionExercise, unit: WeightUnit): ProgressionAdvice {
  const advice = (kind: ProgressionAdvice['kind'], title: string, message: string): ProgressionAdvice => ({ kind, title, message, suggestion: null });
  const targetSets = 'targetSets' in exercise ? exercise.targetSets : exercise.sets.length;
  const targetReps = 'targetReps' in exercise
    ? exercise.targetReps
    : Math.max(...exercise.sets.map((set) => set.targetReps));
  const latest = [...history]
    .sort((left, right) => Date.parse(right.finishedAt) - Date.parse(left.finishedAt))
    .map((workout) => ({
      workout,
      exercise: workout.exercises.find((candidate) =>
        normalized(candidate.exerciseName) === normalized('name' in exercise ? exercise.name : exercise.exerciseName)),
    }))
    .find((candidate) => candidate.exercise)?.exercise;

  if (!latest) return advice('start', 'Construa sua referência', 'Registre carga, repetições e RIR. Nenhuma carga é aumentada automaticamente.');
  if (latest.sets.length < targetSets) return advice('maintain', 'Complete a referência', 'A última sessão teve menos séries que a meta atual. Registre uma sessão com a quantidade planejada antes de progredir.');
  if (!latest.sets.every((set) => set.reps >= targetReps && set.weight !== null && set.weight > 0)) {
    return advice('maintain', 'Consolide a carga atual', `Busque ${targetReps} repetições em todas as séries, com técnica estável e respeitando o RIR alvo.`);
  }
  if (latest.sets.some((set) => set.rir === null || set.rir === undefined)) {
    return advice('record-rir', 'Falta registrar o esforço', 'O topo das repetições foi atingido, mas falta RIR em alguma série. Sem esse dado, o app não recomenda aumentar a carga.');
  }
  const minimumRir = exercise.targetRirMin ?? 2;
  if (latest.sets.some((set) => set.rir! < minimumRir)) {
    return advice('maintain', 'Mantenha a carga por enquanto', `Alguma série ficou abaixo do RIR ${minimumRir}. Consolide as repetições com mais reserva antes de subir.`);
  }

  const currentWeight = Math.min(...latest.sets.map((set) => set.weight!));
  if (latest.sets.some((set) => Math.abs(set.weight! - currentWeight) > 0.01)) {
    return advice('maintain', 'Compare séries equivalentes', 'A última sessão teve cargas diferentes entre séries. Ajuste cada série manualmente; não há aumento único confiável.');
  }
  const steps = unit === 'lb' ? [0.5, 1, 2.5, 5, 10].map((step) => step / 2.2046226218) : [0.25, 0.5, 1, 1.25, 2.5, 5];
  const increment = exercise.loadIncrementKg ?? steps.filter((step) => step <= currentWeight * 0.05 + 0.00001).at(-1);
  if (!increment || increment <= 0 || increment > currentWeight * 0.05 + 0.00001) {
    return advice('adjust-step', 'O incremento precisa ser menor', 'O próximo incremento ultrapassa 5% da carga. Configure um passo menor na ficha, se o equipamento permitir, ou mantenha a carga.');
  }
  const suggestion: LoadSuggestion = {
    currentWeight,
    suggestedWeight: roundStoredWeight(currentWeight + increment),
    increment: roundStoredWeight(increment),
    targetReps,
    basedOn: latest.exerciseName,
    percentage: Math.round(increment / currentWeight * 1000) / 10,
  };
  return { kind: 'increase', title: 'Pronto para um pequeno avanço', message: `Repetições e RIR conferidos. Sugestão de +${suggestion.percentage}%: confirme o equipamento e a execução antes de aplicar.`, suggestion };
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
      const estimates = previousWeighted.map((candidate) => estimateOneRepMax(candidate.weight!, candidate.reps)).filter((value): value is number => value !== null);
      const estimate = estimateOneRepMax(set.weight, set.reps);
      if (estimate !== null && estimates.length && estimate > Math.max(...estimates) && !labels.includes('Maior carga')) labels.push('Recorde de força estimada');
    }
  }
  return labels;
}

export function estimateOneRepMax(weight: number, reps: number) {
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(reps) || reps < 1 || reps > 12) return null;
  return weight * (1 + Math.max(0, reps) / 30);
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
