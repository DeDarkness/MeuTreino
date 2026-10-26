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
import { RecoveryPanel } from '../components/RecoveryPanel';
import { localWeekKey } from '../lib/recovery';
import { NutritionSummary } from '../nutrition/NutritionSummary';
import type { NutritionState } from '../nutrition/types';
import { getSuggestedPlanId } from '../lib/starterPlans';
import { plannedSets } from '../lib/trainingModes';
import type { ActiveWorkout, Exercise, RecoveryItem, RecoverySelection, WorkoutHistory, WorkoutPlan } from '../types';

type HomeScreenProps = {
  plans: WorkoutPlan[];
  nutrition?: NutritionState;
  onOpenNutrition?: () => void;
  history: WorkoutHistory[];
  activeWorkout: ActiveWorkout | null;
  recoveryItems: RecoveryItem[];
  queuedMissedPlans: string[];
  onStartRecovery: (selections: RecoverySelection[]) => Promise<void>;
  onDiscardRecovery: (item: RecoveryItem) => void;
  onQueueMissedPlan: (plan: WorkoutPlan) => void;
  showInstallPrompt: boolean;
  onStart: (plan: WorkoutPlan) => void;
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
  nutrition,
  onOpenNutrition,
  history,
  activeWorkout,
  recoveryItems,
  queuedMissedPlans,
  onStartRecovery,
  onDiscardRecovery,
  onQueueMissedPlan,
  showInstallPrompt,
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
  const selectedSets = selectedPlan ? plannedSets(selectedPlan) : 0;
  const completed = activeWorkout?.exercises.reduce(
    (total, item) => total + (item.skipped ? 0 : item.sets.filter((set) => set.completed).length),
    0,
  ) ?? 0;
  const total = activeWorkout?.exercises.reduce((sum, item) => sum + (item.skipped ? 0 : item.sets.length), 0) ?? 0;
  const selectedWorkoutIsActive = Boolean(activeWorkout && activeWorkout.planId === selectedPlan?.id);
  const anotherWorkoutIsActive = Boolean(activeWorkout && !selectedWorkoutIsActive);
  const week = localWeekKey();
  const hasWeeklyRecord = Boolean(selectedPlan && (queuedMissedPlans.includes(`${week}::${selectedPlan.id}`)
    || recoveryItems.some((item) => item.sourcePlanId === selectedPlan.id && item.weekStart === week)
    || history.some((item) => item.planId === selectedPlan.id && localWeekKey(new Date(item.startedAt)) === week
      || item.recoveryWeekStart === week && item.recoverySourcePlanIds?.includes(selectedPlan.id))));

  return (
    <section className="screen home-screen home-screen--premium" aria-labelledby="home-title">
      <header className="screen-heading home-heading">
        <div>
          <span className="elite-release-badge">MEUTREINO <b>ELITE 8</b></span>
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

      {nutrition && onOpenNutrition ? <NutritionSummary state={nutrition} onOpen={onOpenNutrition} /> : null}

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
          <div className="hero-meta">
            <span><Dumbbell size={16} /> {selectedPlan.exercises.length} exercícios</span>
            <span><Flame size={16} /> {selectedSets} séries</span>
          </div>

          <div className="workout-preview" aria-label="Primeiros exercícios">
            {selectedPlan.exercises.slice(0, 3).map((exercise, index) => (
              <div className="workout-preview__row" key={exercise.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{exercise.name}</strong>
                <small>{exercise.targetSets}×{repTarget(exercise)}</small>
              </div>
            ))}
            {selectedPlan.exercises.length > 3 ? <div className="workout-preview__more">+ {selectedPlan.exercises.length - 3} exercícios</div> : null}
          </div>

          <button
            className="button button-primary button-wide button-kinetic"
            type="button"
            disabled={anotherWorkoutIsActive}
            onClick={() => selectedWorkoutIsActive ? onContinue() : onStart(selectedPlan)}
          >
            <Play size={20} fill="currentColor" />
            {selectedWorkoutIsActive
              ? 'Continuar este treino'
              : anotherWorkoutIsActive
                ? 'Finalize o treino em andamento'
                : `Iniciar ${selectedDay?.label ?? 'treino'}`}
          </button>
          <button className="button button-secondary button-wide recovery-missed-button" type="button" disabled={Boolean(activeWorkout) || hasWeeklyRecord} onClick={() => onQueueMissedPlan(selectedPlan)}>
            {hasWeeklyRecord ? 'Ficha já registrada nesta semana' : 'Não fiz esta ficha · guardar para repor'}
          </button>
          <p className="elite-caption">Não precisa terminar tudo de uma vez. Você escolhe quando encerrar e o que repor.</p>
        </article>
      ) : (
        <article className="empty-card">
          <div className="empty-icon"><Dumbbell /></div>
          <h2>Crie seu primeiro treino</h2>
          <p>Adicione exercícios, séries, repetições e descanso.</p>
          <button className="button button-primary button-kinetic" type="button" onClick={onGoPlans}><Plus size={19} /> Criar treino</button>
        </article>
      )}

      <WeeklyDashboard plans={plans} history={history} />
      <RecoveryPanel items={recoveryItems} activeWorkout={activeWorkout} onStart={onStartRecovery} onDiscard={onDiscardRecovery} />

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
