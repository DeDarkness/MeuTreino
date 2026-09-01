import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Dumbbell, Play, Plus } from 'lucide-react';

import { formatDate, formatDuration, greeting, todayLabel } from '../lib/format';
import type { ActiveWorkout, WorkoutHistory, WorkoutPlan } from '../types';

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
  const sortedHistory = [...history].sort(
    (left, right) => Date.parse(right.finishedAt) - Date.parse(left.finishedAt),
  );
  const lastWorkout = sortedHistory[0];
  const suggestedPlan =
    plans.find((plan) => plan.id !== lastWorkout?.planId) ?? plans.find((plan) => plan.id === lastWorkout?.planId) ?? plans[0];
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const thisWeek = history.filter((item) => Date.parse(item.finishedAt) >= weekStart.getTime());
  const completed = activeWorkout?.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
    0,
  ) ?? 0;
  const total = activeWorkout?.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0) ?? 0;

  return (
    <section className="screen home-screen" aria-labelledby="home-title">
      <header className="screen-heading home-heading">
        <div>
          <p className="eyebrow">{todayLabel()}</p>
          <h1 id="home-title">{greeting()} 👋</h1>
          <p>Vamos fazer cada série contar.</p>
        </div>
        <div className="brand-mark" aria-label="MeuTreino">M</div>
      </header>

      {activeWorkout ? (
        <article className="hero-card active-hero">
          <div className="live-label"><span /> Treino em andamento</div>
          <h2>{activeWorkout.planName}</h2>
          <p>{completed} de {total} séries concluídas</p>
          <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed}>
            <div style={{ width: `${total ? (completed / total) * 100 : 0}%` }} />
          </div>
          <button className="button button-primary button-wide" type="button" onClick={onContinue}>
            <Play size={20} fill="currentColor" /> Continuar treino
          </button>
        </article>
      ) : suggestedPlan ? (
        <article className="hero-card workout-hero">
          <div className="hero-icon"><Dumbbell size={29} /></div>
          <p className="eyebrow">Próximo treino</p>
          <h2>{suggestedPlan.name}</h2>
          <p>{suggestedPlan.notes || `${suggestedPlan.exercises.length} exercícios para hoje`}</p>
          <div className="hero-meta">
            <span><Dumbbell size={16} /> {suggestedPlan.exercises.length} exercícios</span>
            <span><Clock3 size={16} /> {suggestedPlan.exercises.reduce((sum, item) => sum + item.targetSets, 0)} séries</span>
          </div>
          <button className="button button-primary button-wide" type="button" onClick={() => onStart(suggestedPlan)}>
            <Play size={20} fill="currentColor" /> Iniciar treino
          </button>
        </article>
      ) : (
        <article className="empty-card">
          <div className="empty-icon"><Dumbbell /></div>
          <h2>Crie seu primeiro treino</h2>
          <p>Adicione exercícios, séries, repetições e descanso.</p>
          <button className="button button-primary" type="button" onClick={onGoPlans}>
            <Plus size={19} /> Criar treino
          </button>
        </article>
      )}

      <div className="section-title-row">
        <h2>Seu ritmo</h2>
      </div>
      <div className="stat-grid">
        <article className="stat-card">
          <div className="stat-icon"><CalendarDays /></div>
          <strong>{thisWeek.length}</strong>
          <span>treinos nesta semana</span>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><CheckCircle2 /></div>
          <strong>{lastWorkout ? formatDuration(lastWorkout.durationSeconds) : '—'}</strong>
          <span>{lastWorkout ? `último: ${formatDate(lastWorkout.finishedAt)}` : 'seu histórico começa aqui'}</span>
        </article>
      </div>

      {lastWorkout ? (
        <button className="last-workout-card" type="button" onClick={onGoHistory}>
          <div>
            <span>Último treino</span>
            <strong>{lastWorkout.planName}</strong>
          </div>
          <ArrowRight size={21} />
        </button>
      ) : null}

      {showInstallPrompt ? (
        <aside className="install-card">
          <div className="install-icon">⌂</div>
          <div>
            <strong>Instale no seu iPhone</strong>
            <p>No Safari: Compartilhar → Adicionar à Tela de Início → Abrir como App.</p>
          </div>
        </aside>
      ) : null}
    </section>
  );
}
