import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ActiveWorkoutDock } from './components/ActiveWorkoutDock';
import { ActionDialog, type ActionConfirmation } from './components/ActionDialog';
import { AppStatus } from './components/AppStatus';
import { exportSafetySnapshot } from './lib/database';
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
import { localWeekKey, remainingSetCount } from './lib/recovery';
import { ActiveWorkoutScreen } from './screens/ActiveWorkoutScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PlansScreen } from './screens/PlansScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { WallpaperScreen } from './screens/WallpaperScreen';
import type { ActiveWorkoutSet, WorkoutHistory, WorkoutPlan } from './types';
import { NutritionScreen } from './nutrition/NutritionScreen';
import { BodyPanel } from './nutrition/BodyPanel';
import { emptyNutrition } from './nutrition/engine';

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
  const [completedSummary, setCompletedSummary] = useState<WorkoutHistory | null>(null);
  const [confirmation, setConfirmation] = useState<ActionConfirmation | null>(null);
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
      void enablePushNotifications().catch(() => undefined).finally(() => setNotificationPermission(getRestNotificationPermission()));
    }
    if (state.activeWorkout) {
      if (state.activeWorkout.planId !== plan.id) return;
      setShowActiveWorkout(true);
      return;
    }
    const start = async () => { await store.startWorkout(plan.id); setShowActiveWorkout(true); };
    if (state.recoveryItems?.some((item) => item.sourcePlanId === plan.id && item.weekStart === localWeekKey())) {
      setConfirmation({ title: 'Iniciar a ficha inteira novamente?', message: 'Esta ficha já tem séries pendentes nesta semana. Iniciar outra sessão completa não substitui essas pendências. Para continuar só o que faltou, volte ao Início e use Reposição da semana.', confirmLabel: 'Iniciar nova sessão completa', onConfirm: start });
      return;
    }
    await start();
  };

  const exportBackup = async (recovery = false) => {
    const json = recovery ? await exportSafetySnapshot() : await store.exportData();
    const date = new Date().toISOString().slice(0, 10);
    const file = new File([json], `meutreino-${recovery ? 'recuperacao' : 'backup'}-${date}.json`, { type: 'application/json' });
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
            const remaining = remainingSetCount(activeWorkout);
            setConfirmation({ title: 'Encerrar esta sessão?',
              message: `${completedSets ? `${completedSets} ${completedSets === 1 ? 'série será registrada' : 'séries serão registradas'} no histórico.` : 'Nenhuma série foi concluída: não será criado um treino no histórico.'} ${remaining ? `${remaining} ${remaining === 1 ? 'série não concluída fica' : 'séries não concluídas, inclusive exercícios pulados, ficam'} na fila para escolher outro dia.` : 'Todas as séries foram concluídas.'} Você decide se e quando repor.`,
              confirmLabel: 'Encerrar e salvar', onConfirm: async () => {
                const saved = await store.finishWorkout();
                setShowActiveWorkout(false);
                setActiveTab(saved.exercises.length ? 'history' : 'home');
                setCompletedSummary(saved.exercises.length ? saved : null);
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
        <UpdatePrompt workoutInProgress />
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
            <button type="button" aria-label="Fechar aviso" onClick={store.clearError}>×</button>
          </div>
        ) : null}

        {activeTab === 'home' ? (
          <HomeScreen
            plans={state.plans}
            nutrition={state.nutrition}
            onOpenNutrition={() => setActiveTab('nutrition')}
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

        {activeTab === 'history' ? <>
          <section className="nutrition-screen"><BodyPanel state={state.nutrition ?? emptyNutrition()} change={store.updateNutrition} /></section>
          <HistoryScreen
            history={state.history}
            plans={state.plans}
            weightUnit={state.preferences.weightUnit}
            onDelete={(id) => runAction(store.deleteHistory(id))}
          />
        </> : null}

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
            onInstallPreSurgicalProtocol={store.installPreSurgicalProtocol}
            onImport={async (file) => { if (file.size > 25 * 1024 * 1024) throw new Error('Use um backup JSON de até 25 MB.'); await store.importData(await file.text()); }}
            onClear={async () => {
              await Promise.all([store.clearData(), wallpaper.remove()]);
              setActiveTab('home');
            }}
            onRequestPersistence={requestPersistence}
            pushStatus={pushStatus}
            onNotificationPermissionChange={() => setNotificationPermission(getRestNotificationPermission())}
          />
          </>
        ) : null}
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
      <UpdatePrompt workoutInProgress={Boolean(activeWorkout)} />
      {actionDialog}
    </div>
  );
}
