export const APP_DATA_SCHEMA_VERSION = 1 as const;

export type IsoDateString = string;

export interface Exercise {
  id: string;
  name: string;
  category?: string;
  notes?: string;
  defaultSets: number;
  defaultReps: number;
  defaultRestSeconds: number;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  deletedAt?: IsoDateString;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  targetSets: number;
  targetReps: number;
  restSeconds: number;
  notes?: string;
}

export interface Workout {
  id: string;
  name: string;
  notes?: string;
  exercises: WorkoutExercise[];
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  deletedAt?: IsoDateString;
}

export interface ActiveSet {
  id: string;
  setNumber: number;
  targetReps: number;
  reps: number;
  weightKg: number | null;
  completed: boolean;
  completedAt: IsoDateString | null;
  updatedAt: IsoDateString;
}

export interface ActiveExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  restSeconds: number;
  sets: ActiveSet[];
  notes?: string;
  updatedAt: IsoDateString;
}

export interface ActiveSession {
  id: string;
  workoutId: string | null;
  workoutName: string;
  startedAt: IsoDateString;
  restEndsAt: IsoDateString | null;
  /** Persisted so a running rest timer can be reconstructed after reload/sync. */
  restTotalSeconds?: number | null;
  /** Snapshot of the next set at the moment the rest period started. */
  restNextDescription?: string | null;
  exercises: ActiveExercise[];
  updatedAt: IsoDateString;
}

export interface HistoryItem {
  id: string;
  workoutId: string | null;
  workoutName: string;
  startedAt: IsoDateString;
  endedAt: IsoDateString;
  durationSeconds: number;
  totalSets: number;
  totalReps: number;
  exercises: ActiveExercise[];
  updatedAt: IsoDateString;
  deletedAt?: IsoDateString;
}

export interface AppPreferences {
  defaultRestSeconds: number;
  restSound: string;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  weightUnit: 'kg' | 'lb';
  updatedAt: IsoDateString;
}

export interface AppData {
  schemaVersion: typeof APP_DATA_SCHEMA_VERSION;
  exercises: Exercise[];
  workouts: Workout[];
  activeSession: ActiveSession | null;
  activeSessionClearedAt: IsoDateString | null;
  history: HistoryItem[];
  preferences: AppPreferences;
  updatedAt: IsoDateString;
}

type UnknownRecord = Record<string, unknown>;
type TimestampedEntity = { id: string; updatedAt: IsoDateString };

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const asOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const asNullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const asNullableDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || timestampValue(value) === 0) return null;
  return value;
};

const asOptionalDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || timestampValue(value) === 0) return undefined;
  return value;
};

const asFiniteNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asNonNegativeInteger = (value: unknown, fallback = 0): number =>
  Math.max(0, Math.trunc(asFiniteNumber(value, fallback)));

const asPositiveInteger = (value: unknown, fallback = 1): number =>
  Math.max(1, Math.trunc(asFiniteNumber(value, fallback)));

const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const timestampValue = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const latestTimestamp = (left: string, right: string): string =>
  timestampValue(left) >= timestampValue(right) ? left : right;

const canonicalTieBreaker = <T>(left: T, right: T): T =>
  JSON.stringify(left) >= JSON.stringify(right) ? left : right;

const newest = <T extends { updatedAt: string }>(left: T, right: T): T => {
  const leftTime = timestampValue(left.updatedAt);
  const rightTime = timestampValue(right.updatedAt);

  if (leftTime === rightTime) {
    return canonicalTieBreaker(left, right);
  }

  return leftTime > rightTime ? left : right;
};

const normalizeDate = (value: unknown, fallback: string): string => {
  const candidate = asString(value, fallback);
  return timestampValue(candidate) > 0 ? candidate : fallback;
};

const normalizeExercise = (value: unknown, fallbackNow: string): Exercise | null => {
  if (!isRecord(value)) return null;

  const id = asString(value.id).trim();
  const name = asString(value.name).trim();
  if (!id || !name) return null;

  const exercise: Exercise = {
    id,
    name,
    defaultSets: asPositiveInteger(value.defaultSets, 3),
    defaultReps: asPositiveInteger(value.defaultReps, 10),
    defaultRestSeconds: asNonNegativeInteger(value.defaultRestSeconds, 90),
    createdAt: normalizeDate(value.createdAt, fallbackNow),
    updatedAt: normalizeDate(value.updatedAt, fallbackNow),
  };

  const category = asOptionalString(value.category);
  const notes = asOptionalString(value.notes);
  const deletedAt = asOptionalDate(value.deletedAt);
  if (category) exercise.category = category;
  if (notes) exercise.notes = notes;
  if (deletedAt) exercise.deletedAt = deletedAt;

  return exercise;
};

const normalizeWorkoutExercise = (value: unknown): WorkoutExercise | null => {
  if (!isRecord(value)) return null;

  const id = asString(value.id).trim();
  const exerciseId = asString(value.exerciseId).trim();
  const exerciseName = asString(value.exerciseName).trim();
  if (!id || !exerciseId || !exerciseName) return null;

  const exercise: WorkoutExercise = {
    id,
    exerciseId,
    exerciseName,
    order: asNonNegativeInteger(value.order),
    targetSets: asPositiveInteger(value.targetSets, 3),
    targetReps: asPositiveInteger(value.targetReps, 10),
    restSeconds: asNonNegativeInteger(value.restSeconds, 90),
  };

  const notes = asOptionalString(value.notes);
  if (notes) exercise.notes = notes;

  return exercise;
};

const normalizeWorkout = (value: unknown, fallbackNow: string): Workout | null => {
  if (!isRecord(value)) return null;

  const id = asString(value.id).trim();
  const name = asString(value.name).trim();
  if (!id || !name) return null;

  const exercises = Array.isArray(value.exercises)
    ? value.exercises
        .map(normalizeWorkoutExercise)
        .filter((item): item is WorkoutExercise => item !== null)
        .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    : [];

  const workout: Workout = {
    id,
    name,
    exercises,
    createdAt: normalizeDate(value.createdAt, fallbackNow),
    updatedAt: normalizeDate(value.updatedAt, fallbackNow),
  };

  const notes = asOptionalString(value.notes);
  const deletedAt = asOptionalDate(value.deletedAt);
  if (notes) workout.notes = notes;
  if (deletedAt) workout.deletedAt = deletedAt;

  return workout;
};

const normalizeActiveSet = (value: unknown, fallbackNow: string): ActiveSet | null => {
  if (!isRecord(value)) return null;

  const id = asString(value.id).trim();
  if (!id) return null;

  return {
    id,
    setNumber: asPositiveInteger(value.setNumber, 1),
    targetReps: asPositiveInteger(value.targetReps, 10),
    reps: asNonNegativeInteger(value.reps),
    weightKg:
      value.weightKg === null ? null : Math.max(0, asFiniteNumber(value.weightKg, 0)),
    completed: asBoolean(value.completed),
    completedAt: asNullableDate(value.completedAt),
    updatedAt: normalizeDate(value.updatedAt, fallbackNow),
  };
};

const normalizeActiveExercise = (
  value: unknown,
  fallbackNow: string,
): ActiveExercise | null => {
  if (!isRecord(value)) return null;

  const id = asString(value.id).trim();
  const exerciseId = asString(value.exerciseId).trim();
  const exerciseName = asString(value.exerciseName).trim();
  if (!id || !exerciseId || !exerciseName) return null;

  const sets = Array.isArray(value.sets)
    ? value.sets
        .map((item) => normalizeActiveSet(item, fallbackNow))
        .filter((item): item is ActiveSet => item !== null)
        .sort(
          (left, right) => left.setNumber - right.setNumber || left.id.localeCompare(right.id),
        )
    : [];

  const exercise: ActiveExercise = {
    id,
    exerciseId,
    exerciseName,
    order: asNonNegativeInteger(value.order),
    restSeconds: asNonNegativeInteger(value.restSeconds, 90),
    sets,
    updatedAt: normalizeDate(value.updatedAt, fallbackNow),
  };

  const notes = asOptionalString(value.notes);
  if (notes) exercise.notes = notes;

  return exercise;
};

const normalizeActiveSession = (
  value: unknown,
  fallbackNow: string,
): ActiveSession | null => {
  if (!isRecord(value)) return null;

  const id = asString(value.id).trim();
  const workoutName = asString(value.workoutName).trim();
  if (!id || !workoutName) return null;

  const exercises = Array.isArray(value.exercises)
    ? value.exercises
        .map((item) => normalizeActiveExercise(item, fallbackNow))
        .filter((item): item is ActiveExercise => item !== null)
        .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    : [];

  const restEndsAt = asNullableDate(value.restEndsAt);
  const parsedRestEnd = restEndsAt ? timestampValue(restEndsAt) : 0;
  const remainingRestSeconds = parsedRestEnd
    ? Math.max(0, Math.ceil((parsedRestEnd - timestampValue(fallbackNow)) / 1000))
    : 0;
  const configuredRestSeconds = exercises.reduce(
    (maximum, exercise) => Math.max(maximum, exercise.restSeconds),
    0,
  );
  const suppliedRestTotal = asFiniteNumber(value.restTotalSeconds, 0);
  const restTotalSeconds = restEndsAt
    ? Math.max(
        1,
        Math.trunc(suppliedRestTotal),
        remainingRestSeconds,
        suppliedRestTotal > 0 ? 0 : configuredRestSeconds,
      )
    : null;
  const suppliedRestDescription = asOptionalString(value.restNextDescription)?.trim();
  const fallbackNextSet = exercises
    .flatMap((exercise) => exercise.sets.map((set) => ({ exercise, set })))
    .find(({ set }) => !set.completed);
  const restNextDescription = restEndsAt
    ? suppliedRestDescription || (fallbackNextSet
        ? `Série ${fallbackNextSet.set.setNumber} de ${fallbackNextSet.exercise.exerciseName}`
        : 'Próxima série')
    : null;

  return {
    id,
    workoutId: asNullableString(value.workoutId),
    workoutName,
    startedAt: normalizeDate(value.startedAt, fallbackNow),
    restEndsAt,
    restTotalSeconds,
    restNextDescription,
    exercises,
    updatedAt: normalizeDate(value.updatedAt, fallbackNow),
  };
};

const normalizeHistoryItem = (value: unknown, fallbackNow: string): HistoryItem | null => {
  if (!isRecord(value)) return null;

  const id = asString(value.id).trim();
  const workoutName = asString(value.workoutName).trim();
  if (!id || !workoutName) return null;

  const exercises = Array.isArray(value.exercises)
    ? value.exercises
        .map((item) => normalizeActiveExercise(item, fallbackNow))
        .filter((item): item is ActiveExercise => item !== null)
        .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    : [];

  const historyItem: HistoryItem = {
    id,
    workoutId: asNullableString(value.workoutId),
    workoutName,
    startedAt: normalizeDate(value.startedAt, fallbackNow),
    endedAt: normalizeDate(value.endedAt, fallbackNow),
    durationSeconds: asNonNegativeInteger(value.durationSeconds),
    totalSets: asNonNegativeInteger(value.totalSets),
    totalReps: asNonNegativeInteger(value.totalReps),
    exercises,
    updatedAt: normalizeDate(value.updatedAt, fallbackNow),
  };

  const deletedAt = asOptionalDate(value.deletedAt);
  if (deletedAt) historyItem.deletedAt = deletedAt;

  return historyItem;
};

const normalizePreferences = (value: unknown, fallbackNow: string): AppPreferences => {
  const record = isRecord(value) ? value : {};
  return {
    defaultRestSeconds: asNonNegativeInteger(record.defaultRestSeconds, 90),
    restSound: asString(record.restSound, 'bell') || 'bell',
    soundEnabled: asBoolean(record.soundEnabled, true),
    vibrationEnabled: asBoolean(record.vibrationEnabled, true),
    weightUnit: record.weightUnit === 'lb' ? 'lb' : 'kg',
    updatedAt: normalizeDate(record.updatedAt, fallbackNow),
  };
};

const normalizeEntityArray = <T extends TimestampedEntity>(
  value: unknown,
  normalize: (item: unknown) => T | null,
): T[] => {
  if (!Array.isArray(value)) return [];

  const unique = new Map<string, T>();
  for (const rawItem of value) {
    const item = normalize(rawItem);
    if (!item) continue;
    const current = unique.get(item.id);
    unique.set(item.id, current ? newest(current, item) : item);
  }

  return [...unique.values()].sort((left, right) => left.id.localeCompare(right.id));
};

export function createEmptyAppData(now = new Date().toISOString()): AppData {
  return {
    schemaVersion: APP_DATA_SCHEMA_VERSION,
    exercises: [],
    workouts: [],
    activeSession: null,
    activeSessionClearedAt: null,
    history: [],
    preferences: {
      defaultRestSeconds: 90,
      restSound: 'bell',
      soundEnabled: true,
      vibrationEnabled: true,
      weightUnit: 'kg',
      updatedAt: now,
    },
    updatedAt: now,
  };
}

/** Normalizes JSON read from local storage, Realtime, or the database. */
export function parseAppData(value: unknown, now = new Date().toISOString()): AppData {
  if (!isRecord(value)) return createEmptyAppData(now);

  const exercises = normalizeEntityArray(value.exercises, (item) =>
    normalizeExercise(item, now),
  );
  const workouts = normalizeEntityArray(value.workouts, (item) => normalizeWorkout(item, now));
  const history = normalizeEntityArray(value.history, (item) => normalizeHistoryItem(item, now)).sort(
    (left, right) =>
      timestampValue(right.endedAt) - timestampValue(left.endedAt) ||
      left.id.localeCompare(right.id),
  );

  const activeSessionClearedAt = asOptionalDate(value.activeSessionClearedAt) ?? null;
  const normalizedActiveSession = normalizeActiveSession(value.activeSession, now);
  const activeSession =
    normalizedActiveSession &&
    (!activeSessionClearedAt ||
      timestampValue(normalizedActiveSession.updatedAt) > timestampValue(activeSessionClearedAt))
      ? normalizedActiveSession
      : null;

  return {
    schemaVersion: APP_DATA_SCHEMA_VERSION,
    exercises,
    workouts,
    activeSession,
    activeSessionClearedAt,
    history,
    preferences: normalizePreferences(value.preferences, now),
    updatedAt: normalizeDate(value.updatedAt, now),
  };
}

const mergeEntities = <T extends TimestampedEntity>(left: T[], right: T[]): T[] => {
  const merged = new Map<string, T>();

  for (const item of [...left, ...right]) {
    const current = merged.get(item.id);
    merged.set(item.id, current ? newest(current, item) : item);
  }

  return [...merged.values()].sort((first, second) => first.id.localeCompare(second.id));
};

const mergeActiveSets = (left: ActiveSet[], right: ActiveSet[]): ActiveSet[] =>
  mergeEntities(left, right).sort(
    (first, second) => first.setNumber - second.setNumber || first.id.localeCompare(second.id),
  );

const mergeActiveExercise = (
  left: ActiveExercise,
  right: ActiveExercise,
): ActiveExercise => {
  const winningScalars = newest(left, right);
  return {
    ...winningScalars,
    sets: mergeActiveSets(left.sets, right.sets),
    updatedAt: latestTimestamp(left.updatedAt, right.updatedAt),
  };
};

const mergeActiveExercises = (
  left: ActiveExercise[],
  right: ActiveExercise[],
): ActiveExercise[] => {
  const merged = new Map<string, ActiveExercise>();

  for (const item of [...left, ...right]) {
    const current = merged.get(item.id);
    merged.set(item.id, current ? mergeActiveExercise(current, item) : item);
  }

  return [...merged.values()].sort(
    (first, second) => first.order - second.order || first.id.localeCompare(second.id),
  );
};

const mergeActiveSession = (
  left: ActiveSession | null,
  right: ActiveSession | null,
): ActiveSession | null => {
  if (!left) return right;
  if (!right) return left;
  if (left.id !== right.id) return newest(left, right);

  const winningScalars = newest(left, right);
  return {
    ...winningScalars,
    exercises: mergeActiveExercises(left.exercises, right.exercises),
    updatedAt: latestTimestamp(left.updatedAt, right.updatedAt),
  };
};

/**
 * Merges state from two devices. Collections merge by id, while a conflicting field
 * uses the entity's updatedAt timestamp. Equal timestamps use a deterministic tie-breaker.
 */
export function mergeAppData(
  local: AppData | null | undefined,
  remote: AppData | null | undefined,
): AppData {
  if (!local && !remote) return createEmptyAppData();
  if (!local) return parseAppData(remote);
  if (!remote) return parseAppData(local);

  const normalizedLocal = parseAppData(local);
  const normalizedRemote = parseAppData(remote);
  const preferences = newest(normalizedLocal.preferences, normalizedRemote.preferences);
  const activeSessionClearedAt =
    normalizedLocal.activeSessionClearedAt && normalizedRemote.activeSessionClearedAt
      ? latestTimestamp(
          normalizedLocal.activeSessionClearedAt,
          normalizedRemote.activeSessionClearedAt,
        )
      : normalizedLocal.activeSessionClearedAt ?? normalizedRemote.activeSessionClearedAt;

  return parseAppData({
    schemaVersion: APP_DATA_SCHEMA_VERSION,
    exercises: mergeEntities(normalizedLocal.exercises, normalizedRemote.exercises),
    workouts: mergeEntities(normalizedLocal.workouts, normalizedRemote.workouts),
    activeSession: mergeActiveSession(
      normalizedLocal.activeSession,
      normalizedRemote.activeSession,
    ),
    activeSessionClearedAt,
    history: mergeEntities(normalizedLocal.history, normalizedRemote.history),
    preferences,
    updatedAt: latestTimestamp(normalizedLocal.updatedAt, normalizedRemote.updatedAt),
  });
}

export function areAppDataEqual(left: AppData, right: AppData): boolean {
  return JSON.stringify(parseAppData(left)) === JSON.stringify(parseAppData(right));
}

export function isDeleted(entity: { deletedAt?: string }): boolean {
  return typeof entity.deletedAt === 'string';
}

export function markDeleted<T extends { updatedAt: string }>(
  entity: T,
  at = new Date().toISOString(),
): T & { deletedAt: string } {
  return { ...entity, deletedAt: at, updatedAt: at };
}

export function clearActiveSession(
  data: AppData,
  at = new Date().toISOString(),
): AppData {
  return {
    ...data,
    activeSession: null,
    activeSessionClearedAt: at,
    updatedAt: at,
  };
}
