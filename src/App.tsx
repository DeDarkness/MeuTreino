import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ActiveWorkoutDock } from './components/ActiveWorkoutDock';
import { BottomNav, type AppTab } from './components/BottomNav';
import { UpdatePrompt } from './components/UpdatePrompt';
import { WallpaperBackdrop } from './components/WallpaperBackdrop';
import { WorkoutSummaryDialog } from './components/WorkoutSummaryDialog';
import { useWallpaper } from './hooks/useWallpaper';
import { useRestAlert } from './hooks/useRestAlert';
import { useWorkoutStore } from './hooks/useWorkoutStore';
import { getRestNotificationPermission, requestRestNotificationPermission, type RestNotificationPermission } from './lib/notifications';
import { ActiveWorkoutScreen } from './screens/ActiveWorkoutScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PlansScreen } from './screens/PlansScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { WallpaperScreen } from './screens/WallpaperScreen';
import type { ActiveWorkoutSet, WorkoutHistory, WorkoutPlan } from './types';

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export default function App() {
  const store = useWorkoutStore();
  const wallpaper = useWallpaper();
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [showActiveWorkout, setShowActiveWorkout] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<RestNotificationPermission>(() => getRestNotificationPermission());
  const [completedSummary, setCompletedSummary] = useState<WorkoutHistory | null>(null);
  const runAction = (operation: Promise<unknown>) => { void operation.catch(() => undefined); };

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
  useRestAlert(activeWorkout, state?.preferences ?? null, store.skipRest);
  const completedSets = useMemo(
    () => activeWorkout?.exercises.reduce(
      (total, exercise) => total + (exercise.skipped ? 0 : exercise.sets.filter((set) => set.completed).length),
      0,
    ) ?? 0,
    [activeWorkout],
  );
  const totalSets = useMemo(
    () => activeWorkout?.exercises.reduce((total, exercise) => total + (exercise.skipped ? 0 : exercise.sets.length), 0) ?? 0,
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
          <button className="text-button danger" type="button" onClick={() => {
            if (!window.confirm('Apagar os dados locais com problema e recomeçar sem treinos?')) return;
            void store.clearData().then(() => window.location.reload()).catch(() => undefined);
          }}>
            Apagar dados locais e recomeçar
          </button>
        </div>
      </main>
    );
  }

  const openWorkout = async (plan: WorkoutPlan) => {
    if (isStandalone && notificationPermission === 'default') {
      const permission = await requestRestNotificationPermission();
      setNotificationPermission(permission);
    }
    if (state.activeWorkout) {
      if (state.activeWorkout.planId !== plan.id) return;
      setShowActiveWorkout(true);
      return;
    }
    await store.startWorkout(plan.id);
    setShowActiveWorkout(true);
  };

  const exportBackup = async () => {
    const json = await store.exportData();
    const date = new Date().toISOString().slice(0, 10);
    const file = new File([json], `meutreino-backup-${date}.json`, { type: 'application/json' });
    const shareNavigator = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };

    if (shareNavigator.share && shareNavigator.canShare?.({ files: [file] })) {
      await shareNavigator.share({
        title: 'Backup do MeuTreino',
        text: 'Backup local dos meus treinos.',
        files: [file],
      });
      return;
    }

    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const requestPersistence = async () => {
    if (!navigator.storage?.persist) return false;
    const granted = await navigator.storage.persist();
    setStoragePersistent(granted);
    return granted;
  };

  const requestNotifications = async () => {
    const permission = await requestRestNotificationPermission();
    setNotificationPermission(permission);
    return permission;
  };

  if (showActiveWorkout && activeWorkout) {
    return (
      <div className={`app-shell active-mode${wallpaper.asset ? ' has-wallpaper' : ''}`}>
        <WallpaperBackdrop asset={wallpaper.asset} url={wallpaper.url} />
        {store.error ? (
          <div className="global-error active-error" role="alert">
            <AlertTriangle size={18} />
            <span>{store.error}</span>
            <button type="button" aria-label="Fechar aviso" onClick={store.clearError}>×</button>
          </div>
        ) : null}
        <ActiveWorkoutScreen
          workout={activeWorkout}
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
          onCompleteSet={() => {
            const exercise = activeWorkout.exercises[activeWorkout.currentExerciseIndex];
            const set = exercise?.sets[activeWorkout.currentSetIndex];
            if (!exercise || !set) return;
            runAction(store.completeSet(exercise.exerciseId, set.id));
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
            if (completedSets === 0) {
              window.alert('Conclua pelo menos uma série antes de salvar o treino.');
              return;
            }
            if (completedSets < totalSets && !window.confirm(`Você concluiu ${completedSets} de ${totalSets} séries. Finalizar e salvar mesmo assim?`)) return;
            void store.finishWorkout().then((saved) => {
              setShowActiveWorkout(false);
              setActiveTab('history');
              setCompletedSummary(saved);
            }).catch(() => undefined);
          }}
          onAbandon={() => {
            if (!window.confirm('Abandonar este treino? As séries desta sessão não serão adicionadas ao histórico.')) return;
            void store.abandonWorkout().then(() => setShowActiveWorkout(false)).catch(() => undefined);
          }}
          onClose={() => setShowActiveWorkout(false)}
          notificationPermission={notificationPermission}
          onRequestNotifications={requestNotifications}
        />
        <BottomNav
          activeTab={null}
          onChange={(tab) => {
            setActiveTab(tab);
            setShowActiveWorkout(false);
          }}
        />
        <UpdatePrompt />
      </div>
    );
  }

  return (
    <div className={`app-shell${wallpaper.asset ? ' has-wallpaper' : ''}${activeWorkout ? ' has-active-workout' : ''}`}>
      <WallpaperBackdrop asset={wallpaper.asset} url={wallpaper.url} />
      <main className="app-content">
        {store.error ? (
          <div className="global-error" role="alert">
            <AlertTriangle size={18} />
            <span>{store.error}</span>
            <button type="button" aria-label="Fechar aviso" onClick={store.clearError}>×</button>
          </div>
        ) : null}

        {activeTab === 'home' ? (
          <HomeScreen
            plans={state.plans}
            history={state.history}
            activeWorkout={activeWorkout}
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
            onStart={(plan) => runAction(openWorkout(plan))}
            onSave={(plan) => runAction(store.savePlan(plan))}
            onDelete={(id) => runAction(store.deletePlan(id))}
            onDuplicate={(id) => runAction(store.duplicatePlan(id))}
          />
        ) : null}

        {activeTab === 'history' ? (
          <HistoryScreen
            history={state.history}
            plans={state.plans}
            weightUnit={state.preferences.weightUnit}
            onDelete={(id) => runAction(store.deleteHistory(id))}
          />
        ) : null}

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
          <SettingsScreen
            preferences={state.preferences}
            isStandalone={isStandalone}
            storagePersistent={storagePersistent}
            onPreferencesChange={(patch) => runAction(store.updatePreferences(patch))}
            onExport={exportBackup}
            onImport={async (file) => { await store.importData(await file.text()); }}
            onClear={async () => {
              await Promise.all([store.clearData(), wallpaper.remove()]);
              setActiveTab('home');
            }}
            onRequestPersistence={requestPersistence}
            notificationPermission={notificationPermission}
            onRequestNotifications={requestNotifications}
          />
        ) : null}
      </main>

      {activeWorkout ? (
        <ActiveWorkoutDock
          workout={activeWorkout}
          onOpen={() => setShowActiveWorkout(true)}
          onAddRest={(seconds) => runAction(store.addRestSeconds(seconds))}
          onSkipRest={() => runAction(store.skipRest())}
        />
      ) : null}
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
      {completedSummary ? (
        <WorkoutSummaryDialog
          workout={completedSummary}
          previousHistory={state.history.filter((item) => item.id !== completedSummary.id)}
          weightUnit={state.preferences.weightUnit}
          onClose={() => setCompletedSummary(null)}
          onViewProgress={() => { setCompletedSummary(null); setActiveTab('history'); }}
        />
      ) : null}
      <UpdatePrompt />
    </div>
  );
}
