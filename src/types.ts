export const APP_STATE_SCHEMA_VERSION = 1 as const;

export type IsoDateString = string;
export type WeightUnit = 'kg' | 'lb';

/** An exercise as configured inside a reusable workout plan. */
export interface Exercise {
  id: string;
  name: string;
  targetSets: number;
  targetReps: number;
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
}

export interface ActiveWorkoutExercise {
  exerciseId: string;
  exerciseName: string;
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
}

export interface Preferences {
  defaultRestSeconds: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  restAlertSound: 'bell' | 'beep';
  weightUnit: WeightUnit;
}

export interface AppState {
  schemaVersion: typeof APP_STATE_SCHEMA_VERSION;
  /** Marks one-time installation of the bundled weekly plans on existing devices. */
  starterPlanVersion?: number;
  plans: WorkoutPlan[];
  history: WorkoutHistory[];
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
