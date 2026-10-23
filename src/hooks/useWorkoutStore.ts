import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createSeedState,
  clearSafetySnapshot,
  exportState,
  importState,
  loadState,
  saveState,
  validateAppState,
} from '../lib/database';
import {
  addRestTime,
  completeActiveSet,
  deferActiveExercise,
  duplicateWorkoutPlan,
  finishActiveWorkout,
  moveActiveExercise,
  saveWorkoutPlan,
  selectActiveSet,
  skipRest,
  startWorkoutFromPlan,
  startRecoveryWorkout,
  queueMissedWorkoutPlan,
  toggleSkipActiveExercise,
  uncompleteActiveSet,
  updateActiveSet,
  updateActiveWorkoutNotes,
  type ActiveSetPatch,
  type WorkoutPlanInput,
} from '../lib/workout';
import type { AppState, Preferences, RecoverySelection, WorkoutHistory, WorkoutPlan } from '../types';
import { discardRecoveryItem } from '../lib/recovery';
import { syncPushRest } from '../lib/pushNotifications';
import { applyPreSurgicalProtocol, upgradeEliteProtocol } from '../lib/starterPlans';

export interface WorkoutStoreActions {
  savePlan(input: WorkoutPlanInput): Promise<WorkoutPlan>;
  deletePlan(planId: string): Promise<void>;
  duplicatePlan(planId: string): Promise<WorkoutPlan>;
  startWorkout(planId: string): Promise<void>;
  startRecovery(selections: RecoverySelection[]): Promise<void>;
  discardRecovery(id: string): Promise<void>;
  queueMissedPlan(planId: string): Promise<void>;
  updateSet(exerciseId: string, setId: string, patch: ActiveSetPatch): Promise<void>;
  selectSet(exerciseId: string, setId: string): Promise<void>;
  completeSet(exerciseId: string, setId: string): Promise<void>;
  uncompleteSet(exerciseId: string, setId: string): Promise<void>;
  moveExercise(exerciseId: string, direction: -1 | 1): Promise<void>;
  deferExercise(exerciseId: string): Promise<void>;
  toggleSkipExercise(exerciseId: string): Promise<void>;
  updateWorkoutNotes(notes: string): Promise<void>;
  addRestSeconds(seconds?: number): Promise<void>;
  skipRest(): Promise<void>;
  finishWorkout(): Promise<WorkoutHistory>;
  abandonWorkout(): Promise<void>;
  deleteHistory(historyId: string): Promise<void>;
  updatePreferences(patch: Partial<Preferences>): Promise<void>;
  importData(source: string | unknown): Promise<AppState>;
  exportData(): Promise<string>;
  clearData(): Promise<void>;
  installPreSurgicalProtocol(): Promise<void>;
}

export interface WorkoutStore extends WorkoutStoreActions {
  state: AppState | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  clearError(): void;
}

type StateChange = (current: AppState) => AppState;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Não foi possível salvar os dados locais.';

export function useWorkoutStore(): WorkoutStore {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pendingWrites = useRef(0);
  const stateRef = useRef<AppState | null>(null);
  const mountedRef = useRef(true);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const importingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    void loadState()
      .then((loaded) => {
        if (cancelled) return;
        stateRef.current = loaded;
        setState(loaded);
        void syncPushRest(loaded.activeWorkout, loaded.preferences.soundEnabled).catch(() => undefined);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  const enqueueSave = useCallback((next: AppState, checkpointLabel?: string): Promise<void> => {
    pendingWrites.current += 1;
    if (mountedRef.current) setSaving(true);
    const write = writeQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await saveState(next, checkpointLabel);
      });
    writeQueueRef.current = write;
    return write.catch((cause: unknown) => {
      if (mountedRef.current) setError(errorMessage(cause));
      throw cause;
    }).finally(() => { pendingWrites.current -= 1; if (mountedRef.current && pendingWrites.current === 0) setSaving(false); });
  }, []);

  const commit = useCallback(async <T,>(change: (current: AppState) => { state: AppState; result: T; checkpointLabel?: string }, checkpointLabel?: string): Promise<T> => {
    if (importingRef.current) {
      const message = 'Aguarde a gravação ou importação terminar.';
      if (mountedRef.current) setError(message);
      throw new Error(message);
    }
    const current = stateRef.current;
    if (!current) throw new Error('Os dados ainda estão sendo carregados.');

    // Compute first and update the ref synchronously. IndexedDB is deliberately
    // enqueued afterwards, never from inside a React state updater.
    let changed: { state: AppState; result: T; checkpointLabel?: string };
    try {
      changed = change(current);
      validateAppState(changed.state);
    } catch (cause) {
      if (mountedRef.current) setError(errorMessage(cause));
      throw cause;
    }
    stateRef.current = changed.state;
    // Begin scheduling/cancellation immediately after the tap, before waiting for disk.
    void syncPushRest(changed.state.activeWorkout, changed.state.preferences.soundEnabled).catch(() => undefined);
    if (mountedRef.current) {
      setState(changed.state);
      setError(null);
    }
    await enqueueSave(changed.state, changed.checkpointLabel ?? checkpointLabel);
    return changed.result;
  }, [enqueueSave]);

  const commitState = useCallback((change: StateChange, checkpointLabel?: string): Promise<void> =>
    commit((current) => ({ state: change(current), result: undefined }), checkpointLabel), [commit]);

  // Queue consumption and session closure must not appear successful before disk commits.
  const commitDurable = useCallback(async <T,>(change: (current: AppState) => { state: AppState; result: T }, label: string): Promise<T> => {
    if (importingRef.current) throw new Error('Aguarde a gravação ou importação terminar.');
    importingRef.current = true;
    try {
      await writeQueueRef.current.catch(() => undefined);
      const current = stateRef.current;
      if (!current) throw new Error('Os dados ainda estão carregando.');
      const changed = change(current);
      validateAppState(changed.state);
      await enqueueSave(changed.state, label);
      stateRef.current = changed.state;
      void syncPushRest(changed.state.activeWorkout, changed.state.preferences.soundEnabled).catch(() => undefined);
      if (mountedRef.current) { setState(changed.state); setError(null); }
      return changed.result;
    } catch (cause) {
      if (mountedRef.current) setError(errorMessage(cause));
      throw cause;
    } finally { importingRef.current = false; }
  }, [enqueueSave]);

  const startRecovery = useCallback((selections: RecoverySelection[]) => commitDurable((current) => ({
    state: startRecoveryWorkout(current, selections).state, result: undefined,
  }), 'Antes de iniciar reposição'), [commitDurable]);

  const discardRecovery = useCallback((id: string) => commitDurable((current) => ({
    state: discardRecoveryItem(current, id), result: undefined,
  }), 'Antes de descartar pendência'), [commitDurable]);

  const queueMissedPlan = useCallback((planId: string) => commitDurable((current) => ({
    state: queueMissedWorkoutPlan(current, planId), result: undefined,
  }), 'Antes de registrar ficha não realizada'), [commitDurable]);

  const savePlan = useCallback((input: WorkoutPlanInput) =>
    commit((current) => {
      const changed = saveWorkoutPlan(current, input);
      return { state: changed.state, result: changed.plan };
    }), [commit]);

  const deletePlan = useCallback((planId: string) => commitState((current) => ({
    ...current,
    plans: current.plans.filter((plan) => plan.id !== planId),
    updatedAt: new Date().toISOString(),
  }), 'Antes de excluir uma ficha'), [commitState]);

  const duplicatePlan = useCallback((planId: string) =>
    commit((current) => {
      const changed = duplicateWorkoutPlan(current, planId);
      return { state: changed.state, result: changed.plan };
    }), [commit]);

  const startWorkout = useCallback((planId: string) => commitState((current) =>
    startWorkoutFromPlan(current, planId).state), [commitState]);

  const updateSet = useCallback((exerciseId: string, setId: string, patch: ActiveSetPatch) =>
    commitState((current) => updateActiveSet(current, exerciseId, setId, patch)), [commitState]);

  const selectSet = useCallback((exerciseId: string, setId: string) =>
    commitState((current) => selectActiveSet(current, exerciseId, setId)), [commitState]);

  const completeSet = useCallback((exerciseId: string, setId: string) =>
    commitState((current) => completeActiveSet(current, exerciseId, setId)), [commitState]);

  const uncompleteSet = useCallback((exerciseId: string, setId: string) =>
    commitState((current) => uncompleteActiveSet(current, exerciseId, setId)), [commitState]);

  const moveExercise = useCallback((exerciseId: string, direction: -1 | 1) =>
    commitState((current) => moveActiveExercise(current, exerciseId, direction)), [commitState]);

  const deferExercise = useCallback((exerciseId: string) =>
    commitState((current) => deferActiveExercise(current, exerciseId)), [commitState]);

  const toggleSkipExercise = useCallback((exerciseId: string) =>
    commitState((current) => toggleSkipActiveExercise(current, exerciseId)), [commitState]);

  const updateWorkoutNotes = useCallback((notes: string) =>
    commitState((current) => updateActiveWorkoutNotes(current, notes)), [commitState]);

  const addRestSeconds = useCallback((seconds = 15) =>
    commitState((current) => addRestTime(current, seconds)), [commitState]);

  const skipCurrentRest = useCallback(() =>
    commitState((current) => skipRest(current)), [commitState]);

  const finishWorkout = useCallback(() =>
    commitDurable((current) => {
      const changed = finishActiveWorkout(current);
      const upgraded = upgradeEliteProtocol(changed.state);
      return { state: upgraded, result: changed.history };
    }, 'Antes de encerrar sessão e guardar pendências'), [commitDurable]);

  const abandonWorkout = useCallback(() => commitDurable((current) => {
    const next = { ...current, activeWorkout: null, updatedAt: new Date().toISOString() };
    const upgraded = upgradeEliteProtocol(next);
    return { state: upgraded, result: undefined };
  }, 'Antes de abandonar sessão'), [commitDurable]);

  const deleteHistory = useCallback((historyId: string) => commitState((current) => ({
    ...current,
    history: current.history.filter((item) => item.id !== historyId),
    updatedAt: new Date().toISOString(),
  }), 'Antes de excluir um registro'), [commitState]);

  const updatePreferences = useCallback((patch: Partial<Preferences>) => commitState((current) => ({
    ...current,
    preferences: { ...current.preferences, ...patch },
    updatedAt: new Date().toISOString(),
  })), [commitState]);

  const importData = useCallback(async (source: string | unknown): Promise<AppState> => {
    if (importingRef.current) throw new Error('Já existe uma importação em andamento.');
    importingRef.current = true;
    let importedState: AppState | null = null;
    const operation = writeQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const imported = await importState(source);
        importedState = imported;
        stateRef.current = imported;
        void syncPushRest(imported.activeWorkout, imported.preferences.soundEnabled).catch(() => undefined);
        if (mountedRef.current) {
          setState(imported);
          setError(null);
        }
      });
    writeQueueRef.current = operation;
    try {
      await operation;
      if (!importedState) throw new Error('Não foi possível importar os dados.');
      return importedState;
    } catch (cause) {
      if (mountedRef.current) setError(errorMessage(cause));
      throw cause;
    } finally {
      importingRef.current = false;
    }
  }, []);

  const exportData = useCallback(async (): Promise<string> => {
    await writeQueueRef.current;
    return exportState();
  }, []);

  const installPreSurgicalProtocol = useCallback(async () => {
    if (!stateRef.current) throw new Error('Os dados ainda estão carregando.');
    await importData(applyPreSurgicalProtocol(stateRef.current));
  }, [importData]);

  const clearData = useCallback(async (): Promise<void> => {
    if (importingRef.current) throw new Error('Aguarde a importação do backup terminar.');
    const seeded = createSeedState();
    const empty: AppState = {
      ...seeded,
      plans: [],
      history: [],
      activeWorkout: null,
    };
    stateRef.current = empty;
    void syncPushRest(null, empty.preferences.soundEnabled).catch(() => undefined);
    if (mountedRef.current) {
      setState(empty);
      setError(null);
    }
    await enqueueSave(empty);
    await clearSafetySnapshot();
  }, [enqueueSave]);

  const clearError = useCallback(() => setError(null), []);

  const actions = useMemo<WorkoutStoreActions>(() => ({
    savePlan,
    deletePlan,
    duplicatePlan,
    startWorkout,
    startRecovery,
    discardRecovery,
    queueMissedPlan,
    updateSet,
    selectSet,
    completeSet,
    uncompleteSet,
    moveExercise,
    deferExercise,
    toggleSkipExercise,
    updateWorkoutNotes,
    addRestSeconds,
    skipRest: skipCurrentRest,
    finishWorkout,
    abandonWorkout,
    deleteHistory,
    updatePreferences,
    importData,
    exportData,
    clearData,
    installPreSurgicalProtocol,
  }), [
    abandonWorkout,
    addRestSeconds,
    clearData,
    installPreSurgicalProtocol,
    completeSet,
    deferExercise,
    deleteHistory,
    deletePlan,
    duplicatePlan,
    exportData,
    finishWorkout,
    importData,
    moveExercise,
    savePlan,
    skipCurrentRest,
    startWorkout,
    startRecovery,
    discardRecovery,
    queueMissedPlan,
    updatePreferences,
    updateWorkoutNotes,
    updateSet,
    uncompleteSet,
    toggleSkipExercise,
    selectSet,
  ]);

  return { state, loading, error, saving, clearError, ...actions };
}
