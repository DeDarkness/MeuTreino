import {
  ArrowLeft,
  BellRing,
  Check,
  Clock3,
  Dumbbell,
  Minus,
  Plus,
  SkipForward,
  Trophy,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useNumericDraft } from '../hooks/useNumericDraft';
import { fromStoredWeight, toStoredWeight } from '../lib/format';
import { type RestNotificationPermission } from '../lib/notifications';
import { primeRestAlertAudio } from '../lib/restAlert';
import type {
  ActiveWorkout,
  ActiveWorkoutSet,
  Preferences,
  WorkoutExerciseHistory,
  WorkoutHistory,
} from '../types';
import './active-workout.css';

export interface ActiveWorkoutScreenProps {
  workout: ActiveWorkout;
  preferences: Preferences;
  history: WorkoutHistory[];
  onUpdateSet: (
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<Pick<ActiveWorkoutSet, 'reps' | 'weight'>>,
  ) => void;
  onSelectSet: (exerciseIndex: number, setIndex: number) => void;
  onCompleteSet: () => void;
  onSkipRest: () => void;
  onAddRest: (seconds: number) => void;
  onFinish: () => void;
  onAbandon: () => void;
  onClose: () => void;
  notificationPermission: RestNotificationPermission;
  onRequestNotifications: () => Promise<RestNotificationPermission>;
}

export function ActiveWorkoutScreen({
  workout,
  preferences,
  history,
  onUpdateSet,
  onSelectSet,
  onCompleteSet,
  onSkipRest,
  onAddRest,
  onFinish,
  onAbandon,
  onClose,
  notificationPermission,
  onRequestNotifications,
}: ActiveWorkoutScreenProps) {
  const now = useCurrentTime();
  const currentCardRef = useRef<HTMLElement | null>(null);

  const totalSets = useMemo(
    () => workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0),
    [workout.exercises],
  );
  const completedSets = useMemo(
    () => workout.exercises.reduce(
      (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
      0,
    ),
    [workout.exercises],
  );
  const progress = totalSets === 0 ? 0 : completedSets / totalSets;
  const elapsedSeconds = Math.max(0, Math.floor((now - Date.parse(workout.startedAt)) / 1000));

  const exerciseIndex = clampIndex(workout.currentExerciseIndex, workout.exercises.length);
  const exercise = workout.exercises[exerciseIndex] ?? null;
  const setIndex = clampIndex(workout.currentSetIndex, exercise?.sets.length ?? 0);
  const currentSet = exercise?.sets[setIndex] ?? null;
  const restEndMs = workout.restEndsAt ? Date.parse(workout.restEndsAt) : null;
  const remainingRestSeconds = restEndMs === null || Number.isNaN(restEndMs)
    ? 0
    : Math.max(0, Math.ceil((restEndMs - now) / 1000));
  const isResting = restEndMs !== null && !Number.isNaN(restEndMs) && restEndMs > now;

  const previousSet = useMemo(
    () => findPreviousSet(history, exercise?.exerciseId, exercise?.exerciseName, currentSet?.setNumber),
    [currentSet?.setNumber, exercise?.exerciseId, exercise?.exerciseName, history],
  );

  const completeCurrentSet = () => {
    primeRestAlertAudio(preferences.soundEnabled);
    onCompleteSet();
  };

  const skipRest = () => {
    onSkipRest();
  };

  const selectSet = (nextExerciseIndex: number, nextSetIndex: number) => {
    onSelectSet(nextExerciseIndex, nextSetIndex);
    window.requestAnimationFrame(() => currentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  if (!exercise || !currentSet) {
    return (
      <main className="active-workout active-workout--empty">
        <Trophy aria-hidden="true" size={54} />
        <h1>Treino concluído</h1>
        <p>Todas as séries desta ficha foram registradas.</p>
        <button className="active-workout__primary-button" type="button" onClick={onFinish}>
          Salvar treino
        </button>
      </main>
    );
  }

  return (
    <main className="active-workout">
      <header className="active-workout__header">
        <button className="active-workout__back-button" type="button" aria-label="Voltar sem encerrar o treino" onClick={onClose}>
          <ArrowLeft aria-hidden="true" size={23} />
        </button>
        <div className="active-workout__header-copy">
          <span className="active-workout__eyebrow">TREINO EM ANDAMENTO</span>
          <h1>{workout.planName}</h1>
        </div>
        <div className="active-workout__elapsed" aria-label={`Tempo de treino: ${formatClock(elapsedSeconds)}`}>
          <Clock3 aria-hidden="true" size={17} />
          <time>{formatClock(elapsedSeconds)}</time>
        </div>
      </header>

      <section className="active-workout__progress" aria-label="Progresso do treino">
        <div className="active-workout__progress-copy">
          <span>{completedSets} de {totalSets} séries</span>
          <strong>{Math.round(progress * 100)}%</strong>
        </div>
        <div
          className="active-workout__progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalSets}
          aria-valuenow={completedSets}
        >
          <div className="active-workout__progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <NotificationStatus permission={notificationPermission} onRequest={onRequestNotifications} />
      </section>

      {isResting ? (
        <RestPanel
          remainingSeconds={remainingRestSeconds}
          nextExerciseName={exercise.exerciseName}
          nextSetNumber={currentSet.setNumber}
          totalSets={exercise.sets.length}
          alertSound={preferences.restAlertSound}
          onAddRest={() => onAddRest(15)}
          onSkipRest={skipRest}
        />
      ) : null}

      <section className="active-workout__current-card" ref={currentCardRef}>
        <div className="active-workout__current-heading">
          <div className="active-workout__exercise-number">{exerciseIndex + 1}</div>
          <div>
            <span>EXERCÍCIO {exerciseIndex + 1} DE {workout.exercises.length}</span>
            <h2>{exercise.exerciseName}</h2>
          </div>
          <div className="active-workout__set-pill">Série {currentSet.setNumber}/{exercise.sets.length}</div>
        </div>

        {exercise.notes ? <p className="active-workout__notes">{exercise.notes}</p> : null}

        {previousSet ? (
          <div className="active-workout__last-hint">
            <Clock3 aria-hidden="true" size={16} />
            <span>Último treino:</span>
            <strong>{previousSet.reps} reps{previousSet.weight === null ? '' : ` · ${formatWeight(fromStoredWeight(previousSet.weight, preferences.weightUnit) ?? 0)} ${preferences.weightUnit}`}</strong>
          </div>
        ) : (
          <div className="active-workout__last-hint active-workout__last-hint--muted">
            Primeira vez registrada para esta série
          </div>
        )}

        <div className="active-workout__controls-grid">
          <SetControl
            label="Repetições"
            value={currentSet.reps}
            step={1}
            min={0}
            inputMode="numeric"
            onChange={(value) => onUpdateSet(exerciseIndex, setIndex, { reps: Math.round(value) })}
          />
          <SetControl
            label={`Carga (${preferences.weightUnit})`}
            value={fromStoredWeight(currentSet.weight, preferences.weightUnit) ?? 0}
            step={0.5}
            min={0}
            inputMode="decimal"
            onChange={(value) => onUpdateSet(exerciseIndex, setIndex, { weight: toStoredWeight(value, preferences.weightUnit) })}
          />
        </div>

        {currentSet.completed ? (
          <div className="active-workout__completed-set-status"><Check aria-hidden="true" size={19} /> Série concluída · valores ainda editáveis</div>
        ) : (
            <button className="active-workout__complete-button" type="button" onClick={completeCurrentSet}>
              <Check aria-hidden="true" size={25} strokeWidth={3} /> Concluir série
            </button>
        )}

        {completedSets === totalSets ? (
          <div className="active-workout__finished-inline">
            <Trophy aria-hidden="true" size={42} />
            <h2>Treino concluído!</h2>
            <p>Revise as cargas ou salve as {totalSets} séries no histórico.</p>
            <button className="active-workout__complete-button" type="button" onClick={onFinish}>
              <Check aria-hidden="true" size={24} strokeWidth={3} /> Salvar no histórico
            </button>
          </div>
        ) : null}
      </section>

      <section className="active-workout__summary" aria-labelledby="workout-summary-title">
        <div className="active-workout__section-title">
          <Dumbbell aria-hidden="true" size={20} />
          <div><h2 id="workout-summary-title">Séries do treino</h2><p>Toque em qualquer série para editar carga e repetições.</p></div>
        </div>
        <div className="active-workout__exercise-list">
          {workout.exercises.map((item, itemExerciseIndex) => {
            const itemCompleted = item.sets.filter((set) => set.completed).length;
            const isCurrent = itemExerciseIndex === exerciseIndex;
            return (
              <article className={`active-workout__exercise-row${isCurrent ? ' is-current' : ''}`} key={item.exerciseId}>
                <div className="active-workout__exercise-row-copy">
                  <span>{itemExerciseIndex + 1}</span>
                  <div>
                    <h3>{item.exerciseName}</h3>
                    <p>{itemCompleted}/{item.sets.length} séries concluídas</p>
                  </div>
                </div>
                <div className="active-workout__set-dots" aria-label={`${itemCompleted} de ${item.sets.length} séries concluídas`}>
                  {item.sets.map((set, itemSetIndex) => (
                    <button
                      className={`${set.completed ? 'is-complete' : ''}${isCurrent && itemSetIndex === setIndex ? ' is-selected' : ''}`}
                      type="button"
                      aria-label={`Editar ${item.exerciseName}, série ${set.setNumber}`}
                      aria-current={isCurrent && itemSetIndex === setIndex ? 'step' : undefined}
                      key={set.id}
                      onClick={() => selectSet(itemExerciseIndex, itemSetIndex)}
                    >
                      {set.completed ? <Check aria-hidden="true" size={13} strokeWidth={3} /> : set.setNumber}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="active-workout__footer">
        <button className="active-workout__finish-button" type="button" onClick={onFinish}>
          <Trophy aria-hidden="true" size={20} />
          Finalizar e salvar
        </button>
        <button className="active-workout__abandon-button" type="button" onClick={onAbandon}>
          <X aria-hidden="true" size={18} />
          Abandonar treino
        </button>
      </footer>

    </main>
  );
}

function SetControl({
  label,
  value,
  step,
  min,
  inputMode,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  inputMode: 'numeric' | 'decimal';
  onChange: (value: number) => void;
}) {
  const numeric = useNumericDraft({ value, min, step, integer: inputMode === 'numeric', onChange });

  return (
    <div className="active-workout__set-control">
      <label>{label}</label>
      <div className="active-workout__stepper">
        <button type="button" aria-label={`Diminuir ${label}`} onClick={numeric.decrement}>
          <Minus aria-hidden="true" size={24} strokeWidth={2.5} />
        </button>
        <input
          aria-label={label}
          inputMode={inputMode}
          type="text"
          pattern={inputMode === 'numeric' ? '[0-9]*' : '[0-9]*[.,]?[0-9]*'}
          value={numeric.draft}
          onFocus={numeric.onFocus}
          onBlur={numeric.onBlur}
          onChange={(event) => numeric.onDraftChange(event.target.value)}
        />
        <button type="button" aria-label={`Aumentar ${label}`} onClick={numeric.increment}>
          <Plus aria-hidden="true" size={24} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

function NotificationStatus({
  permission,
  onRequest,
}: {
  permission: RestNotificationPermission;
  onRequest: () => Promise<RestNotificationPermission>;
}) {
  if (permission === 'granted') {
    return <div className="active-workout__notification-status is-active"><BellRing aria-hidden="true" size={15} /> Avisos do iPhone ativados</div>;
  }
  if (permission === 'default') {
    return (
      <button className="active-workout__notification-status" type="button" onClick={() => void onRequest()}>
        <BellRing aria-hidden="true" size={15} /> Ativar avisos de descanso
      </button>
    );
  }
  return (
    <div className="active-workout__notification-status">
      <BellRing aria-hidden="true" size={15} />
      {permission === 'denied' ? 'Avisos bloqueados nos Ajustes do iPhone' : 'Instale o app para ativar notificações'}
    </div>
  );
}

function RestPanel({
  remainingSeconds,
  nextExerciseName,
  nextSetNumber,
  totalSets,
  alertSound,
  onAddRest,
  onSkipRest,
}: {
  remainingSeconds: number;
  nextExerciseName: string;
  nextSetNumber: number;
  totalSets: number;
  alertSound: Preferences['restAlertSound'];
  onAddRest: () => void;
  onSkipRest: () => void;
}) {
  return (
    <aside className="active-workout__rest" role="status" aria-label="Tempo de descanso">
      <div className="active-workout__rest-glow" />
      <div className="active-workout__rest-content">
        <div className="active-workout__rest-top">
          <div className="active-workout__rest-icon"><BellRing aria-hidden="true" size={24} /></div>
          <div className="active-workout__rest-copy">
            <span className="active-workout__rest-eyebrow">DESCANSO EM ANDAMENTO</span>
            <p className="active-workout__rest-message">Pode navegar e editar o treino.</p>
          </div>
          <time className="active-workout__rest-time" aria-label={`${remainingSeconds} segundos restantes`}>
            {formatRestClock(remainingSeconds)}
          </time>
        </div>

        <div className="active-workout__rest-next">
          <span>PRÓXIMA</span>
          <div><strong>{nextExerciseName}</strong><p>Série {nextSetNumber} de {totalSets}</p></div>
        </div>

        <div className="active-workout__rest-actions">
          <button type="button" onClick={onAddRest}>
            <Plus aria-hidden="true" size={21} />
            15 segundos
          </button>
          <button className="is-primary" type="button" onClick={onSkipRest}>
            <SkipForward aria-hidden="true" size={21} />
            Pular descanso
          </button>
        </div>

        <p className="active-workout__rest-notice">
          Continue usando o MeuTreino normalmente. O aviso {alertSound === 'bell' ? 'de sino' : 'sonoro'} e a notificação serão disparados ao chegar a zero.
        </p>
      </div>
    </aside>
  );
}

function useCurrentTime() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    const interval = window.setInterval(updateNow, 250);
    document.addEventListener('visibilitychange', updateNow);
    window.addEventListener('focus', updateNow);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', updateNow);
      window.removeEventListener('focus', updateNow);
    };
  }, []);

  return now;
}

function findPreviousSet(
  history: WorkoutHistory[],
  exerciseId?: string,
  exerciseName?: string,
  setNumber?: number,
) {
  if (!exerciseId || !exerciseName || setNumber === undefined) return null;

  const sortedHistory = [...history].sort(
    (left, right) => Date.parse(right.finishedAt) - Date.parse(left.finishedAt),
  );
  for (const item of sortedHistory) {
    const matchedExercise = item.exercises.find(
      (candidate) => candidate.exerciseId === exerciseId || normalized(candidate.exerciseName) === normalized(exerciseName),
    );
    if (!matchedExercise) continue;
    return matchedExercise.sets.find((set) => set.setNumber === setNumber)
      ?? lastSet(matchedExercise);
  }
  return null;
}

function lastSet(exercise: WorkoutExerciseHistory) {
  return exercise.sets.length > 0 ? exercise.sets[exercise.sets.length - 1] : null;
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR');
}

function clampIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return Math.min(Math.max(0, index), length - 1);
}

function formatWeight(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

function formatClock(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatRestClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
