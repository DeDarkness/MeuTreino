import {
  ArrowRight,
  Dumbbell,
  Flame,
  Play,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { formatDate, greeting, todayLabel } from '../lib/format';
import { WeeklyDashboard } from '../components/WeeklyDashboard';
import { getSuggestedPlanId } from '../lib/starterPlans';
import { canUseExpress, getModeExercises, plannedSets, type TrainingMode } from '../lib/trainingModes';
import type { ActiveWorkout, Exercise, WorkoutHistory, WorkoutPlan, Preferences } from '../types';

type HomeScreenProps = {
  plans: WorkoutPlan[];
  history: WorkoutHistory[];
  activeWorkout: ActiveWorkout | null;
  showInstallPrompt: boolean;
  weeklyPlanModes: Preferences['weeklyPlanModes'];
  onModesChange: (modes: Record<string, TrainingMode>) => void;
  onStart: (plan: WorkoutPlan, mode?: TrainingMode) => void;
  onContinue: () => void;
  onGoPlans: () => void;
  onGoHistory: () => void;
};

const WORKOUT_DAYS = [
  { planId: 'plan-full-body-a', short: 'SEG', label: 'Segunda', workout: 'A' },
  { planId: 'plan-full-body-b', short: 'QUA', label: 'Quarta', workout: 'B' },
  { planId: 'plan-full-body-c', short: 'SEX', label: 'Sexta', workout: 'C' },
] as const;

export function HomeScreen({
  plans,
  history,
  activeWorkout,
  showInstallPrompt,
  weeklyPlanModes,
  onModesChange,
  onStart,
  onContinue,
  onGoPlans,
  onGoHistory,
}: HomeScreenProps) {
  const todayPlanId = getSuggestedPlanId();
  const [selectedPlanId, setSelectedPlanId] = useState(() =>
    plans.some((plan) => plan.id === todayPlanId) ? todayPlanId : (plans[0]?.id ?? ''),
  );

  const sortedHistory = useMemo(
    () => [...history].sort((left, right) => Date.parse(right.finishedAt) - Date.parse(left.finishedAt)),
    [history],
  );
  const lastWorkout = sortedHistory[0];
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId)
    ?? plans.find((plan) => plan.id === todayPlanId)
    ?? plans[0];
  const selectedDay = WORKOUT_DAYS.find((day) => day.planId === selectedPlan?.id);
  const availableDays = WORKOUT_DAYS.filter((day) => plans.some((plan) => plan.id === day.planId));
  const expressAvailable = selectedPlan ? canUseExpress(selectedPlan) : false;
  const selectedMode = expressAvailable ? activeWorkout?.planId === selectedPlan?.id
    ? activeWorkout.trainingMode ?? (activeWorkout.planName.endsWith(' · Express') ? 'express' : 'complete')
    : weeklyPlanModes?.[selectedPlan!.id] ?? 'complete' : 'complete';
  const selectedSets = selectedPlan ? plannedSets(selectedPlan, selectedMode) : 0;
  const completed = activeWorkout?.exercises.reduce(
    (total, item) => total + (item.skipped ? 0 : item.sets.filter((set) => set.completed).length),
    0,
  ) ?? 0;
  const total = activeWorkout?.exercises.reduce((sum, item) => sum + (item.skipped ? 0 : item.sets.length), 0) ?? 0;
  const selectedWorkoutIsActive = Boolean(activeWorkout && activeWorkout.planId === selectedPlan?.id);
  const anotherWorkoutIsActive = Boolean(activeWorkout && !selectedWorkoutIsActive);

  return (
    <section className="screen home-screen home-screen--premium" aria-labelledby="home-title">
      <header className="screen-heading home-heading">
        <div>
          <span className="elite-release-badge">MEUTREINO <b>ELITE 7</b></span>
          <p className="eyebrow">{todayLabel()}</p>
          <h1 id="home-title">{greeting()} 👋</h1>
          <p>Qual treino vamos encarar hoje?</p>
        </div>
        <div className="brand-mark brand-mark--alive" aria-label="MeuTreino"><span>M</span></div>
      </header>

      {activeWorkout ? (
        <article className="hero-card active-hero home-active-card">
          <div className="live-label"><span /> Treino em andamento</div>
          <h2>{activeWorkout.planName}</h2>
          <p>{completed} de {total} séries concluídas</p>
          <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed}>
            <div style={{ width: `${total ? (completed / total) * 100 : 0}%` }} />
          </div>
          <button className="button button-primary button-wide button-kinetic" type="button" onClick={onContinue}>
            <Play size={20} fill="currentColor" /> Continuar treino
          </button>
        </article>
      ) : null}

      {availableDays.length > 0 ? (
        <section className="day-picker" aria-labelledby="day-picker-title">
          <div className="section-title-row day-picker__heading">
            <div><p className="eyebrow">Sua semana</p><h2 id="day-picker-title">Escolha o treino</h2></div>
            <Sparkles aria-hidden="true" size={20} />
          </div>
          <div className="day-picker__track" role="tablist" aria-label="Dias de treino">
            {availableDays.map((day) => {
              const selected = day.planId === selectedPlan?.id;
              const inProgress = activeWorkout?.planId === day.planId;
              return (
                <button
                  className={`day-picker__button${selected ? ' is-selected' : ''}${inProgress ? ' is-active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="selected-workout"
                  aria-label={`Selecionar treino de ${day.label}`}
                  key={day.planId}
                  onClick={() => setSelectedPlanId(day.planId)}
                >
                  <span>{day.short}</span><strong>{day.workout}</strong>
                  {inProgress ? <i aria-label="Em andamento" /> : null}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {selectedPlan ? (
        <article className="hero-card workout-hero day-workout-hero" id="selected-workout" role="tabpanel" key={selectedPlan.id}>
          <div className="hero-icon hero-icon--pulse"><Dumbbell size={29} /></div>
          <p className="eyebrow">{selectedDay?.label ?? 'Treino escolhido'}</p>
          <h2>{selectedPlan.name}</h2>
          <p className="day-workout-hero__name">{selectedPlan.notes || 'Seu próximo passo começa aqui.'}</p>
          {expressAvailable && !activeWorkout ? (
            <div className="elite-mode-picker" role="group" aria-label="Duração do treino">
              <button type="button" className={selectedMode === 'complete' ? 'is-selected' : ''} aria-pressed={selectedMode === 'complete'} onClick={() => onModesChange({ ...weeklyPlanModes, [selectedPlan.id]: 'complete' })}>Completo · {plannedSets(selectedPlan)} séries</button>
              <button type="button" className={selectedMode === 'express' ? 'is-selected' : ''} aria-pressed={selectedMode === 'express'} onClick={() => onModesChange({ ...weeklyPlanModes, [selectedPlan.id]: 'express' })}>Express · {plannedSets(selectedPlan, 'express')} séries</button>
            </div>
          ) : null}
          <div className="hero-meta">
            <span><Dumbbell size={16} /> {getModeExercises(selectedPlan, selectedMode).length} exercícios</span>
            <span><Flame size={16} /> {selectedSets} séries</span>
          </div>

          <div className="workout-preview" aria-label="Primeiros exercícios">
            {getModeExercises(selectedPlan, selectedMode).slice(0, 3).map((exercise, index) => (
              <div className="workout-preview__row" key={exercise.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{exercise.name}</strong>
                <small>{exercise.targetSets}×{repTarget(exercise)}</small>
              </div>
            ))}
            {getModeExercises(selectedPlan, selectedMode).length > 3 ? <div className="workout-preview__more">+ {getModeExercises(selectedPlan, selectedMode).length - 3} exercícios</div> : null}
          </div>

          <button
            className="button button-primary button-wide button-kinetic"
            type="button"
            disabled={anotherWorkoutIsActive}
            onClick={() => selectedWorkoutIsActive ? onContinue() : onStart(selectedPlan, selectedMode)}
          >
            <Play size={20} fill="currentColor" />
            {selectedWorkoutIsActive
              ? 'Continuar este treino'
              : anotherWorkoutIsActive
                ? 'Finalize o treino em andamento'
                : `Iniciar ${selectedDay?.label ?? 'treino'}${selectedMode === 'express' ? ' · Express' : ''}`}
          </button>
        </article>
      ) : (
        <article className="empty-card">
          <div className="empty-icon"><Dumbbell /></div>
          <h2>Crie seu primeiro treino</h2>
          <p>Adicione exercícios, séries, repetições e descanso.</p>
          <button className="button button-primary button-kinetic" type="button" onClick={onGoPlans}><Plus size={19} /> Criar treino</button>
        </article>
      )}

      <WeeklyDashboard plans={plans} history={history} modes={weeklyPlanModes} onModesChange={onModesChange} />

      {lastWorkout ? (
        <button className="last-workout-card interactive-card" type="button" onClick={onGoHistory}>
          <div><span>Último treino · {formatDate(lastWorkout.finishedAt)}</span><strong>{lastWorkout.planName}</strong></div><ArrowRight size={21} />
        </button>
      ) : null}

      {showInstallPrompt ? (
        <aside className="install-card"><div className="install-icon">⌂</div><div><strong>Instale no seu iPhone</strong><p>No Safari: Compartilhar → Adicionar à Tela de Início → Abrir como App.</p></div></aside>
      ) : null}
    </section>
  );
}

function repTarget(exercise: Exercise) {
  if (exercise.minReps && exercise.minReps < exercise.targetReps) return `${exercise.minReps}–${exercise.targetReps}`;
  const range = exercise.notes?.match(/Meta: (.+?) repetições/i)?.[1];
  return range ?? exercise.targetReps;
}
