import type { NutritionState } from './nutrition/types';

export const APP_STATE_SCHEMA_VERSION = 1 as const;

export type IsoDateString = string;
export type WeightUnit = 'kg' | 'lb';

/** An exercise as configured inside a reusable workout plan. */
export type MuscleGroup = 'quadriceps' | 'posterior' | 'gluteos' | 'peito' | 'costas' | 'ombros' | 'deltoide_posterior' | 'biceps' | 'triceps' | 'panturrilhas' | 'core';

export interface Exercise {
  id: string;
  name: string;
  targetSets: number;
  targetReps: number;
  /** Lower bound for the prescription (upper bound remains targetReps). */
  minReps?: number;
  /** Prescribed repetitions in reserve. This is not the actual performed RIR. */
  targetRirMin?: number;
  targetRirMax?: number;
  /** Dominant direct muscle target for volume accounting; compound overlaps excluded. */
  muscleGroup?: MuscleGroup;
  /** Smallest available load increment, always stored in kg. */
  loadIncrementKg?: number;
  restSeconds: number;
  notes?: string;
  /** Exercises sharing the same label alternate set-by-set during the workout. */
  supersetGroup?: string;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  notes?: string;
  exercises: Exercise[];
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

/** The actual repetitions and load recorded for one completed set. */
export interface WorkoutSetHistory {
  id: string;
  setNumber: number;
  reps: number;
  weight: number | null;
  completedAt: IsoDateString;
  /** Repetitions in reserve reported after the set, from 0 to 4. */
  rir?: number | null;
}

export interface WorkoutExerciseHistory {
  exerciseId: string;
  exerciseName: string;
  /** Snapshot: future plan edits must not rewrite completed muscle volume. */
  muscleGroup?: MuscleGroup;
  sets: WorkoutSetHistory[];
}

export interface WorkoutHistory {
  id: string;
  planId: string | null;
  planName: string;
  startedAt: IsoDateString;
  finishedAt: IsoDateString;
  durationSeconds: number;
  exercises: WorkoutExerciseHistory[];
  notes?: string;
  trainingMode?: 'complete' | 'express';
  recoveryWeekStart?: string;
  recoverySourcePlanIds?: string[];
}

export interface ActiveWorkoutSet {
  id: string;
  setNumber: number;
  targetReps: number;
  reps: number;
  weight: number | null;
  completed: boolean;
  completedAt: IsoDateString | null;
  rir?: number | null;
  /** Stable queue provenance; active IDs are distinct from the saved pending set. */
  recoveryItemId?: string;
  recoverySetId?: string;
}

export interface ActiveWorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  /** Recovery sessions use unique runtime IDs while retaining the original identity. */
  sourceExerciseId?: string;
  /** Structured training target copied at session start. */
  minReps?: number;
  targetRirMin?: number;
  targetRirMax?: number;
  muscleGroup?: MuscleGroup;
  loadIncrementKg?: number;
  restSeconds: number;
  notes?: string;
  supersetGroup?: string;
  skipped?: boolean;
  sets: ActiveWorkoutSet[];
}

/**
 * A session is kept in the same IndexedDB record as the plans and history.
 * Absolute timestamps allow the workout and rest timer to survive a reload.
 */
export interface ActiveWorkout {
  id: string;
  planId: string | null;
  planName: string;
  startedAt: IsoDateString;
  updatedAt: IsoDateString;
  currentExerciseIndex: number;
  currentSetIndex: number;
  restStartedAt: IsoDateString | null;
  restEndsAt: IsoDateString | null;
  restDurationSeconds: number | null;
  exercises: ActiveWorkoutExercise[];
  notes?: string;
  trainingMode?: 'complete' | 'express';
  recoveryItemIds?: string[];
  recoveryWeekStart?: string;
}

export interface RecoveryItem {
  id: string;
  sourceWorkoutId: string;
  sourcePlanId?: string;
  sourcePlanName: string;
  weekStart: string;
  savedAt: IsoDateString;
  exercise: ActiveWorkoutExercise;
}

export interface RecoverySelection {
  itemId: string;
  setIds: string[];
}

export interface Preferences {
  defaultRestSeconds: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  restAlertSound: 'bell' | 'beep';
  weightUnit: WeightUnit;
  /** Legacy backup field; ignored by current training and planning. */
  weeklyPlanModes?: Record<string, 'complete' | 'express'>;
  reduceMotion?: boolean;
}

export interface AppState {
  schemaVersion: typeof APP_STATE_SCHEMA_VERSION;
  /** Marks one-time installation of the bundled weekly plans on existing devices. */
  starterPlanVersion?: number;
  /** One-time Elite update; archived plans and history remain on device. */
  eliteProtocolVersion?: number;
  plans: WorkoutPlan[];
  history: WorkoutHistory[];
  /** Optional versioned module; old backups and active training sessions remain compatible. */
  nutrition?: NutritionState;
  recoveryItems?: RecoveryItem[];
  /** Current-week anti-duplication ledger, including sessions ended with zero sets. */
  queuedMissedPlans?: string[];
  activeWorkout: ActiveWorkout | null;
  preferences: Preferences;
  updatedAt: IsoDateString;
}

export interface AppStateBackup {
  app: 'MeuTreino';
  backupVersion: 1;
  exportedAt: IsoDateString;
  state: AppState;
}

export type WallpaperKind = 'image' | 'video';

export interface WallpaperAsset {
  id: 'active-wallpaper';
  kind: WallpaperKind;
  blob: Blob;
  name: string;
  size: number;
  updatedAt: IsoDateString;
}
