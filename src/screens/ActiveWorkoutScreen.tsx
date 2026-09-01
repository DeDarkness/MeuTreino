import {
  ArrowLeft,
  BellRing,
  Check,
  Clock3,
  Dumbbell,
  Minus,
  Plus,
  SkipForward,
  Smartphone,
  Trophy,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fromStoredWeight, toStoredWeight } from '../lib/format';
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
  onCompleteSet: () => void;
  onSkipRest: () => void;
  onAddRest: (seconds: number) => void;
  onFinish: () => void;
  onAbandon: () => void;
  onClose: () => void;
}

interface WakeLockSentinelLike extends EventTarget {
  readonly released: boolean;
  release: () => Promise<void>;
}

type AudioContextConstructor = typeof AudioContext;

export function ActiveWorkoutScreen({
  workout,
  preferences,
  history,
  onUpdateSet,
  onCompleteSet,
  onSkipRest,
  onAddRest,
  onFinish,
  onAbandon,
  onClose,
}: ActiveWorkoutScreenProps) {
  const now = useCurrentTime();
  const audioContextRef = useRef<AudioContext | null>(null);
  const alertedRestRef = useRef<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);

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

  const requestWakeLock = useCallback(async () => {
    const wakeLockApi = (navigator as unknown as {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    }).wakeLock;
    if (!wakeLockApi || document.visibilityState !== 'visible' || wakeLockRef.current) return;

    try {
      const sentinel = await wakeLockApi.request('screen');
      wakeLockRef.current = sentinel;
      setWakeLockActive(true);
      sentinel.addEventListener('release', () => {
        if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
        setWakeLockActive(false);
      }, { once: true });
    } catch {
      setWakeLockActive(false);
    }
  }, []);

  useEffect(() => {
    const initialRequest = window.setTimeout(() => void requestWakeLock(), 0);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearTimeout(initialRequest);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      const sentinel = wakeLockRef.current;
      wakeLockRef.current = null;
      if (sentinel && !sentinel.released) void sentinel.release();
    };
  }, [requestWakeLock]);

  useEffect(() => {
    if (!workout.restEndsAt || restEndMs === null || Number.isNaN(restEndMs)) {
      alertedRestRef.current = null;
      return;
    }
    if (now < restEndMs || alertedRestRef.current === workout.restEndsAt) return;

    alertedRestRef.current = workout.restEndsAt;
    if (preferences.soundEnabled) playRestAlert(audioContextRef, preferences.restAlertSound);
    if (preferences.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate([180, 90, 180, 90, 260]);
    }
    onSkipRest();
  }, [now, onSkipRest, preferences.restAlertSound, preferences.soundEnabled, preferences.vibrationEnabled, restEndMs, workout.restEndsAt]);

  const primeAudio = useCallback(() => {
    if (!preferences.soundEnabled) return;
    const context = getAudioContext(audioContextRef);
    if (context?.state === 'suspended') void context.resume();
  }, [preferences.soundEnabled]);

  const completeCurrentSet = () => {
    primeAudio();
    void requestWakeLock();
    onCompleteSet();
  };

  const skipRest = () => {
    alertedRestRef.current = workout.restEndsAt;
    onSkipRest();
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

  if (isResting) {
    return (
      <RestOverlay
        remainingSeconds={remainingRestSeconds}
        nextExerciseName={exercise.exerciseName}
        nextSetNumber={currentSet.setNumber}
        totalSets={exercise.sets.length}
        alertSound={preferences.restAlertSound}
        onAddRest={() => onAddRest(15)}
        onSkipRest={skipRest}
      />
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
        <div className={`active-workout__wake-status${wakeLockActive ? ' is-active' : ''}`}>
          <Smartphone aria-hidden="true" size={15} />
          {wakeLockActive ? 'Tela mantida ativa' : 'A tela pode apagar para economizar bateria'}
        </div>
      </section>

      <section className="active-workout__current-card">
        <div className="active-workout__current-heading">
          <div className="active-workout__exercise-number">{exerciseIndex + 1}</div>
          <div>
            <span>EXERCÍCIO {exerciseIndex + 1} DE {workout.exercises.length}</span>
            <h2>{exercise.exerciseName}</h2>
          </div>
          <div className="active-workout__set-pill">Série {currentSet.setNumber}/{exercise.sets.length}</div>
        </div>

        {exercise.notes ? <p className="active-workout__notes">{exercise.notes}</p> : null}

        {completedSets === totalSets ? (
          <div className="active-workout__finished-inline">
            <Trophy aria-hidden="true" size={42} />
            <h2>Treino concluído!</h2>
            <p>Você completou todas as {totalSets} séries.</p>
            <button className="active-workout__complete-button" type="button" onClick={onFinish}>
              <Check aria-hidden="true" size={24} strokeWidth={3} /> Salvar no histórico
            </button>
          </div>
        ) : (
          <>
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

            <button className="active-workout__complete-button" type="button" onClick={completeCurrentSet}>
              <Check aria-hidden="true" size={25} strokeWidth={3} /> Concluir série
            </button>
          </>
        )}
      </section>

      <section className="active-workout__summary" aria-labelledby="workout-summary-title">
        <div className="active-workout__section-title">
          <Dumbbell aria-hidden="true" size={20} />
          <h2 id="workout-summary-title">Resumo do treino</h2>
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
                  {item.sets.map((set) => (
                    <span className={set.completed ? 'is-complete' : ''} key={set.id}>
                      {set.completed ? <Check aria-hidden="true" size={13} strokeWidth={3} /> : set.setNumber}
                    </span>
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
  const setValue = (next: number) => onChange(Math.max(min, roundToStep(next, step)));

  return (
    <div className="active-workout__set-control">
      <label>{label}</label>
      <div className="active-workout__stepper">
        <button type="button" aria-label={`Diminuir ${label}`} onClick={() => setValue(value - step)}>
          <Minus aria-hidden="true" size={24} strokeWidth={2.5} />
        </button>
        <input
          aria-label={label}
          inputMode={inputMode}
          min={min}
          step={step}
          type="number"
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) setValue(next);
          }}
        />
        <button type="button" aria-label={`Aumentar ${label}`} onClick={() => setValue(value + step)}>
          <Plus aria-hidden="true" size={24} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

function RestOverlay({
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
    <aside className="active-workout__rest" role="dialog" aria-modal="true" aria-label="Tempo de descanso">
      <div className="active-workout__rest-glow" />
      <div className="active-workout__rest-content">
        <div className="active-workout__rest-icon">
          <BellRing aria-hidden="true" size={28} />
        </div>
        <span className="active-workout__rest-eyebrow">DESCANSO</span>
        <time className="active-workout__rest-time" aria-label={`${remainingSeconds} segundos restantes`}>
          {formatRestClock(remainingSeconds)}
        </time>
        <p className="active-workout__rest-message">Respire. Recupere. Volte mais forte.</p>

        <div className="active-workout__rest-next">
          <span>PRÓXIMA</span>
          <strong>{nextExerciseName}</strong>
          <p>Série {nextSetNumber} de {totalSets}</p>
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
          O alerta {alertSound === 'bell' ? 'de sino' : 'sonoro'} depende deste app continuar aberto. O iPhone pode suspender sons se você bloquear a tela ou trocar de aplicativo.
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

function roundToStep(value: number, step: number) {
  const decimals = step.toString().split('.')[1]?.length ?? 0;
  return Number((Math.round(value / step) * step).toFixed(decimals));
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

function getAudioContext(ref: { current: AudioContext | null }) {
  if (ref.current) return ref.current;
  const windowWithWebkit = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
  const Context = window.AudioContext ?? windowWithWebkit.webkitAudioContext;
  if (!Context) return null;
  ref.current = new Context();
  return ref.current;
}

function playRestAlert(
  ref: { current: AudioContext | null },
  sound: Preferences['restAlertSound'],
) {
  const context = getAudioContext(ref);
  if (!context) return;

  const start = () => {
    if (sound === 'bell') {
      playTone(context, 784, 0, 0.85, 'sine', 0.28);
      playTone(context, 1175, 0.02, 1.1, 'sine', 0.12);
      playTone(context, 1568, 0.04, 0.7, 'sine', 0.06);
      return;
    }
    playTone(context, 880, 0, 0.18, 'square', 0.16);
    playTone(context, 1047, 0.27, 0.22, 'square', 0.16);
    playTone(context, 1319, 0.57, 0.3, 'square', 0.18);
  };

  if (context.state === 'suspended') {
    void context.resume().then(start).catch(() => undefined);
  } else {
    start();
  }
}

function playTone(
  context: AudioContext,
  frequency: number,
  delay: number,
  duration: number,
  type: OscillatorType,
  volume: number,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startsAt = context.currentTime + delay;
  const endsAt = startsAt + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startsAt);
  gain.gain.setValueAtTime(0.0001, startsAt);
  gain.gain.exponentialRampToValueAtTime(volume, startsAt + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startsAt);
  oscillator.stop(endsAt + 0.02);
}
