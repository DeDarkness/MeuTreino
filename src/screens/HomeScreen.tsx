import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  Flame,
  Play,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { formatDate, formatDuration, greeting, todayLabel } from '../lib/format';
import { getSuggestedPlanId } from '../lib/starterPlans';
import type { ActiveWorkout, Exercise, WorkoutHistory, WorkoutPlan } from '../types';

type HomeScreenProps = {
  plans: WorkoutPlan[];
  history: WorkoutHistory[];
  activeWorkout: ActiveWorkout | null;
  showInstallPrompt: boolean;
  onStart: (plan: WorkoutPlan) => void;
  onContinue: () => void;
  onGoPlans: () => void;
  onGoHistory: () => void;
};

const WORKOUT_DAYS = [
  { planId: 'plan-segunda', short: 'SEG', label: 'Segunda' },
  { planId: 'plan-terca', short: 'TER', label: 'Terça' },
  { planId: 'plan-quarta', short: 'QUA', label: 'Quarta' },
  { planId: 'plan-quinta', short: 'QUI', label: 'Quinta' },
  { planId: 'plan-sexta', short: 'SEX', label: 'Sexta' },
  { planId: 'plan-sabado', short: 'SÁB', label: 'Sábado' },
] as const;

export function HomeScreen({
  plans,
  history,
  activeWorkout,
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
  const selectedSets = selectedPlan?.exercises.reduce((sum, item) => sum + item.targetSets, 0) ?? 0;
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const thisWeek = history.filter((item) => Date.parse(item.finishedAt) >= weekStart.getTime());
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
                  <span>{day.short}</span><strong>{day.label.slice(0, 1)}</strong>
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
          <h2>{selectedPlan.notes || selectedPlan.name}</h2>
          <p className="day-workout-hero__name">{selectedPlan.name}</p>
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
        </article>
      ) : (
        <article className="empty-card">
          <div className="empty-icon"><Dumbbell /></div>
          <h2>Crie seu primeiro treino</h2>
          <p>Adicione exercícios, séries, repetições e descanso.</p>
          <button className="button button-primary button-kinetic" type="button" onClick={onGoPlans}><Plus size={19} /> Criar treino</button>
        </article>
      )}

      <div className="section-title-row"><h2>Seu ritmo</h2></div>
      <div className="stat-grid">
        <article className="stat-card stat-card--alive"><div className="stat-icon"><CalendarDays /></div><strong>{thisWeek.length}</strong><span>treinos nesta semana</span></article>
        <article className="stat-card stat-card--alive"><div className="stat-icon"><CheckCircle2 /></div><strong>{lastWorkout ? formatDuration(lastWorkout.durationSeconds) : '—'}</strong><span>{lastWorkout ? `último: ${formatDate(lastWorkout.finishedAt)}` : 'seu histórico começa aqui'}</span></article>
      </div>

      {lastWorkout ? (
        <button className="last-workout-card interactive-card" type="button" onClick={onGoHistory}>
          <div><span>Último treino</span><strong>{lastWorkout.planName}</strong></div><ArrowRight size={21} />
        </button>
      ) : null}

      {showInstallPrompt ? (
        <aside className="install-card"><div className="install-icon">⌂</div><div><strong>Instale no seu iPhone</strong><p>No Safari: Compartilhar → Adicionar à Tela de Início → Abrir como App.</p></div></aside>
      ) : null}
    </section>
  );
}

function repTarget(exercise: Exercise) {
  const range = exercise.notes?.match(/Meta: (.+?) repetições/i)?.[1];
  return range ?? exercise.targetReps;
}
