import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  GUEST_OWNER_ID,
  appDataSync,
  claimGuestAppData,
  clearActiveSession,
  clearLocalAppData,
  deleteAccount,
  getCurrentSession,
  isDeleted,
  isSupabaseConfigured as supabaseConfigured,
  loadLocalAppData,
  markDeleted,
  mergeAppData,
  onAuthStateChange,
  signInWithEmailPassword,
  signOut,
  signUpWithEmailPassword,
  subscribeToLocalAppData,
  updateLocalAppData,
  type AuthActionResult,
  type AccountDeletionResult,
  type SyncResult,
  type SyncStatus,
} from '@/lib';
import { createActiveSession, finishSession } from '@/lib/workout-domain';
import type {
  ActiveSession,
  AppData,
  AppPreferences,
  Exercise,
  HistoryItem,
  Workout,
} from '@/types/models';
import type { SyncVisualState } from '@/components/layout/app-shell';
import { cancelRestAlert } from '@/services/rest-alert';

type WorkoutAppContextValue = {
  data: AppData;
  ready: boolean;
  session: Session | null;
  syncStatus: SyncStatus;
  syncVisualState: SyncVisualState;
  isSupabaseConfigured: boolean;
  saveWorkout: (workout: Workout) => void;
  deleteWorkout: (id: string) => void;
  startWorkout: (workout: Workout) => void;
  updateActiveSession: (session: ActiveSession) => void;
  finishActiveWorkout: () => HistoryItem | null;
  discardActiveWorkout: () => void;
  deleteHistoryItem: (id: string) => void;
  updatePreferences: (patch: Partial<Omit<AppPreferences, 'updatedAt'>>) => void;
  authSignIn: (email: string, password: string) => Promise<AuthActionResult>;
  authSignUp: (email: string, password: string) => Promise<AuthActionResult>;
  authSignOut: () => Promise<AuthActionResult>;
  authDeleteAccount: () => Promise<AccountDeletionResult>;
  syncNow: () => Promise<SyncResult>;
};

const WorkoutAppContext = createContext<WorkoutAppContextValue | null>(null);

export function WorkoutAppProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [rawData, setRawData] = useState<AppData>(() => loadLocalAppData(GUEST_OWNER_ID));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => appDataSync.getStatus());
  const ownerId = session?.user.id ?? GUEST_OWNER_ID;

  useEffect(() => {
    let active = true;
    const applySession = (nextSession: Session | null) => {
      if (!active) return;
      if (nextSession?.user.id) {
        claimGuestAppData(nextSession.user.id);
      }
      setSession(nextSession);
      setReady(true);
    };

    const stopAuthListener = onAuthStateChange((_event, nextSession) => applySession(nextSession));
    const stopStatusListener = appDataSync.subscribe(setSyncStatus);
    void getCurrentSession().then(applySession);
    void appDataSync.start();

    return () => {
      active = false;
      stopAuthListener();
      stopStatusListener();
      void appDataSync.stop();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const stopLocalListener = subscribeToLocalAppData(ownerId, setRawData);
    Promise.resolve().then(() => {
      if (active) setRawData(loadLocalAppData(ownerId));
    });
    return () => {
      active = false;
      stopLocalListener();
    };
  }, [ownerId]);

  const commit = useCallback(
    (updater: (current: AppData) => AppData) => {
      const next = updateLocalAppData(updater, ownerId);
      setRawData(next);
      return next;
    },
    [ownerId],
  );

  const saveWorkout = useCallback((workout: Workout) => {
    commit((current) => {
      const timestamp = workout.updatedAt || new Date().toISOString();
      const restoredWorkout: Workout = { ...workout, updatedAt: timestamp };
      delete restoredWorkout.deletedAt;

      const workoutIndex = current.workouts.findIndex((item) => item.id === workout.id);
      const workouts = [...current.workouts];
      if (workoutIndex >= 0) workouts[workoutIndex] = restoredWorkout;
      else workouts.push(restoredWorkout);

      const exercises = [...current.exercises];
      for (const item of workout.exercises) {
        const existingIndex = exercises.findIndex((exercise) => exercise.id === item.exerciseId);
        const existing = existingIndex >= 0 ? exercises[existingIndex] : null;
        const exercise: Exercise = {
          id: item.exerciseId,
          name: item.exerciseName,
          notes: item.notes,
          defaultSets: item.targetSets,
          defaultReps: item.targetReps,
          defaultRestSeconds: item.restSeconds,
          createdAt: existing?.createdAt ?? timestamp,
          updatedAt: timestamp,
        };
        if (existingIndex >= 0) exercises[existingIndex] = exercise;
        else exercises.push(exercise);
      }

      return { ...current, workouts, exercises, updatedAt: timestamp };
    });
  }, [commit]);

  const deleteWorkout = useCallback((id: string) => {
    commit((current) => {
      const timestamp = new Date().toISOString();
      return {
        ...current,
        workouts: current.workouts.map((workout) => workout.id === id ? markDeleted(workout, timestamp) : workout),
        updatedAt: timestamp,
      };
    });
  }, [commit]);

  const startWorkout = useCallback((workout: Workout) => {
    commit((current) => {
      const activeSession = createActiveSession(workout);
      return { ...current, activeSession, updatedAt: activeSession.updatedAt };
    });
  }, [commit]);

  const updateActiveSession = useCallback((activeSession: ActiveSession) => {
    commit((current) => {
      if (!current.activeSession || current.activeSession.id !== activeSession.id) {
        return { ...current, activeSession, updatedAt: activeSession.updatedAt };
      }

      const merged = mergeAppData(
        current,
        { ...current, activeSession, updatedAt: activeSession.updatedAt },
      );
      return {
        ...current,
        activeSession: merged.activeSession ?? activeSession,
        updatedAt: merged.updatedAt,
      };
    });
  }, [commit]);

  const finishActiveWorkout = useCallback((): HistoryItem | null => {
    let completed: HistoryItem | null = null;
    commit((current) => {
      if (!current.activeSession) return current;
      const timestamp = new Date().toISOString();
      completed = finishSession(current.activeSession, timestamp);
      const history = current.history.filter((item) => item.id !== completed?.id);
      history.unshift(completed);
      return clearActiveSession({ ...current, history, updatedAt: timestamp }, timestamp);
    });
    return completed;
  }, [commit]);

  const discardActiveWorkout = useCallback(() => {
    commit((current) => clearActiveSession(current));
  }, [commit]);

  const deleteHistoryItem = useCallback((id: string) => {
    commit((current) => {
      const timestamp = new Date().toISOString();
      return {
        ...current,
        history: current.history.map((item) => item.id === id ? markDeleted(item, timestamp) : item),
        updatedAt: timestamp,
      };
    });
  }, [commit]);

  const updatePreferences = useCallback((patch: Partial<Omit<AppPreferences, 'updatedAt'>>) => {
    commit((current) => {
      const timestamp = new Date().toISOString();
      return {
        ...current,
        preferences: { ...current.preferences, ...patch, updatedAt: timestamp },
        updatedAt: timestamp,
      };
    });
  }, [commit]);

  const authSignIn = useCallback(async (email: string, password: string) => {
    const result = await signInWithEmailPassword(email, password);
    if (result.session) {
      claimGuestAppData(result.session.user.id);
      setSession(result.session);
    }
    return result;
  }, []);

  const authSignUp = useCallback(async (email: string, password: string) => {
    const result = await signUpWithEmailPassword(email, password);
    if (result.session) {
      claimGuestAppData(result.session.user.id);
      setSession(result.session);
    }
    return result;
  }, []);

  const authSignOut = useCallback(async () => {
    const result = await signOut();
    if (result.ok) setSession(null);
    return result;
  }, []);

  const authDeleteAccount = useCallback(async () => {
    const accountOwnerId = session?.user.id ?? null;
    const activeSessionId = rawData.activeSession?.id ?? null;
    const result = await deleteAccount();

    if (result.ok) {
      if (activeSessionId) {
        await cancelRestAlert(`rest:${activeSessionId}`).catch(() => undefined);
      }
      if (accountOwnerId) clearLocalAppData(accountOwnerId);
      setSession(null);
    }

    return result;
  }, [rawData.activeSession?.id, session?.user.id]);

  const visibleData = useMemo<AppData>(() => ({
    ...rawData,
    exercises: rawData.exercises.filter((exercise) => !isDeleted(exercise)),
    workouts: rawData.workouts
      .filter((workout) => !isDeleted(workout))
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
    history: rawData.history
      .filter((item) => !isDeleted(item))
      .sort((left, right) => Date.parse(right.endedAt) - Date.parse(left.endedAt)),
  }), [rawData]);

  const syncVisualState = useMemo<SyncVisualState>(() => {
    switch (syncStatus.phase) {
      case 'syncing': return 'syncing';
      case 'synced': return 'synced';
      case 'offline': return 'offline';
      case 'error': return 'error';
      default: return 'local';
    }
  }, [syncStatus.phase]);

  const value = useMemo<WorkoutAppContextValue>(() => ({
    data: visibleData,
    ready,
    session,
    syncStatus,
    syncVisualState,
    isSupabaseConfigured: supabaseConfigured,
    saveWorkout,
    deleteWorkout,
    startWorkout,
    updateActiveSession,
    finishActiveWorkout,
    discardActiveWorkout,
    deleteHistoryItem,
    updatePreferences,
    authSignIn,
    authSignUp,
    authSignOut,
    authDeleteAccount,
    syncNow: appDataSync.syncNow,
  }), [
    authSignIn,
    authSignOut,
    authDeleteAccount,
    authSignUp,
    deleteHistoryItem,
    deleteWorkout,
    discardActiveWorkout,
    finishActiveWorkout,
    ready,
    saveWorkout,
    session,
    startWorkout,
    syncStatus,
    syncVisualState,
    updateActiveSession,
    updatePreferences,
    visibleData,
  ]);

  return <WorkoutAppContext.Provider value={value}>{children}</WorkoutAppContext.Provider>;
}

export function useWorkoutApp(): WorkoutAppContextValue {
  const context = useContext(WorkoutAppContext);
  if (!context) {
    throw new Error('useWorkoutApp must be used inside WorkoutAppProvider.');
  }
  return context;
}
