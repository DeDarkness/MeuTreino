import { AlertTriangle, RefreshCw } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';

import { ActiveWorkoutDock } from './components/ActiveWorkoutDock';
import { ActionDialog, type ActionConfirmation } from './components/ActionDialog';
import { AppStatus } from './components/AppStatus';
import { exportSafetySnapshot, importState } from './lib/database';
import { BackupFileButtons } from './components/BackupFileButtons';
import { useReducedMotion } from './hooks/useReducedMotion';
import { BottomNav, type AppTab } from './components/BottomNav';
import { UpdatePrompt } from './components/UpdatePrompt';
import { WallpaperBackdrop } from './components/WallpaperBackdrop';
import { WorkoutSummaryDialog } from './components/WorkoutSummaryDialog';
import { useWallpaper } from './hooks/useWallpaper';
import { useRestAlert } from './hooks/useRestAlert';
import { useWorkoutStore } from './hooks/useWorkoutStore';
import { usePushNotifications } from './hooks/usePushNotifications';
import { getRestNotificationPermission, type RestNotificationPermission } from './lib/notifications';
import { enablePushNotifications } from './lib/pushNotifications';
import { isAutomaticMissFor, localWeekKey, remainingSetCount } from './lib/recovery';
import { ActiveWorkoutScreen } from './screens/ActiveWorkoutScreen';
import { HomeScreen } from './screens/HomeScreen';
import type { ActiveWorkoutSet, WorkoutPlan } from './types';
import type { WorkoutFinishResult } from './lib/workout';
import { emptyNutrition } from './nutrition/engine';

const HistoryScreen = lazy(() => import('./screens/HistoryScreen').then((module) => ({ default: module.HistoryScreen })));
const PlansScreen = lazy(() => import('./screens/PlansScreen').then((module) => ({ default: module.PlansScreen })));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen').then((module) => ({ default: module.SettingsScreen })));
const WallpaperScreen = lazy(() => import('./screens/WallpaperScreen').then((module) => ({ default: module.WallpaperScreen })));
const NutritionScreen = lazy(() => import('./nutrition/NutritionScreen').then((module) => ({ default: module.NutritionScreen })));
const BodyPanel = lazy(() => import('./nutrition/BodyPanel').then((module) => ({ default: module.BodyPanel })));
const PhotoEvolution = lazy(() => import('./screens/PhotoEvolution').then((module) => ({ default: module.PhotoEvolution })));
const ProgressBackup = lazy(() => import('./components/ProgressBackup').then((module) => ({ default: module.ProgressBackup })));

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export default function App() {
  const store = useWorkoutStore();
  const reducedMotion = useReducedMotion(store.state?.preferences.reduceMotion);
  const pushStatus = usePushNotifications();
  const wallpaper = useWallpaper();
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [showActiveWorkout, setShowActiveWorkout] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<RestNotificationPermission>(() => getRestNotificationPermission());
  const [completedSummary, setCompletedSummary] = useState<WorkoutFinishResult | null>(null);
  const [recoveryTarget, setRecoveryTarget] = useState<{ week: string } | null>(null);
  const [confirmation, setConfirmation] = useState<ActionConfirmation | null>(null);
  const [emergencyBackup, setEmergencyBackup] = useState<File | null>(null);
  const [emergencyError, setEmergencyError] = useState('');
  const [bodyView, setBodyView] = useState<'measurements' | 'photos'>('measurements');
  const runAction = (operation: Promise<unknown>) => { void operation.catch(() => undefined); };

  useEffect(() => {
    if (activeTab !== 'home' || showActiveWorkout || !recoveryTarget) return;
    const frame = window.requestAnimationFrame(() => {
      const panel = document.getElementById('weekly-recovery');
      panel?.focus({ preventScroll: true });
      panel?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, recoveryTarget, showActiveWorkout]);

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const update = () => setIsStandalone(media.matches || Boolean((navigator as NavigatorWithStandalone).standalone));
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    const refreshPermission = () => setNotificationPermission(getRestNotificationPermission());
    document.addEventListener('visibilitychange', refreshPermission);
    return () => document.removeEventListener('visibilitychange', refreshPermission);
  }, []);

  useEffect(() => {
    if (!navigator.storage?.persisted) return;
    void navigator.storage.persisted().then(setStoragePersistent).catch(() => setStoragePersistent(null));
  }, []);

  const state = store.state;
  const activeWorkout = state?.activeWorkout ?? null;
  useRestAlert(activeWorkout, state?.preferences ?? null, store.clearExpiredRest);
  const completedSets = useMemo(
    () => activeWorkout?.exercises.reduce(
      (total, exercise) => total + (exercise.skipped ? 0 : exercise.sets.filter((set) => set.completed).length),
      0,
    ) ?? 0,
    [activeWorkout],
  );
  const showIosInstallPrompt = useMemo(() => {
    const userAgent = navigator.userAgent;
    const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent);
    const isSafari = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);
    return !isStandalone && isAppleMobile && isSafari;
  }, [isStandalone]);

  if (store.loading) {
    return (
      <main className="app-loading">
        <div className="loading-content">
          <div className="loading-logo">M</div>
          <strong>Preparando seu treino</strong>
          <span>Abrindo os dados salvos neste aparelho…</span>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="app-error">
        <div className="error-content">
          <AlertTriangle size={46} color="var(--danger)" />
          <h1>Não foi possível abrir o MeuTreino</h1>
          <p>{store.error ?? 'O armazenamento local não está disponível.'}</p>
          <button className="button button-primary" type="button" onClick={() => window.location.reload()}>
            <RefreshCw size={19} /> Tentar novamente
          </button>
          <button className="button button-secondary" type="button" onClick={() => {
            setEmergencyError('');
            void exportSafetySnapshot().then((json) => setEmergencyBackup(new File([json], 'meutreino-recuperacao.json', { type: 'application/json' }))).catch((cause: unknown) => setEmergencyError(cause instanceof Error ? cause.message : 'Cópia não disponível.'));
          }}>Preparar cópia de segurança</button>
          {emergencyBackup ? <BackupFileButtons file={emergencyBackup} /> : null}
          <label>Importar backup para recuperar <input type="file" accept="application/json,.json" onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (!file || !window.confirm('Substituir os dados locais por este backup?')) return;
            void file.text().then(importState).then(() => window.location.reload()).catch((cause: unknown) => setEmergencyError(cause instanceof Error ? cause.message : 'Não foi possível recuperar.'));
          }} /></label>
          {emergencyError ? <p role="alert">{emergencyError}</p> : null}
        </div>
      </main>
    );
  }

  const openWorkout = async (plan: WorkoutPlan) => {
    if (isStandalone && notificationPermission === 'default') {
      void enablePushNotifications().catch(() => undefined).finally(() => setNotificationPermission(getRestNotificationPermission()));
    }
    if (state.activeWorkout) {
      if (state.activeWorkout.planId !== plan.id) return;
      setShowActiveWorkout(true);
      return;
    }
    const start = async () => { await store.startWorkout(plan.id); setShowActiveWorkout(true); };
    const week = localWeekKey();
    const pending = state.recoveryItems?.filter((item) => item.sourcePlanId === plan.id && item.weekStart === week) ?? [];
    if (pending.length) {
      const automatic = pending.some((item) => isAutomaticMissFor(item, plan.id, week));
      setConfirmation({ title: 'Iniciar a ficha inteira?', message: automatic ? 'Ao encerrar, as séries feitas serão abatidas da falta automática no Dia D. Você também pode escolher só algumas séries no Dia D.' : 'Esta ficha já tem séries pendentes nesta semana. Para fazer só o que faltou, use o Dia D. Iniciar outra sessão completa não substitui as pendências anteriores.', confirmLabel: 'Iniciar ficha inteira', onConfirm: start });
      return;
    }
    await start();
  };

  const exportBackup = async (recovery = false) => {
    const json = recovery ? await exportSafetySnapshot() : await store.exportData();
    const date = new Date().toISOString().slice(0, 10);
    return new File([json], `meutreino-${recovery ? 'recuperacao' : 'backup'}-${date}.json`, { type: 'application/json' });
  };

  const requestPersistence = async () => {
    if (!navigator.storage?.persist) return false;
    const granted = await navigator.storage.persist();
    setStoragePersistent(granted);
    return granted;
  };

  const actionDialog = confirmation ? <ActionDialog action={confirmation} onClose={() => setConfirmation(null)} /> : null;

  if (showActiveWorkout && activeWorkout) {
    return (
      <div className={`app-shell active-mode${wallpaper.asset ? ' has-wallpaper' : ''}`} data-reduced-motion={reducedMotion}>
        <WallpaperBackdrop asset={wallpaper.asset} url={wallpaper.url} reducedMotion={reducedMotion} />
        <AppStatus saving={store.saving} hasError={Boolean(store.error)} />
        {store.error ? (
          <div className="global-error active-error" role="alert">
            <AlertTriangle size={18} />
            <span>{store.error}</span>
            <button type="button" disabled={store.saving} aria-label="Reabrir dados salvos" onClick={() => runAction(store.reloadSaved())}><RefreshCw size={15} /></button>
            <button type="button" aria-label="Fechar aviso" onClick={store.clearError}>×</button>
          </div>
        ) : null}
        <ActiveWorkoutScreen
          workout={activeWorkout}
          saving={store.saving}
          preferences={state.preferences}
          history={state.history}
          onUpdateSet={(exerciseIndex, setIndex, patch) => {
            const exercise = activeWorkout.exercises[exerciseIndex];
            const set = exercise?.sets[setIndex];
            if (!exercise || !set) return;
            runAction(store.updateSet(exercise.exerciseId, set.id, patch as Partial<Pick<ActiveWorkoutSet, 'reps' | 'weight' | 'rir'>>));
          }}
          onSelectSet={(exerciseIndex, setIndex) => {
            const exercise = activeWorkout.exercises[exerciseIndex];
            const set = exercise?.sets[setIndex];
            if (!exercise || !set) return;
            runAction(store.selectSet(exercise.exerciseId, set.id));
          }}
          onCompleteSet={(patch) => {
            const exercise = activeWorkout.exercises[activeWorkout.currentExerciseIndex];
            const set = exercise?.sets[activeWorkout.currentSetIndex];
            if (!exercise || !set) return;
            runAction(store.completeSet(exercise.exerciseId, set.id, patch));
          }}
          onUncompleteSet={(exerciseIndex, setIndex) => {
            const exercise = activeWorkout.exercises[exerciseIndex];
            const set = exercise?.sets[setIndex];
            if (!exercise || !set) return;
            runAction(store.uncompleteSet(exercise.exerciseId, set.id));
          }}
          onMoveExercise={(exerciseIndex, direction) => {
            const exercise = activeWorkout.exercises[exerciseIndex];
            if (!exercise) return;
            runAction(store.moveExercise(exercise.exerciseId, direction));
          }}
          onDeferExercise={(exerciseIndex) => {
            const exercise = activeWorkout.exercises[exerciseIndex];
            if (!exercise) return;
            runAction(store.deferExercise(exercise.exerciseId));
          }}
          onToggleSkipExercise={(exerciseIndex) => {
            const exercise = activeWorkout.exercises[exerciseIndex];
            if (!exercise) return;
            runAction(store.toggleSkipExercise(exercise.exerciseId));
          }}
          onUpdateNotes={(notes) => runAction(store.updateWorkoutNotes(notes))}
          onSkipRest={() => runAction(store.skipRest())}
          onAddRest={(seconds) => runAction(store.addRestSeconds(seconds))}
          onFinish={() => {
            const remaining = remainingSetCount(activeWorkout);
            setConfirmation({ title: 'Encerrar esta sessão?',
              message: `${completedSets ? `${completedSets} ${completedSets === 1 ? 'série será registrada' : 'séries serão registradas'} no histórico.` : 'Nenhuma série foi concluída, então a sessão ficará fora do histórico.'} ${remaining ? 'As séries pendentes ficam no Dia D da semana de origem. Você escolhe quando repor.' : 'Todas as séries desta sessão foram concluídas.'}`,
              confirmLabel: 'Encerrar e salvar', onConfirm: async () => {
                const saved = await store.finishWorkout();
                setShowActiveWorkout(false);
                setRecoveryTarget(null);
                setActiveTab(saved.recovery || !saved.history.exercises.length ? 'home' : 'history');
                setCompletedSummary(saved.recovery || saved.history.exercises.length ? saved : null);
              },
            });
          }}
          onAbandon={() => {
            setConfirmation({ title: 'Abandonar sem registrar?', message: `As séries feitas nesta tentativa não serão salvas no histórico. ${activeWorkout.recoveryItemIds ? 'Todas as pendências originais da reposição permanecem intactas.' : 'Não serão criadas pendências desta sessão. Para guardar o que falta, use Encerrar e guardar pendências.'}`, confirmLabel: 'Abandonar sessão', onConfirm: async () => { await store.abandonWorkout(); setShowActiveWorkout(false); setActiveTab('home'); } });
          }}
          onClose={() => setShowActiveWorkout(false)}
          notificationPermission={notificationPermission}
          pushRestMessage={pushStatus.enabled && activeWorkout.restEndsAt ? pushStatus.message : null}
        />
        <BottomNav
          activeTab={null}
          onChange={(tab) => {
            setActiveTab(tab);
            setShowActiveWorkout(false);
          }}
        />
        <UpdatePrompt workoutInProgress saving={store.saving} canReload={store.canReload} />
        {actionDialog}
      </div>
    );
  }

  return (
    <div className={`app-shell${wallpaper.asset ? ' has-wallpaper' : ''}${activeWorkout ? ' has-active-workout' : ''}`} data-reduced-motion={reducedMotion}>
      <WallpaperBackdrop asset={wallpaper.asset} url={wallpaper.url} reducedMotion={reducedMotion} />
      <AppStatus saving={store.saving} hasError={Boolean(store.error)} />
      <main className="app-content">
        {store.error ? (
          <div className="global-error" role="alert">
            <AlertTriangle size={18} />
            <span>{store.error}</span>
            <button type="button" disabled={store.saving} aria-label="Reabrir dados salvos" onClick={() => runAction(store.reloadSaved())}><RefreshCw size={15} /></button>
            <button type="button" aria-label="Fechar aviso" onClick={store.clearError}>×</button>
          </div>
        ) : null}

        <Suspense fallback={<p className="elite-caption" role="status">Abrindo tela…</p>}>
        {activeTab === 'home' ? (
          <HomeScreen
            plans={state.plans}
            calendarWeek={store.calendarWeek}
            recoveryFocusWeek={recoveryTarget?.week}
            measurements={state.nutrition?.measurements}
            weightUnit={state.preferences.weightUnit}
            showProgressPhoto={state.preferences.showProgressPhotoOnHome}
            onOpenBody={() => { setBodyView('measurements'); setActiveTab('body'); }}
            history={state.history}
            activeWorkout={activeWorkout}
            recoveryItems={state.recoveryItems ?? []}
            queuedMissedPlans={state.queuedMissedPlans ?? []}
            onStartRecovery={async (selections) => { await store.startRecovery(selections); setShowActiveWorkout(true); }}
            onDiscardRecovery={(item) => setConfirmation({ title: 'Descartar esta pendência?', message: `${item.exercise.exerciseName}: ${item.exercise.sets.length} séries serão retiradas da fila. Isso não registra séries feitas nem apaga o histórico. Uma cópia anterior ficará disponível nos Ajustes.`, confirmLabel: 'Descartar pendência', onConfirm: () => store.discardRecovery(item.id) })}
            onQueueMissedPlan={(plan) => setConfirmation({ title: 'Guardar ficha não realizada?', message: `${plan.name}: todos os exercícios desta ficha entrarão na fila da semana atual, sem criar histórico. Use só se não treinou essa ficha nesta semana. Você poderá selecionar apenas parte dela para repor.`, confirmLabel: 'Guardar para escolher depois', onConfirm: () => store.queueMissedPlan(plan.id) })}
            showInstallPrompt={showIosInstallPrompt}
            onStart={(plan) => runAction(openWorkout(plan))}
            onContinue={() => setShowActiveWorkout(true)}
            onGoPlans={() => setActiveTab('plans')}
            onGoHistory={() => setActiveTab('history')}
          />
        ) : null}

        {activeTab === 'plans' ? (
          <PlansScreen
            plans={state.plans}
            activeWorkout={activeWorkout}
            defaultRestSeconds={state.preferences.defaultRestSeconds}
            history={state.history}
            onStart={(plan) => runAction(openWorkout(plan))}
            onSave={store.savePlan}
            onDelete={(id) => runAction(store.deletePlan(id))}
            onDuplicate={(id) => runAction(store.duplicatePlan(id))}
          />
        ) : null}

        {activeTab === 'nutrition' ? <NutritionScreen state={state.nutrition ?? emptyNutrition()} update={store.updateNutrition} history={state.history} /> : null}

        {activeTab === 'history' ? (
          <HistoryScreen
            history={state.history}
            plans={state.plans}
            weightUnit={state.preferences.weightUnit}
            onDelete={(id) => runAction(store.deleteHistory(id))}
            calendarWeek={store.calendarWeek}
            cycle={state.trainingCycle}
            onCycleChange={store.updateCycle}
          />
        ) : null}

        {activeTab === 'body' ? <section className="screen nutrition-screen" aria-labelledby="body-title">
          <header className="screen-heading"><h1 id="body-title">Evolução corporal</h1></header>
          <div className="evolution-tabs" role="group" aria-label="Evolução corporal">
            <button type="button" className={bodyView === 'measurements' ? 'is-active' : ''} aria-pressed={bodyView === 'measurements'} onClick={() => setBodyView('measurements')}>Medidas e gráficos</button>
            <button type="button" className={bodyView === 'photos' ? 'is-active' : ''} aria-pressed={bodyView === 'photos'} onClick={() => setBodyView('photos')}>Evolução fotográfica</button>
          </div>
          {bodyView === 'measurements' ? <BodyPanel state={state.nutrition ?? emptyNutrition()} change={store.updateNutrition} />
            : <PhotoEvolution measurements={state.nutrition?.measurements ?? []} />}
        </section> : null}

        {activeTab === 'wallpaper' ? (
          <WallpaperScreen
            asset={wallpaper.asset}
            url={wallpaper.url}
            loading={wallpaper.loading}
            error={wallpaper.error}
            onSave={wallpaper.save}
            onRemove={wallpaper.remove}
          />
        ) : null}

        {activeTab === 'settings' ? (
          <>
          <button className="button button-secondary button-wide" type="button" onClick={() => setActiveTab('wallpaper')}>Wallpaper · fotos e vídeos animados</button>
          <SettingsScreen
            preferences={state.preferences}
            isStandalone={isStandalone}
            storagePersistent={storagePersistent}
            onPreferencesChange={(patch) => runAction(store.updatePreferences(patch))}
            onExport={() => exportBackup()}
            onExportRecovery={() => exportBackup(true)}
            onRestoreCheckpoint={store.restoreCheckpoint}
            onInstallFullBodyProtocol={store.installFullBodyProtocol}
            onOpenNutritionArchive={() => setActiveTab('nutrition')}
            onImport={async (file) => { await store.importData(file); }}
            onClear={async () => {
              await store.clearData();
              window.location.reload();
            }}
            onRequestPersistence={requestPersistence}
            pushStatus={pushStatus}
            onNotificationPermissionChange={() => setNotificationPermission(getRestNotificationPermission())}
          />
          <ProgressBackup exportJson={store.exportData} onRestore={store.restoreProgressArchive} />
          </>
        ) : null}
        </Suspense>
      </main>

      {activeWorkout ? (
        <ActiveWorkoutDock
          workout={activeWorkout}
          onOpen={() => setShowActiveWorkout(true)}
          onAddRest={(seconds) => runAction(store.addRestSeconds(seconds))}
          onSkipRest={() => runAction(store.skipRest())}
          pushRestMessage={pushStatus.enabled && activeWorkout.restEndsAt ? pushStatus.message : null}
        />
      ) : null}
      <BottomNav activeTab={activeTab} onChange={(tab) => { setRecoveryTarget(null); setActiveTab(tab); }} />
      {completedSummary ? (
        <WorkoutSummaryDialog
          workout={completedSummary.history}
          recovery={completedSummary.recovery}
          previousHistory={state.history.filter((item) => item.id !== completedSummary.history.id)}
          weightUnit={state.preferences.weightUnit}
          onClose={() => setCompletedSummary(null)}
          onViewProgress={() => { setCompletedSummary(null); setActiveTab('history'); }}
          onViewRecovery={(week) => { setCompletedSummary(null); setActiveTab('home'); setRecoveryTarget({ week }); }}
        />
      ) : null}
      <UpdatePrompt workoutInProgress={Boolean(activeWorkout)} saving={store.saving} canReload={store.canReload} />
      {actionDialog}
    </div>
  );
}
