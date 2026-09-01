import type {
  ActiveWorkout,
  ActiveWorkoutSet,
  AppState,
  Exercise,
  WorkoutHistory,
  WorkoutPlan,
} from '../types';

export type ExerciseInput = Omit<Exercise, 'id'> & { id?: string };

export interface WorkoutPlanInput {
  id?: string;
  name: string;
  notes?: string;
  exercises: ExerciseInput[];
}

export type ActiveSetPatch = Partial<Pick<ActiveWorkoutSet, 'reps' | 'weight'>>;

export function createWorkoutId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function saveWorkoutPlan(
  state: AppState,
  input: WorkoutPlanInput,
  now = new Date().toISOString(),
): { state: AppState; plan: WorkoutPlan } {
  const name = input.name.trim();
  if (!name) throw new Error('Informe o nome do treino.');
  if (input.exercises.length === 0) throw new Error('Adicione pelo menos um exercício.');

  const current = input.id ? state.plans.find((plan) => plan.id === input.id) : undefined;
  const plan: WorkoutPlan = {
    id: current?.id ?? createWorkoutId('plan'),
    name,
    exercises: input.exercises.map((exercise) => {
      const exerciseName = exercise.name.trim();
      if (!exerciseName) throw new Error('Todo exercício precisa de um nome.');
      return {
        ...exercise,
        id: exercise.id ?? createWorkoutId('exercise'),
        name: exerciseName,
      };
    }),
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  };

  const plans = current
    ? state.plans.map((item) => item.id === current.id ? plan : item)
    : [...state.plans, plan];
  return { state: { ...state, plans, updatedAt: now }, plan };
}

export function duplicateWorkoutPlan(
  state: AppState,
  planId: string,
  now = new Date().toISOString(),
): { state: AppState; plan: WorkoutPlan } {
  const source = state.plans.find((plan) => plan.id === planId);
  if (!source) throw new Error('Treino não encontrado.');

  const plan: WorkoutPlan = {
    ...source,
    id: createWorkoutId('plan'),
    name: `${source.name} (cópia)`,
    exercises: source.exercises.map((exercise) => ({
      ...exercise,
      id: createWorkoutId('exercise'),
    })),
    createdAt: now,
    updatedAt: now,
  };
  return {
    state: { ...state, plans: [...state.plans, plan], updatedAt: now },
    plan,
  };
}

function lastRecordedSets(state: AppState, exercise: Exercise) {
  const recorded = new Map<number, WorkoutHistory['exercises'][number]['sets'][number]>();
  const normalizedName = exercise.name.trim().toLocaleLowerCase('pt-BR');
  const workouts = [...state.history]
    .sort((left, right) => Date.parse(right.finishedAt) - Date.parse(left.finishedAt));

  for (const workout of workouts) {
    const match = workout.exercises.find((candidate) =>
      candidate.exerciseId === exercise.id ||
      candidate.exerciseName.trim().toLocaleLowerCase('pt-BR') === normalizedName);
    if (!match) continue;
    for (const set of match.sets) {
      if (!recorded.has(set.setNumber)) recorded.set(set.setNumber, set);
    }
    if (recorded.size >= exercise.targetSets) break;
  }

  return recorded;
}

export function startWorkoutFromPlan(
  state: AppState,
  planId: string,
  now = new Date().toISOString(),
): { state: AppState; workout: ActiveWorkout } {
  const plan = state.plans.find((item) => item.id === planId);
  if (!plan) throw new Error('Treino não encontrado.');

  const workout: ActiveWorkout = {
    id: createWorkoutId('workout'),
    planId: plan.id,
    planName: plan.name,
    startedAt: now,
    updatedAt: now,
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    restStartedAt: null,
    restEndsAt: null,
    restDurationSeconds: null,
    exercises: plan.exercises.map((exercise) => {
      const previousSets = lastRecordedSets(state, exercise);
      return {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        restSeconds: exercise.restSeconds,
        ...(exercise.notes ? { notes: exercise.notes } : {}),
        sets: Array.from({ length: exercise.targetSets }, (_, index) => {
          const setNumber = index + 1;
          const previous = previousSets.get(setNumber);
          return {
            id: createWorkoutId('set'),
            setNumber,
            targetReps: exercise.targetReps,
            reps: previous?.reps ?? exercise.targetReps,
            weight: previous?.weight ?? null,
            completed: false,
            completedAt: null,
          };
        }),
      };
    }),
  };
  return { state: { ...state, activeWorkout: workout, updatedAt: now }, workout };
}

export function updateActiveSet(
  state: AppState,
  exerciseId: string,
  setId: string,
  patch: ActiveSetPatch,
  now = new Date().toISOString(),
): AppState {
  if (!state.activeWorkout) throw new Error('Nenhum treino está em andamento.');
  if (patch.reps !== undefined && (!Number.isInteger(patch.reps) || patch.reps < 0)) {
    throw new Error('Repetições devem ser um inteiro não negativo.');
  }
  if (patch.weight !== undefined && patch.weight !== null &&
      (!Number.isFinite(patch.weight) || patch.weight < 0)) {
    throw new Error('A carga deve ser um número não negativo.');
  }

  let found = false;
  const exercises = state.activeWorkout.exercises.map((exercise) => {
    if (exercise.exerciseId !== exerciseId) return exercise;
    return {
      ...exercise,
      sets: exercise.sets.map((set) => {
        if (set.id !== setId) return set;
        found = true;
        return { ...set, ...patch };
      }),
    };
  });
  if (!found) throw new Error('Série não encontrada.');

  return {
    ...state,
    activeWorkout: { ...state.activeWorkout, exercises, updatedAt: now },
    updatedAt: now,
  };
}

function findNextPending(workout: ActiveWorkout, afterExercise: number, afterSet: number) {
  for (let exerciseIndex = afterExercise; exerciseIndex < workout.exercises.length; exerciseIndex += 1) {
    const startSet = exerciseIndex === afterExercise ? afterSet + 1 : 0;
    for (let setIndex = startSet; setIndex < workout.exercises[exerciseIndex].sets.length; setIndex += 1) {
      if (!workout.exercises[exerciseIndex].sets[setIndex].completed) {
        return { exerciseIndex, setIndex };
      }
    }
  }
  for (let exerciseIndex = 0; exerciseIndex <= afterExercise; exerciseIndex += 1) {
    const endSet = exerciseIndex === afterExercise ? afterSet : workout.exercises[exerciseIndex].sets.length;
    for (let setIndex = 0; setIndex < endSet; setIndex += 1) {
      if (!workout.exercises[exerciseIndex].sets[setIndex].completed) {
        return { exerciseIndex, setIndex };
      }
    }
  }
  return null;
}

export function completeActiveSet(
  state: AppState,
  exerciseId: string,
  setId: string,
  nowDate = new Date(),
): AppState {
  const workout = state.activeWorkout;
  if (!workout) throw new Error('Nenhum treino está em andamento.');
  const exerciseIndex = workout.exercises.findIndex((exercise) => exercise.exerciseId === exerciseId);
  const setIndex = exerciseIndex >= 0
    ? workout.exercises[exerciseIndex].sets.findIndex((set) => set.id === setId)
    : -1;
  if (exerciseIndex < 0 || setIndex < 0) throw new Error('Série não encontrada.');

  const now = nowDate.toISOString();
  const exercises = workout.exercises.map((exercise, index) => index !== exerciseIndex
    ? exercise
    : {
        ...exercise,
        sets: exercise.sets.map((set, indexInExercise) => indexInExercise !== setIndex
          ? set
          : { ...set, completed: true, completedAt: now }),
      });
  const updatedWorkout: ActiveWorkout = { ...workout, exercises, updatedAt: now };
  const next = findNextPending(updatedWorkout, exerciseIndex, setIndex);
  const restSeconds = updatedWorkout.exercises[exerciseIndex].restSeconds;

  return {
    ...state,
    activeWorkout: {
      ...updatedWorkout,
      currentExerciseIndex: next?.exerciseIndex ?? exerciseIndex,
      currentSetIndex: next?.setIndex ?? setIndex,
      restStartedAt: next && restSeconds > 0 ? now : null,
      restEndsAt: next && restSeconds > 0
        ? new Date(nowDate.getTime() + restSeconds * 1000).toISOString()
        : null,
      restDurationSeconds: next && restSeconds > 0 ? restSeconds : null,
    },
    updatedAt: now,
  };
}

export function addRestTime(state: AppState, seconds = 15, nowDate = new Date()): AppState {
  const workout = state.activeWorkout;
  if (!workout?.restEndsAt) return state;
  if (!Number.isInteger(seconds) || seconds <= 0) throw new Error('O acréscimo deve ser positivo.');
  const now = nowDate.toISOString();
  const currentEnd = Date.parse(workout.restEndsAt);
  const base = Number.isFinite(currentEnd) ? Math.max(currentEnd, nowDate.getTime()) : nowDate.getTime();
  return {
    ...state,
    activeWorkout: {
      ...workout,
      restEndsAt: new Date(base + seconds * 1000).toISOString(),
      restDurationSeconds: (workout.restDurationSeconds ?? 0) + seconds,
      updatedAt: now,
    },
    updatedAt: now,
  };
}

export function skipRest(state: AppState, now = new Date().toISOString()): AppState {
  if (!state.activeWorkout) return state;
  return {
    ...state,
    activeWorkout: {
      ...state.activeWorkout,
      restStartedAt: null,
      restEndsAt: null,
      restDurationSeconds: null,
      updatedAt: now,
    },
    updatedAt: now,
  };
}

export function finishActiveWorkout(
  state: AppState,
  nowDate = new Date(),
): { state: AppState; history: WorkoutHistory } {
  const workout = state.activeWorkout;
  if (!workout) throw new Error('Nenhum treino está em andamento.');
  const finishedAt = nowDate.toISOString();
  const startedAtMs = Date.parse(workout.startedAt);
  const history: WorkoutHistory = {
    id: createWorkoutId('history'),
    planId: workout.planId,
    planName: workout.planName,
    startedAt: workout.startedAt,
    finishedAt,
    durationSeconds: Number.isFinite(startedAtMs)
      ? Math.max(0, Math.round((nowDate.getTime() - startedAtMs) / 1000))
      : 0,
    exercises: workout.exercises
      .map((exercise) => ({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        sets: exercise.sets
          .filter((set) => set.completed)
          .map((set) => ({
            id: set.id,
            setNumber: set.setNumber,
            reps: set.reps,
            weight: set.weight,
            completedAt: set.completedAt ?? finishedAt,
          })),
      }))
      .filter((exercise) => exercise.sets.length > 0),
  };
  return {
    state: {
      ...state,
      activeWorkout: null,
      history: [history, ...state.history],
      updatedAt: finishedAt,
    },
    history,
  };
}
