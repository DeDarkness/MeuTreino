import { createId, nowIso } from '@/lib/id';
import type {
  ActiveExercise,
  ActiveSession,
  ActiveSet,
  HistoryItem,
  Workout,
} from '@/types/models';

export function createActiveSession(workout: Workout): ActiveSession {
  const timestamp = nowIso();
  return {
    id: createId('session'),
    workoutId: workout.id,
    workoutName: workout.name,
    startedAt: timestamp,
    restEndsAt: null,
    exercises: [...workout.exercises]
      .sort((a, b) => a.order - b.order)
      .map<ActiveExercise>((exercise) => ({
        id: createId('session_exercise'),
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        order: exercise.order,
        restSeconds: exercise.restSeconds,
        notes: exercise.notes,
        updatedAt: timestamp,
        sets: Array.from({ length: exercise.targetSets }, (_, index) => ({
          id: createId('set'),
          setNumber: index + 1,
          targetReps: exercise.targetReps,
          reps: exercise.targetReps,
          weightKg: null,
          completed: false,
          completedAt: null,
          updatedAt: timestamp,
        } satisfies ActiveSet)),
      })),
    updatedAt: timestamp,
  };
}

export function sessionTotalSets(session: ActiveSession): number {
  return session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}

export function sessionCompletedSets(session: ActiveSession): number {
  return session.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
    0,
  );
}

export function sessionProgress(session: ActiveSession): number {
  const total = sessionTotalSets(session);
  return total === 0 ? 0 : sessionCompletedSets(session) / total;
}

export function isSessionComplete(session: ActiveSession): boolean {
  const total = sessionTotalSets(session);
  return total > 0 && sessionCompletedSets(session) === total;
}

export function sessionDurationSeconds(session: ActiveSession, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(session.startedAt).getTime()) / 1000));
}

export function findNextPendingSet(
  session: ActiveSession,
  currentExerciseId: string,
  currentSetId: string,
): { exercise: ActiveExercise; set: ActiveSet } | null {
  const positions = [...session.exercises]
    .sort((a, b) => a.order - b.order)
    .flatMap((exercise) => exercise.sets.map((set) => ({ exercise, set })));
  const currentIndex = positions.findIndex(
    ({ exercise, set }) => exercise.id === currentExerciseId && set.id === currentSetId,
  );
  const searchOrder = [
    ...positions.slice(currentIndex + 1),
    ...positions.slice(0, Math.max(0, currentIndex)),
  ];
  return searchOrder.find(({ set }) => !set.completed) ?? null;
}

export function finishSession(session: ActiveSession, endedAt = nowIso()): HistoryItem {
  const endTime = new Date(endedAt).getTime();
  const durationSeconds = Math.max(
    0,
    Math.floor((endTime - new Date(session.startedAt).getTime()) / 1000),
  );
  const completedSets = session.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.completed);

  return {
    id: session.id,
    workoutId: session.workoutId,
    workoutName: session.workoutName,
    startedAt: session.startedAt,
    endedAt,
    durationSeconds,
    totalSets: completedSets.length,
    totalReps: completedSets.reduce((total, set) => total + set.reps, 0),
    exercises: session.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({ ...set })),
    })),
    updatedAt: endedAt,
  };
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  }
  return [minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes} min`;
  return `${safe} s`;
}

export function formatRest(seconds: number): string {
  if (seconds === 0) return 'Sem descanso';
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds} s`;
}

export function formatDate(isoDate: string, includeTime = false): string {
  const options: Intl.DateTimeFormatOptions = includeTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat('pt-BR', options).format(new Date(isoDate));
}
