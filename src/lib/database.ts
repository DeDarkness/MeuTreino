import {
  APP_STATE_SCHEMA_VERSION,
  type ActiveWorkout,
  type AppState,
  type AppStateBackup,
  type Exercise,
  type Preferences,
  type WorkoutExerciseHistory,
  type WorkoutHistory,
  type WorkoutPlan,
  type WorkoutSetHistory,
  type WallpaperAsset,
} from '../types';
import { createWeeklyWorkoutPlans, installWeeklyWorkoutPlans, STARTER_PLAN_VERSION } from './starterPlans';

const DATABASE_NAME = 'meutreino';
const DATABASE_VERSION = 2;
const STATE_STORE = 'state';
const STATE_KEY = 'app-state';
const WALLPAPER_STORE = 'wallpaper';
const WALLPAPER_KEY = 'active-wallpaper' as const;
const BACKUP_VERSION = 1 as const;
const MAX_EXERCISES_PER_PLAN = 20;
const MAX_SETS_PER_EXERCISE = 20;
const MAX_REPS = 9999;
const MAX_REST_SECONDS = 3600;
const MAX_WEIGHT = 100000;
const MAX_WALLPAPER_BYTES = 150 * 1024 * 1024;

type StoredStateRecord = {
  id: typeof STATE_KEY;
  value: AppState;
};

export class DatabaseValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Dados do MeuTreino inválidos: ${issues.join('; ')}`);
    this.name = 'DatabaseValidationError';
    this.issues = issues;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

const isWeight = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_WEIGHT);

const isBoundedInteger = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

function validateExercise(value: unknown, path: string, issues: string[]): value is Exercise {
  if (!isRecord(value)) {
    issues.push(`${path} deve ser um objeto`);
    return false;
  }

  if (!isNonEmptyString(value.id)) issues.push(`${path}.id é obrigatório`);
  if (!isNonEmptyString(value.name)) issues.push(`${path}.name é obrigatório`);
  if (!isBoundedInteger(value.targetSets, 1, MAX_SETS_PER_EXERCISE)) issues.push(`${path}.targetSets deve estar entre 1 e ${MAX_SETS_PER_EXERCISE}`);
  if (!isBoundedInteger(value.targetReps, 1, MAX_REPS)) issues.push(`${path}.targetReps deve estar entre 1 e ${MAX_REPS}`);
  if (!isBoundedInteger(value.restSeconds, 0, MAX_REST_SECONDS)) issues.push(`${path}.restSeconds deve estar entre 0 e ${MAX_REST_SECONDS}`);
  if (isNonEmptyString(value.name) && value.name.length > 120) issues.push(`${path}.name é muito longo`);
  if (value.notes !== undefined && typeof value.notes !== 'string') issues.push(`${path}.notes deve ser texto`);
  if (value.supersetGroup !== undefined && (typeof value.supersetGroup !== 'string' || value.supersetGroup.length > 12)) {
    issues.push(`${path}.supersetGroup deve ser um texto curto`);
  }
  return true;
}

function validatePlan(value: unknown, path: string, issues: string[]): value is WorkoutPlan {
  if (!isRecord(value)) {
    issues.push(`${path} deve ser um objeto`);
    return false;
  }

  if (!isNonEmptyString(value.id)) issues.push(`${path}.id é obrigatório`);
  if (!isNonEmptyString(value.name)) issues.push(`${path}.name é obrigatório`);
  if (!Array.isArray(value.exercises)) {
    issues.push(`${path}.exercises deve ser uma lista`);
  } else {
    if (value.exercises.length === 0 || value.exercises.length > MAX_EXERCISES_PER_PLAN) {
      issues.push(`${path}.exercises deve ter entre 1 e ${MAX_EXERCISES_PER_PLAN} itens`);
    }
    value.exercises.forEach((exercise, index) => validateExercise(exercise, `${path}.exercises[${index}]`, issues));
  }
  if (!isIsoDate(value.createdAt)) issues.push(`${path}.createdAt deve ser uma data válida`);
  if (!isIsoDate(value.updatedAt)) issues.push(`${path}.updatedAt deve ser uma data válida`);
  if (value.notes !== undefined && typeof value.notes !== 'string') issues.push(`${path}.notes deve ser texto`);
  return true;
}

function validateHistorySet(value: unknown, path: string, issues: string[]): value is WorkoutSetHistory {
  if (!isRecord(value)) {
    issues.push(`${path} deve ser um objeto`);
    return false;
  }

  if (!isNonEmptyString(value.id)) issues.push(`${path}.id é obrigatório`);
  if (!isPositiveInteger(value.setNumber)) issues.push(`${path}.setNumber deve ser maior que zero`);
  if (!isNonNegativeInteger(value.reps)) issues.push(`${path}.reps deve ser um inteiro não negativo`);
  if (!isWeight(value.weight)) issues.push(`${path}.weight deve ser nulo ou um número não negativo`);
  if (!isIsoDate(value.completedAt)) issues.push(`${path}.completedAt deve ser uma data válida`);
  if (value.rir !== undefined && value.rir !== null && !isBoundedInteger(value.rir, 0, 4)) {
    issues.push(`${path}.rir deve estar entre 0 e 4`);
  }
  return true;
}

function validateHistoryExercise(
  value: unknown,
  path: string,
  issues: string[],
): value is WorkoutExerciseHistory {
  if (!isRecord(value)) {
    issues.push(`${path} deve ser um objeto`);
    return false;
  }

  if (!isNonEmptyString(value.exerciseId)) issues.push(`${path}.exerciseId é obrigatório`);
  if (!isNonEmptyString(value.exerciseName)) issues.push(`${path}.exerciseName é obrigatório`);
  if (!Array.isArray(value.sets)) {
    issues.push(`${path}.sets deve ser uma lista`);
  } else {
    value.sets.forEach((set, index) => validateHistorySet(set, `${path}.sets[${index}]`, issues));
  }
  return true;
}

function validateHistory(value: unknown, path: string, issues: string[]): value is WorkoutHistory {
  if (!isRecord(value)) {
    issues.push(`${path} deve ser um objeto`);
    return false;
  }

  if (!isNonEmptyString(value.id)) issues.push(`${path}.id é obrigatório`);
  if (value.planId !== null && !isNonEmptyString(value.planId)) issues.push(`${path}.planId deve ser nulo ou texto`);
  if (!isNonEmptyString(value.planName)) issues.push(`${path}.planName é obrigatório`);
  if (!isIsoDate(value.startedAt)) issues.push(`${path}.startedAt deve ser uma data válida`);
  if (!isIsoDate(value.finishedAt)) issues.push(`${path}.finishedAt deve ser uma data válida`);
  if (!isNonNegativeInteger(value.durationSeconds)) issues.push(`${path}.durationSeconds deve ser um inteiro não negativo`);
  if (!Array.isArray(value.exercises)) {
    issues.push(`${path}.exercises deve ser uma lista`);
  } else {
    value.exercises.forEach((exercise, index) =>
      validateHistoryExercise(exercise, `${path}.exercises[${index}]`, issues));
  }
  if (value.notes !== undefined && typeof value.notes !== 'string') issues.push(`${path}.notes deve ser texto`);
  return true;
}

function validateActiveWorkout(value: unknown, path: string, issues: string[]): value is ActiveWorkout {
  if (!isRecord(value)) {
    issues.push(`${path} deve ser um objeto`);
    return false;
  }

  if (!isNonEmptyString(value.id)) issues.push(`${path}.id é obrigatório`);
  if (value.planId !== null && !isNonEmptyString(value.planId)) issues.push(`${path}.planId deve ser nulo ou texto`);
  if (!isNonEmptyString(value.planName)) issues.push(`${path}.planName é obrigatório`);
  if (!isIsoDate(value.startedAt)) issues.push(`${path}.startedAt deve ser uma data válida`);
  if (!isIsoDate(value.updatedAt)) issues.push(`${path}.updatedAt deve ser uma data válida`);
  if (!isNonNegativeInteger(value.currentExerciseIndex)) issues.push(`${path}.currentExerciseIndex deve ser um inteiro não negativo`);
  if (!isNonNegativeInteger(value.currentSetIndex)) issues.push(`${path}.currentSetIndex deve ser um inteiro não negativo`);
  if (value.restStartedAt !== null && !isIsoDate(value.restStartedAt)) issues.push(`${path}.restStartedAt deve ser nulo ou uma data válida`);
  if (value.restEndsAt !== null && !isIsoDate(value.restEndsAt)) issues.push(`${path}.restEndsAt deve ser nulo ou uma data válida`);
  if (value.restDurationSeconds !== null && !isNonNegativeInteger(value.restDurationSeconds)) {
    issues.push(`${path}.restDurationSeconds deve ser nulo ou um inteiro não negativo`);
  }

  if (!Array.isArray(value.exercises)) {
    issues.push(`${path}.exercises deve ser uma lista`);
  } else {
    if (value.exercises.length === 0 || value.exercises.length > MAX_EXERCISES_PER_PLAN) {
      issues.push(`${path}.exercises deve ter entre 1 e ${MAX_EXERCISES_PER_PLAN} itens`);
    }
    value.exercises.forEach((exercise, exerciseIndex) => {
      const exercisePath = `${path}.exercises[${exerciseIndex}]`;
      if (!isRecord(exercise)) {
        issues.push(`${exercisePath} deve ser um objeto`);
        return;
      }
      if (!isNonEmptyString(exercise.exerciseId)) issues.push(`${exercisePath}.exerciseId é obrigatório`);
      if (!isNonEmptyString(exercise.exerciseName)) issues.push(`${exercisePath}.exerciseName é obrigatório`);
      if (!isBoundedInteger(exercise.restSeconds, 0, MAX_REST_SECONDS)) issues.push(`${exercisePath}.restSeconds deve estar entre 0 e ${MAX_REST_SECONDS}`);
      if (exercise.notes !== undefined && typeof exercise.notes !== 'string') issues.push(`${exercisePath}.notes deve ser texto`);
      if (exercise.supersetGroup !== undefined && (typeof exercise.supersetGroup !== 'string' || exercise.supersetGroup.length > 12)) {
        issues.push(`${exercisePath}.supersetGroup deve ser um texto curto`);
      }
      if (exercise.skipped !== undefined && typeof exercise.skipped !== 'boolean') issues.push(`${exercisePath}.skipped deve ser booleano`);
      if (!Array.isArray(exercise.sets)) {
        issues.push(`${exercisePath}.sets deve ser uma lista`);
        return;
      }
      if (exercise.sets.length === 0 || exercise.sets.length > MAX_SETS_PER_EXERCISE) {
        issues.push(`${exercisePath}.sets deve ter entre 1 e ${MAX_SETS_PER_EXERCISE} itens`);
      }
      exercise.sets.forEach((set, setIndex) => {
        const setPath = `${exercisePath}.sets[${setIndex}]`;
        if (!isRecord(set)) {
          issues.push(`${setPath} deve ser um objeto`);
          return;
        }
        if (!isNonEmptyString(set.id)) issues.push(`${setPath}.id é obrigatório`);
        if (!isPositiveInteger(set.setNumber)) issues.push(`${setPath}.setNumber deve ser maior que zero`);
        if (!isBoundedInteger(set.targetReps, 1, MAX_REPS)) issues.push(`${setPath}.targetReps deve estar entre 1 e ${MAX_REPS}`);
        if (!isBoundedInteger(set.reps, 0, MAX_REPS)) issues.push(`${setPath}.reps deve estar entre 0 e ${MAX_REPS}`);
        if (!isWeight(set.weight)) issues.push(`${setPath}.weight deve ser nulo ou um número não negativo`);
        if (typeof set.completed !== 'boolean') issues.push(`${setPath}.completed deve ser booleano`);
        if (set.completedAt !== null && !isIsoDate(set.completedAt)) issues.push(`${setPath}.completedAt deve ser nulo ou uma data válida`);
        if (set.rir !== undefined && set.rir !== null && !isBoundedInteger(set.rir, 0, 4)) {
          issues.push(`${setPath}.rir deve estar entre 0 e 4`);
        }
      });
    });

    if (isNonNegativeInteger(value.currentExerciseIndex) && value.currentExerciseIndex >= value.exercises.length) {
      issues.push(`${path}.currentExerciseIndex está fora dos limites`);
    } else if (isNonNegativeInteger(value.currentExerciseIndex)) {
      const currentExercise = value.exercises[value.currentExerciseIndex];
      if (isRecord(currentExercise) && Array.isArray(currentExercise.sets) &&
          isNonNegativeInteger(value.currentSetIndex) && value.currentSetIndex >= currentExercise.sets.length) {
        issues.push(`${path}.currentSetIndex está fora dos limites`);
      }
    }
  }
  if (value.notes !== undefined && typeof value.notes !== 'string') issues.push(`${path}.notes deve ser texto`);
  return true;
}

function validatePreferences(value: unknown, path: string, issues: string[]): value is Preferences {
  if (!isRecord(value)) {
    issues.push(`${path} deve ser um objeto`);
    return false;
  }

  if (!isBoundedInteger(value.defaultRestSeconds, 0, MAX_REST_SECONDS)) issues.push(`${path}.defaultRestSeconds deve estar entre 0 e ${MAX_REST_SECONDS}`);
  if (typeof value.soundEnabled !== 'boolean') issues.push(`${path}.soundEnabled deve ser booleano`);
  if (typeof value.vibrationEnabled !== 'boolean') issues.push(`${path}.vibrationEnabled deve ser booleano`);
  if (value.restAlertSound !== 'bell' && value.restAlertSound !== 'beep') issues.push(`${path}.restAlertSound é inválido`);
  if (value.weightUnit !== 'kg' && value.weightUnit !== 'lb') issues.push(`${path}.weightUnit é inválido`);
  return true;
}

export function validateAppState(value: unknown): AppState {
  const issues: string[] = [];
  if (!isRecord(value)) throw new DatabaseValidationError(['o estado deve ser um objeto']);

  if (value.schemaVersion !== APP_STATE_SCHEMA_VERSION) {
    issues.push(`schemaVersion incompatível (esperado ${APP_STATE_SCHEMA_VERSION})`);
  }
  if (value.starterPlanVersion !== undefined && value.starterPlanVersion !== STARTER_PLAN_VERSION) {
    issues.push(`starterPlanVersion incompatível (esperado ${STARTER_PLAN_VERSION})`);
  }
  if (!Array.isArray(value.plans)) {
    issues.push('plans deve ser uma lista');
  } else {
    value.plans.forEach((plan, index) => validatePlan(plan, `plans[${index}]`, issues));
  }
  if (!Array.isArray(value.history)) {
    issues.push('history deve ser uma lista');
  } else {
    value.history.forEach((history, index) => validateHistory(history, `history[${index}]`, issues));
  }
  if (value.activeWorkout !== null) validateActiveWorkout(value.activeWorkout, 'activeWorkout', issues);
  validatePreferences(value.preferences, 'preferences', issues);
  if (!isIsoDate(value.updatedAt)) issues.push('updatedAt deve ser uma data válida');

  if (issues.length > 0) throw new DatabaseValidationError(issues);
  return value as unknown as AppState;
}

function cloneState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState;
}

export function createSeedState(now = new Date().toISOString()): AppState {
  return {
    schemaVersion: APP_STATE_SCHEMA_VERSION,
    starterPlanVersion: STARTER_PLAN_VERSION,
    plans: createWeeklyWorkoutPlans(now),
    history: [],
    activeWorkout: null,
    preferences: {
      defaultRestSeconds: 90,
      soundEnabled: true,
      vibrationEnabled: true,
      restAlertSound: 'bell',
      weightUnit: 'kg',
    },
    updatedAt: now,
  };
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB não está disponível neste navegador.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STATE_STORE)) {
        database.createObjectStore(STATE_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(WALLPAPER_STORE)) {
        database.createObjectStore(WALLPAPER_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o banco local.'));
    request.onblocked = () => reject(new Error('Feche outras abas do MeuTreino para atualizar o banco local.'));
  });
}

function readRecord(database: IDBDatabase): Promise<StoredStateRecord | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STATE_STORE, 'readonly');
    const request = transaction.objectStore(STATE_STORE).get(STATE_KEY);
    request.onsuccess = () => resolve(request.result as StoredStateRecord | undefined);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível ler os dados locais.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('A leitura dos dados locais foi cancelada.'));
  });
}

function writeRecord(database: IDBDatabase, state: AppState): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STATE_STORE, 'readwrite');
    transaction.objectStore(STATE_STORE).put({ id: STATE_KEY, value: state } satisfies StoredStateRecord);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Não foi possível salvar os dados locais.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('A gravação dos dados locais foi cancelada.'));
  });
}

function wallpaperKind(file: File): WallpaperAsset['kind'] | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (/\.(jpe?g|png|gif|webp|avif|heic)$/i.test(file.name)) return 'image';
  if (/\.(mp4|mov|m4v|webm)$/i.test(file.name)) return 'video';
  return null;
}

export async function loadWallpaper(): Promise<WallpaperAsset | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(WALLPAPER_STORE, 'readonly');
      const request = transaction.objectStore(WALLPAPER_STORE).get(WALLPAPER_KEY);
      request.onsuccess = () => resolve((request.result as WallpaperAsset | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o wallpaper.'));
    });
  } finally {
    database.close();
  }
}

export async function saveWallpaper(file: File): Promise<WallpaperAsset> {
  const kind = wallpaperKind(file);
  if (!kind) throw new Error('Escolha uma imagem ou um vídeo compatível.');
  if (file.size === 0) throw new Error('O arquivo escolhido está vazio.');
  if (file.size > MAX_WALLPAPER_BYTES) throw new Error('Escolha um wallpaper de até 150 MB.');

  const asset: WallpaperAsset = {
    id: WALLPAPER_KEY,
    kind,
    blob: file,
    name: file.name,
    size: file.size,
    updatedAt: new Date().toISOString(),
  };
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(WALLPAPER_STORE, 'readwrite');
      transaction.objectStore(WALLPAPER_STORE).put(asset);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Não foi possível salvar o wallpaper.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('O iPhone não conseguiu guardar este arquivo.'));
    });
    return asset;
  } finally {
    database.close();
  }
}

export async function removeWallpaper(): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(WALLPAPER_STORE, 'readwrite');
      transaction.objectStore(WALLPAPER_STORE).delete(WALLPAPER_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Não foi possível remover o wallpaper.'));
    });
  } finally {
    database.close();
  }
}

export async function loadState(): Promise<AppState> {
  const database = await openDatabase();
  try {
    const stored = await readRecord(database);
    if (stored) {
      const validated = validateAppState(stored.value);
      const upgraded = installWeeklyWorkoutPlans(validated);
      if (upgraded !== validated) await writeRecord(database, upgraded);
      return cloneState(upgraded);
    }

    const seeded = createSeedState();
    await writeRecord(database, seeded);
    return cloneState(seeded);
  } finally {
    database.close();
  }
}

export async function saveState(state: AppState): Promise<AppState> {
  const timestamp = new Date().toISOString();
  const validated = validateAppState({ ...state, updatedAt: timestamp });
  const next = cloneState(installWeeklyWorkoutPlans(validated, timestamp));
  const database = await openDatabase();
  try {
    await writeRecord(database, next);
    return cloneState(next);
  } finally {
    database.close();
  }
}

export async function resetState(): Promise<AppState> {
  const seeded = createSeedState();
  const database = await openDatabase();
  try {
    await writeRecord(database, seeded);
    return cloneState(seeded);
  } finally {
    database.close();
  }
}

export async function exportState(): Promise<string> {
  const state = await loadState();
  const backup: AppStateBackup = {
    app: 'MeuTreino',
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  };
  return JSON.stringify(backup, null, 2);
}

export async function importState(source: string | unknown): Promise<AppState> {
  let parsed: unknown = source;
  if (typeof source === 'string') {
    try {
      parsed = JSON.parse(source) as unknown;
    } catch {
      throw new DatabaseValidationError(['o arquivo não contém JSON válido']);
    }
  }

  let candidate = parsed;
  if (isRecord(parsed) && 'state' in parsed) {
    if (parsed.app !== 'MeuTreino') throw new DatabaseValidationError(['o backup não pertence ao MeuTreino']);
    if (parsed.backupVersion !== BACKUP_VERSION) throw new DatabaseValidationError(['versão de backup incompatível']);
    if (!isIsoDate(parsed.exportedAt)) throw new DatabaseValidationError(['exportedAt deve ser uma data válida']);
    candidate = parsed.state;
  }

  return saveState(validateAppState(candidate));
}

export const workoutDatabase = {
  load: loadState,
  save: saveState,
  reset: resetState,
  export: exportState,
  import: importState,
} as const;
