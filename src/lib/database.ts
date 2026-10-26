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
import { createWeeklyWorkoutPlans, installWeeklyWorkoutPlans, STARTER_PLAN_VERSION, ELITE_PROTOCOL_VERSION, upgradeEliteProtocol } from './starterPlans';
import { isWeekKey, MAX_RECOVERY_SETS, MAX_RECOVERY_SETS_PER_EXERCISE, MAX_SAVED_RECOVERY_ITEMS } from './recovery';
import { emptyNutrition } from '../nutrition/engine';
import { validateNutrition } from '../nutrition/validation';

const DATABASE_NAME = 'meutreino';
const DATABASE_VERSION = 2;
const STATE_STORE = 'state';
const STATE_KEY = 'app-state';
const SAFETY_KEY = 'safety-checkpoint-v1';
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

const muscleGroups = new Set(['quadriceps', 'posterior', 'gluteos', 'peito', 'costas', 'ombros', 'deltoide_posterior', 'biceps', 'triceps', 'panturrilhas', 'core']);

function validateOptionalMetadata(value: Record<string, unknown>, path: string, issues: string[]) {
  if (value.loadIncrementKg !== undefined && (typeof value.loadIncrementKg !== 'number' || !Number.isFinite(value.loadIncrementKg) || value.loadIncrementKg <= 0 || value.loadIncrementKg > 100)) issues.push(`${path}.loadIncrementKg inválido`);
  if (value.trainingMode !== undefined && value.trainingMode !== 'complete' && value.trainingMode !== 'express') issues.push(`${path}.trainingMode inválido`);
  if (value.muscleGroup !== undefined && !muscleGroups.has(String(value.muscleGroup))) issues.push(`${path}.muscleGroup inválido`);
}

function validateExercise(value: unknown, path: string, issues: string[]): value is Exercise {
  if (!isRecord(value)) {
    issues.push(`${path} deve ser um objeto`);
    return false;
  }

  validateOptionalMetadata(value, path, issues);
  if (!isNonEmptyString(value.id)) issues.push(`${path}.id é obrigatório`);
  if (!isNonEmptyString(value.name)) issues.push(`${path}.name é obrigatório`);
  if (!isBoundedInteger(value.targetSets, 1, MAX_SETS_PER_EXERCISE)) issues.push(`${path}.targetSets deve estar entre 1 e ${MAX_SETS_PER_EXERCISE}`);
  if (!isBoundedInteger(value.targetReps, 1, MAX_REPS)) issues.push(`${path}.targetReps deve estar entre 1 e ${MAX_REPS}`);
  if (value.minReps !== undefined && (!isBoundedInteger(value.minReps, 1, MAX_REPS) || (typeof value.targetReps === 'number' && value.minReps > value.targetReps))) {
    issues.push(`${path}.minReps deve estar entre 1 e a meta máxima`);
  }
  if (value.targetRirMin !== undefined && !isBoundedInteger(value.targetRirMin, 0, 4)) issues.push(`${path}.targetRirMin deve estar entre 0 e 4`);
  if (value.targetRirMax !== undefined && (!isBoundedInteger(value.targetRirMax, 0, 4) || (typeof value.targetRirMin === 'number' && value.targetRirMax < value.targetRirMin))) {
    issues.push(`${path}.targetRirMax deve ser válido e maior ou igual ao mínimo`);
  }
  if (value.muscleGroup !== undefined && !['quadriceps', 'posterior', 'gluteos', 'peito', 'costas', 'ombros', 'deltoide_posterior', 'biceps', 'triceps', 'panturrilhas', 'core'].includes(String(value.muscleGroup))) {
    issues.push(`${path}.muscleGroup não reconhecido`);
  }
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

  validateOptionalMetadata(value, path, issues);
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

  validateOptionalMetadata(value, path, issues);
  if (value.recoveryWeekStart !== undefined && !isWeekKey(value.recoveryWeekStart)) issues.push(`${path}.recoveryWeekStart inválido`);
  if (value.recoverySourcePlanIds !== undefined && (!isWeekKey(value.recoveryWeekStart) || !Array.isArray(value.recoverySourcePlanIds)
    || value.recoverySourcePlanIds.length > MAX_EXERCISES_PER_PLAN || value.recoverySourcePlanIds.some((id) => !isNonEmptyString(id)))) issues.push(`${path}.recoverySourcePlanIds inválido`);
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

  validateOptionalMetadata(value, path, issues);
  if (value.recoveryItemIds !== undefined && (!Array.isArray(value.recoveryItemIds) || !value.recoveryItemIds.length
    || value.recoveryItemIds.length > MAX_EXERCISES_PER_PLAN || value.recoveryItemIds.some((id) => !isNonEmptyString(id))
    || new Set(value.recoveryItemIds).size !== value.recoveryItemIds.length)) issues.push(`${path}.recoveryItemIds inválido`);
  if ((value.recoveryItemIds !== undefined) !== (value.recoveryWeekStart !== undefined)
    || value.recoveryWeekStart !== undefined && !isWeekKey(value.recoveryWeekStart)) issues.push(`${path}.recoveryWeekStart inválido`);
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
      validateOptionalMetadata(exercise, exercisePath, issues);
      if (!isNonEmptyString(exercise.exerciseId)) issues.push(`${exercisePath}.exerciseId é obrigatório`);
      if (!isNonEmptyString(exercise.exerciseName)) issues.push(`${exercisePath}.exerciseName é obrigatório`);
      if (exercise.sourceExerciseId !== undefined && !isNonEmptyString(exercise.sourceExerciseId)) issues.push(`${exercisePath}.sourceExerciseId inválido`);
      if (!isBoundedInteger(exercise.restSeconds, 0, MAX_REST_SECONDS)) issues.push(`${exercisePath}.restSeconds deve estar entre 0 e ${MAX_REST_SECONDS}`);
      if (exercise.minReps !== undefined && !isBoundedInteger(exercise.minReps, 1, MAX_REPS)) issues.push(`${exercisePath}.minReps inválido`);
      if (exercise.targetRirMin !== undefined && !isBoundedInteger(exercise.targetRirMin, 0, 4)) issues.push(`${exercisePath}.targetRirMin inválido`);
      if (exercise.targetRirMax !== undefined && (!isBoundedInteger(exercise.targetRirMax, 0, 4) || (typeof exercise.targetRirMin === 'number' && exercise.targetRirMax < exercise.targetRirMin))) issues.push(`${exercisePath}.targetRirMax inválido`);
      if (exercise.muscleGroup !== undefined && !['quadriceps', 'posterior', 'gluteos', 'peito', 'costas', 'ombros', 'deltoide_posterior', 'biceps', 'triceps', 'panturrilhas', 'core'].includes(String(exercise.muscleGroup))) issues.push(`${exercisePath}.muscleGroup inválido`);
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
        if (set.recoveryItemId !== undefined && !isNonEmptyString(set.recoveryItemId)) issues.push(`${setPath}.recoveryItemId inválido`);
        if (set.recoverySetId !== undefined && !isNonEmptyString(set.recoverySetId)) issues.push(`${setPath}.recoverySetId inválido`);
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
  if (value.reduceMotion !== undefined && typeof value.reduceMotion !== 'boolean') issues.push(`${path}.reduceMotion inválido`);
  if (value.weeklyPlanModes !== undefined && (!isRecord(value.weeklyPlanModes)
    || Object.keys(value.weeklyPlanModes).length > 200
    || Object.values(value.weeklyPlanModes).some((mode) => mode !== 'complete' && mode !== 'express'))) issues.push(`${path}.weeklyPlanModes inválido`);
  return true;
}

function validateRecoveryState(value: Record<string, unknown>, issues: string[]) {
  const items: Record<string, unknown>[] = [];
  const itemIds = new Set<string>();
  const setIds = new Set<string>();
  if (value.recoveryItems !== undefined) {
    if (!Array.isArray(value.recoveryItems) || value.recoveryItems.length > MAX_SAVED_RECOVERY_ITEMS) issues.push('recoveryItems excede o limite ou não é lista');
    else value.recoveryItems.forEach((item, index) => {
      const path = `recoveryItems[${index}]`;
      if (!isRecord(item)) { issues.push(`${path} inválido`); return; }
      items.push(item);
      if (!isNonEmptyString(item.id) || itemIds.has(item.id)) issues.push(`${path}.id inválido ou repetido`);
      else itemIds.add(item.id);
      if (!isNonEmptyString(item.sourceWorkoutId)) issues.push(`${path}.sourceWorkoutId inválido`);
      if (item.sourcePlanId !== undefined && !isNonEmptyString(item.sourcePlanId)) issues.push(`${path}.sourcePlanId inválido`);
      if (!isNonEmptyString(item.sourcePlanName)) issues.push(`${path}.sourcePlanName inválido`);
      if (!isWeekKey(item.weekStart)) issues.push(`${path}.weekStart inválido`);
      if (!isIsoDate(item.savedAt)) issues.push(`${path}.savedAt inválido`);
      validateActiveWorkout({ id: 'snapshot', planId: null, planName: 'Pendência', startedAt: item.savedAt, updatedAt: item.savedAt,
        currentExerciseIndex: 0, currentSetIndex: 0, restStartedAt: null, restEndsAt: null, restDurationSeconds: null, exercises: [item.exercise],
      }, path, issues);
      if (isRecord(item.exercise)) {
        if (item.exercise.sourceExerciseId !== undefined) issues.push(`${path} deve guardar a identidade original`);
        if (Array.isArray(item.exercise.sets)) for (const set of item.exercise.sets) {
          if (!isRecord(set)) continue;
          if (set.completed !== false || set.completedAt !== null || set.recoveryItemId !== undefined || set.recoverySetId !== undefined) issues.push(`${path} contém série concluída ou com origem aninhada`);
          if (typeof set.id === 'string') {
            if (setIds.has(set.id)) issues.push(`${path} contém série duplicada na fila`);
            setIds.add(set.id);
          }
        }
      }
    });
  }
  if (value.queuedMissedPlans !== undefined && (!Array.isArray(value.queuedMissedPlans) || value.queuedMissedPlans.length > 5000
    || value.queuedMissedPlans.some((key) => typeof key !== 'string' || !isWeekKey(key.slice(0, 10)) || key.slice(10, 12) !== '::' || !key.slice(12).trim())
    || new Set(value.queuedMissedPlans).size !== value.queuedMissedPlans.length)) issues.push('queuedMissedPlans inválido');
  const active = value.activeWorkout;
  if (!isRecord(active) || !Array.isArray(active.exercises)) return;
  const activeExercises = active.exercises;
  const reserved = Array.isArray(active.recoveryItemIds) ? active.recoveryItemIds : [];
  const seen = new Set<string>();
  const activeIds = new Set<string>();
  const exerciseIds = new Set<string>();
  const perExercise = new Map<string, number>();
  let count = 0;
  for (const exercise of activeExercises) {
    if (!isRecord(exercise) || !Array.isArray(exercise.sets)) continue;
    if (active.recoveryItemIds !== undefined && exerciseIds.has(String(exercise.exerciseId))) issues.push('Reposição contém identidade de exercício duplicada');
    exerciseIds.add(String(exercise.exerciseId));
    for (const set of exercise.sets) {
      if (!isRecord(set)) continue;
      if (active.recoveryItemIds === undefined) {
        if (set.recoveryItemId !== undefined || set.recoverySetId !== undefined || exercise.sourceExerciseId !== undefined) issues.push('Sessão comum contém origem de reposição');
        continue;
      }
      if (set.completed && (set.reps === 0 || !isIsoDate(set.completedAt))) issues.push('Reposição contém conclusão inválida');
      count += 1;
      const item = items.find((candidate) => candidate.id === set.recoveryItemId);
      const original = item && isRecord(item.exercise) ? item.exercise : null;
      const sourceSets = original && Array.isArray(original.sets) ? original.sets : [];
      const sourceSet = sourceSets.find((source) => isRecord(source) && source.id === set.recoverySetId);
      if (!item || !reserved.includes(item.id) || item.weekStart !== active.recoveryWeekStart || !original
        || exercise.sourceExerciseId !== original.exerciseId || exercise.exerciseName !== original.exerciseName
        || exercise.muscleGroup !== original.muscleGroup || !isRecord(sourceSet)
        || set.setNumber !== sourceSet.setNumber || set.targetReps !== sourceSet.targetReps) issues.push('Reposição sem correspondência na fila');
      const origin = `${String(set.recoveryItemId)}::${String(set.recoverySetId)}`;
      if (seen.has(origin) || activeIds.has(String(set.id))) issues.push('Reposição contém série duplicada');
      seen.add(origin); activeIds.add(String(set.id));
      const key = `${String(exercise.sourceExerciseId)}::${String(exercise.exerciseName)}`;
      perExercise.set(key, (perExercise.get(key) ?? 0) + 1);
    }
  }
  if (active.recoveryItemIds !== undefined && (active.planId !== null || count < 1 || count > MAX_RECOVERY_SETS
    || [...perExercise.values()].some((number) => number > MAX_RECOVERY_SETS_PER_EXERCISE)
    || reserved.some((id) => !activeExercises.some((exercise) => isRecord(exercise) && Array.isArray(exercise.sets)
      && exercise.sets.some((set) => isRecord(set) && set.recoveryItemId === id))))) issues.push('Reserva de reposição inválida');
}

export function validateAppState(value: unknown): AppState {
  const issues: string[] = [];
  if (!isRecord(value)) throw new DatabaseValidationError(['o estado deve ser um objeto']);

  if (value.schemaVersion !== APP_STATE_SCHEMA_VERSION) {
    issues.push(`schemaVersion incompatível (esperado ${APP_STATE_SCHEMA_VERSION})`);
  }
  if (
    value.starterPlanVersion !== undefined
    && (!isNonNegativeInteger(value.starterPlanVersion) || value.starterPlanVersion > STARTER_PLAN_VERSION)
  ) {
    issues.push(`starterPlanVersion incompatível (máximo ${STARTER_PLAN_VERSION})`);
  }
  if (value.eliteProtocolVersion !== undefined
    && (!isNonNegativeInteger(value.eliteProtocolVersion) || value.eliteProtocolVersion > ELITE_PROTOCOL_VERSION)) {
    issues.push(`eliteProtocolVersion incompatível (máximo ${ELITE_PROTOCOL_VERSION})`);
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
  validateRecoveryState(value, issues);
  validatePreferences(value.preferences, 'preferences', issues);
  if (value.nutrition !== undefined) {
    try { validateNutrition(value.nutrition); } catch (cause) { issues.push(cause instanceof Error ? cause.message : 'Alimentação inválida'); }
  }
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
    eliteProtocolVersion: ELITE_PROTOCOL_VERSION,
    plans: createWeeklyWorkoutPlans(now),
    history: [],
    nutrition: emptyNutrition(),
    recoveryItems: [],
    queuedMissedPlans: [],
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

function writeRecord(database: IDBDatabase, state: AppState, checkpointLabel?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STATE_STORE, 'readwrite');
    const store = transaction.objectStore(STATE_STORE);
    const put = () => store.put({ id: STATE_KEY, value: state } satisfies StoredStateRecord);
    if (checkpointLabel) {
      const previous = store.get(STATE_KEY);
      previous.onsuccess = () => {
        const record = previous.result as StoredStateRecord | undefined;
        if (record) store.put({ id: SAFETY_KEY, value: record.value, label: checkpointLabel, createdAt: new Date().toISOString() });
        put();
      };
    } else put();
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
      let upgraded = upgradeEliteProtocol(installWeeklyWorkoutPlans(validated));
      if (upgraded.nutrition === undefined) {
        upgraded = { ...upgraded, nutrition: emptyNutrition() };
      }
      if (upgraded !== validated) await writeRecord(database, upgraded, validated.nutrition === undefined ? 'Antes de ativar Alimentação v1' : 'Antes da atualização das fichas');
      return cloneState(upgraded);
    }

    const seeded = { ...createSeedState(), nutrition: emptyNutrition() };
    await writeRecord(database, seeded);
    return cloneState(seeded);
  } finally {
    database.close();
  }
}

export async function saveState(state: AppState, checkpointLabel?: string): Promise<AppState> {
  const timestamp = new Date().toISOString();
  const validated = validateAppState({ ...state, updatedAt: timestamp });
  const next = cloneState(installWeeklyWorkoutPlans(validated, timestamp));
  const database = await openDatabase();
  try {
    await writeRecord(database, next, checkpointLabel);
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

  let imported = validateAppState(candidate);
  // A training-only legacy backup must not silently erase the newer nutrition journal.
  if (imported.nutrition === undefined) {
    const existing = await loadState();
    imported = { ...imported, nutrition: existing.nutrition ?? emptyNutrition() };
  }
  return saveState(imported, 'Antes da importação ou troca de protocolo');
}

export async function readSafetySnapshot(): Promise<{ value: AppState; label: string; createdAt: string } | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STATE_STORE, 'readonly').objectStore(STATE_STORE).get(SAFETY_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally { database.close(); }
}

export async function exportSafetySnapshot(): Promise<string> {
  const checkpoint = await readSafetySnapshot();
  if (!checkpoint) throw new Error('Nenhuma cópia de segurança local está disponível.');
  return JSON.stringify({ app: 'MeuTreino', backupVersion: BACKUP_VERSION, exportedAt: checkpoint.createdAt, state: validateAppState(checkpoint.value) } satisfies AppStateBackup, null, 2);
}

export async function clearSafetySnapshot(): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STATE_STORE, 'readwrite');
      transaction.objectStore(STATE_STORE).delete(SAFETY_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

export const workoutDatabase = {
  load: loadState,
  save: saveState,
  reset: resetState,
  export: exportState,
  import: importState,
} as const;
