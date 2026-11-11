import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createSeedState,
  decodeBackup,
  exportSafetySnapshot,
  exportState,
  loadStateVersioned,
  saveStateVersioned,
  type StoredSnapshot,
} from '../lib/database';
import { createWriteQueue } from '../lib/writeQueue';
import {
  addRestTime,
  clearExpiredRest as expireRest,
  completeActiveSet,
  logActiveSet,
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
  missedFullBodyPlans,
  queueAutomaticFullBodyMisses,
  toggleSkipActiveExercise,
  uncompleteActiveSet,
  updateActiveSet,
  updateActiveWorkoutNotes,
  type ActiveSetPatch,
  type WorkoutPlanInput,
  type WorkoutFinishResult,
} from '../lib/workout';
import type { AppState, Preferences, RecoverySelection, WorkoutPlan } from '../types';
import { discardRecoveryItem, localWeekKey } from '../lib/recovery';
import { syncPushRest } from '../lib/pushNotifications';
import { applyFullBodyProtocol, upgradeEliteProtocol, type FullBodyProtocol } from '../lib/starterPlans';
import type { NutritionState } from '../nutrition/types';
import { emptyNutrition } from '../nutrition/engine';
import type { ProgressPhoto } from '../lib/progressPhotos';

export interface WorkoutStoreActions {
  updateNutrition(change: (current: NutritionState) => NutritionState, checkpoint?: string): Promise<void>;
  savePlan(input: WorkoutPlanInput): Promise<WorkoutPlan>;
  deletePlan(planId: string): Promise<void>;
  duplicatePlan(planId: string): Promise<WorkoutPlan>;
  startWorkout(planId: string): Promise<void>;
  startRecovery(selections: RecoverySelection[]): Promise<void>;
  discardRecovery(id: string): Promise<void>;
  queueMissedPlan(planId: string): Promise<void>;
  updateSet(exerciseId: string, setId: string, patch: ActiveSetPatch): Promise<void>;
  selectSet(exerciseId: string, setId: string): Promise<void>;
  completeSet(exerciseId: string, setId: string, patch?: ActiveSetPatch): Promise<void>;
  uncompleteSet(exerciseId: string, setId: string): Promise<void>;
  moveExercise(exerciseId: string, direction: -1 | 1): Promise<void>;
  deferExercise(exerciseId: string): Promise<void>;
  toggleSkipExercise(exerciseId: string): Promise<void>;
  updateWorkoutNotes(notes: string): Promise<void>;
  addRestSeconds(seconds?: number): Promise<void>;
  skipRest(): Promise<void>;
  clearExpiredRest(workoutId: string, restEndsAt: string): Promise<void>;
  finishWorkout(): Promise<WorkoutFinishResult>;
  abandonWorkout(): Promise<void>;
  deleteHistory(historyId: string): Promise<void>;
  updatePreferences(patch: Partial<Preferences>): Promise<void>;
  importData(source: string | unknown): Promise<AppState>;
  exportData(): Promise<string>;
  clearData(): Promise<void>;
  installFullBodyProtocol(stage: FullBodyProtocol): Promise<void>;
  restoreProgressArchive(imported: AppState, photos: ProgressPhoto[], merge: boolean): Promise<void>;
  restoreCheckpoint(): Promise<void>;
  reloadSaved(): Promise<void>;
  canReload(): boolean;
  updateCycle(cycle: AppState['trainingCycle']): Promise<void>;
}

export interface WorkoutStore extends WorkoutStoreActions {
  state: AppState | null;
  calendarWeek: string;
  loading: boolean;
  error: string | null;
  saving: boolean;
  clearError(): void;
}

type StateChange = (current: AppState) => AppState;

const errorMessage = (error: unknown): string => {
  if (error instanceof Error && error.name === 'QuotaExceededError') return 'Alteração não salva. O armazenamento do aparelho está cheio. Exporte um backup em Ajustes e libere espaço antes de tentar novamente.';
  return error instanceof Error ? error.message : 'Não foi possível salvar os dados locais.';
};

export function useWorkoutStore(): WorkoutStore {
  const [state, setState] = useState<AppState | null>(null);
  const [calendarWeek, setCalendarWeek] = useState(localWeekKey);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const stateRef = useRef<AppState | null>(null);
  const revisionRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const [queue] = useState(createWriteQueue);

  const acceptSaved = useCallback(({ state: saved, revision }: StoredSnapshot) => {
    revisionRef.current = revision;
    stateRef.current = saved;
    void syncPushRest(saved.activeWorkout, saved.preferences.soundEnabled).catch(() => undefined);
    if (mountedRef.current) { setState(saved); setError(null); }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    void loadStateVersioned()
      .then((loaded) => {
        if (cancelled) return;
        acceptSaved(loaded);
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
  }, [acceptSaved]);

  const runWrite = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    if (mountedRef.current) setSaving(true);
    return queue.run(operation).catch((cause: unknown) => {
      if (mountedRef.current) setError((prior) => cause instanceof Error && cause.message.startsWith('Uma gravação anterior') && prior ? prior : errorMessage(cause));
      throw cause;
    }).finally(() => { if (mountedRef.current && !queue.busy) setSaving(false); });
  }, [queue]);

  const commitDurable = useCallback(<T,>(change: (current: AppState) => { state: AppState; result: T } | Promise<{ state: AppState; result: T }>, label?: string): Promise<T> => runWrite(async () => {
    const current = stateRef.current;
    if (!current) throw new Error('Os dados ainda estão sendo carregados.');
    const changed = await change(current);
    if (changed.state !== current) acceptSaved(await saveStateVersioned(changed.state, { expectedRevision: revisionRef.current, checkpointLabel: label }));
    return changed.result;
  }), [acceptSaved, runWrite]);

  const commitState = useCallback((change: StateChange, checkpointLabel?: string): Promise<void> =>
    commitDurable((current) => ({ state: change(current), result: undefined }), checkpointLabel), [commitDurable]);

  useEffect(() => {
    if (!state) return;
    let timer: ReturnType<typeof setTimeout>;
    const reconcile = () => {
      clearTimeout(timer);
      const now = new Date();
      setCalendarWeek(localWeekKey(now));
      const midnight = new Date(now);
      midnight.setHours(24, 0, 1, 0);
      timer = setTimeout(reconcile, midnight.getTime() - now.getTime());
      const current = stateRef.current;
      if (document.hidden || queue.busy || !current || !missedFullBodyPlans(current, now).length) return;
      // This is additive bookkeeping, so do not replace the user's safety checkpoint.
      void commitDurable((latest) => ({ state: queueAutomaticFullBodyMisses(latest, now), result: undefined })).catch(() => undefined);
    };
    timer = setTimeout(reconcile, 0);
    window.addEventListener('focus', reconcile);
    document.addEventListener('visibilitychange', reconcile);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', reconcile);
      document.removeEventListener('visibilitychange', reconcile);
    };
  }, [state, queue, commitDurable]);

  const startRecovery = useCallback((selections: RecoverySelection[]) => commitDurable((current) => ({
    state: startRecoveryWorkout(current, selections).state, result: undefined,
  }), 'Antes de iniciar reposição'), [commitDurable]);

  const discardRecovery = useCallback((id: string) => commitDurable((current) => ({
    state: discardRecoveryItem(current, id), result: undefined,
  }), 'Antes de descartar pendência'), [commitDurable]);

  const queueMissedPlan = useCallback((planId: string) => commitDurable((current) => ({
    state: queueMissedWorkoutPlan(current, planId), result: undefined,
  }), 'Antes de registrar ficha não realizada'), [commitDurable]);

  const updateNutrition = useCallback((change: (current: NutritionState) => NutritionState, checkpoint = 'Antes de alterar Alimentação') => commitDurable((current) => ({
    state: { ...current, nutrition: change(structuredClone(current.nutrition ?? emptyNutrition())), updatedAt: new Date().toISOString() }, result: undefined,
  }), checkpoint), [commitDurable]);

  const savePlan = useCallback((input: WorkoutPlanInput) =>
    commitDurable((current) => {
      const changed = saveWorkoutPlan(current, input);
      return { state: changed.state, result: changed.plan };
    }), [commitDurable]);

  const deletePlan = useCallback((planId: string) => commitState((current) => ({
    ...current,
    plans: current.plans.filter((plan) => plan.id !== planId),
    updatedAt: new Date().toISOString(),
  }), 'Antes de excluir uma ficha'), [commitState]);

  const duplicatePlan = useCallback((planId: string) =>
    commitDurable((current) => {
      const changed = duplicateWorkoutPlan(current, planId);
      return { state: changed.state, result: changed.plan };
    }), [commitDurable]);

  const startWorkout = useCallback((planId: string) => commitState((current) =>
    startWorkoutFromPlan(current, planId).state), [commitState]);

  const updateSet = useCallback((exerciseId: string, setId: string, patch: ActiveSetPatch) =>
    commitState((current) => updateActiveSet(current, exerciseId, setId, patch)), [commitState]);

  const selectSet = useCallback((exerciseId: string, setId: string) =>
    commitState((current) => selectActiveSet(current, exerciseId, setId)), [commitState]);

  const completeSet = useCallback((exerciseId: string, setId: string, patch?: ActiveSetPatch) =>
    commitState((current) => patch ? logActiveSet(current, exerciseId, setId, patch) : completeActiveSet(current, exerciseId, setId)), [commitState]);

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

  const clearExpiredRest = useCallback((id: string, deadline: string) => commitState((current) => expireRest(current, id, deadline)), [commitState]);

  const finishWorkout = useCallback(() =>
    commitDurable((current) => {
      const { state: finished, ...result } = finishActiveWorkout(current);
      return { state: upgradeEliteProtocol(finished), result };
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

  const importData = useCallback((source: string | unknown): Promise<AppState> => commitDurable(async (current) => {
    if (current.activeWorkout) throw new Error('Encerre o treino em andamento antes de importar um backup.');
    const decoded = await decodeBackup(source instanceof Blob ? await source.text() : source);
    const imported = { ...decoded, nutrition: decoded.nutrition ?? current.nutrition ?? emptyNutrition() };
    return { state: imported, result: imported };
  }, 'Antes da importação'), [commitDurable]);

  const exportData = useCallback(async (): Promise<string> => {
    await queue.idle();
    return exportState();
  }, [queue]);

  const installFullBodyProtocol = useCallback((stage: FullBodyProtocol) => commitState((current) => applyFullBodyProtocol(current, stage), 'Antes da troca de protocolo'), [commitState]);

  const restoreProgressArchive = useCallback((imported: AppState, photos: ProgressPhoto[], merge: boolean) => runWrite(async () => {
    const current = stateRef.current;
    if (!current || current.activeWorkout) throw new Error('Encerre o treino em andamento antes de restaurar um backup.');
    const { mergeProgressArchive } = await import('../lib/progressArchive');
    const next = merge ? mergeProgressArchive(current, imported)
      : { ...imported, nutrition: imported.nutrition ?? current.nutrition ?? emptyNutrition() };
    acceptSaved(await saveStateVersioned(next, {
      expectedRevision: revisionRef.current, checkpointLabel: 'Antes de restaurar backup ZIP', addPhotos: photos,
    }));
  }), [acceptSaved, runWrite]);

  const restoreCheckpoint = useCallback(() => commitDurable(async (current) => {
    if (current.activeWorkout) throw new Error('Encerre o treino antes de restaurar a cópia.');
    const restored = await decodeBackup(await exportSafetySnapshot());
    return { state: restored, result: undefined };
  }, 'Antes de restaurar a cópia anterior'), [commitDurable]);

  const reloadSaved = useCallback(() => runWrite(async () => acceptSaved(await loadStateVersioned())), [acceptSaved, runWrite]);
  const canReload = useCallback(() => !queue.busy && Boolean(stateRef.current) && !stateRef.current?.activeWorkout, [queue]);
  const updateCycle = useCallback((trainingCycle: AppState['trainingCycle']) => commitState((current) => ({ ...current, trainingCycle }), 'Antes de alterar o ciclo de treino'), [commitState]);

  const clearData = useCallback(() => runWrite(async () => {
    if (!stateRef.current) throw new Error('Reabra os dados salvos antes de apagar.');
    const seeded = createSeedState();
    const empty: AppState = {
      ...seeded,
      plans: [],
      history: [],
      nutrition: emptyNutrition(),
      activeWorkout: null,
    };
    acceptSaved(await saveStateVersioned(empty, { expectedRevision: revisionRef.current, clearAll: true }));
  }), [acceptSaved, runWrite]);

  const clearError = useCallback(() => setError(null), []);

  const actions = useMemo<WorkoutStoreActions>(() => ({
    updateNutrition,
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
    clearExpiredRest,
    finishWorkout,
    abandonWorkout,
    deleteHistory,
    updatePreferences,
    importData,
    exportData,
    clearData,
    installFullBodyProtocol,
    restoreProgressArchive,
    restoreCheckpoint,
    reloadSaved,
    canReload,
    updateCycle,
  }), [
    updateNutrition,
    abandonWorkout,
    addRestSeconds,
    clearData,
    clearExpiredRest,
    restoreCheckpoint,
    reloadSaved,
    canReload,
    updateCycle,
    installFullBodyProtocol,
    restoreProgressArchive,
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

  return { state, calendarWeek, loading, error, saving, clearError, ...actions };
}
