import {
  Award,
  CalendarDays,
  ChevronDown,
  Clock3,
  Dumbbell,
  LineChart,
  Repeat2,
  RotateCcw,
  Sparkles,
  Trash2,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { formatDate, formatDuration, formatWeight } from '../lib/format';
import { buildExerciseProgress, getLoadSuggestion, type ExerciseProgress } from '../lib/progress';
import type { WeightUnit, WorkoutHistory, WorkoutPlan } from '../types';

type HistoryScreenProps = {
  history: WorkoutHistory[];
  plans: WorkoutPlan[];
  weightUnit: WeightUnit;
  onDelete: (id: string) => void;
};

export function HistoryScreen({ history, plans, weightUnit, onDelete }: HistoryScreenProps) {
  const [view, setView] = useState<'progress' | 'history'>('progress');
  const [selectedExerciseKey, setSelectedExerciseKey] = useState('');
  const progress = useMemo(() => buildExerciseProgress(history), [history]);
  const selectedProgress = progress.find((item) => item.key === selectedExerciseKey) ?? progress[0] ?? null;
  const suggestions = useMemo(
    () => plans.flatMap((plan) => plan.exercises.map((exercise) => {
      const suggestion = getLoadSuggestion(history, exercise, weightUnit);
      return suggestion ? { planName: plan.name, exercise, suggestion } : null;
    })).filter((item): item is NonNullable<typeof item> => item !== null),
    [history, plans, weightUnit],
  );
  const totalSets = history.reduce(
    (total, item) => total + item.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
    0,
  );
  const totalReps = history.reduce(
    (total, item) => total + item.exercises.reduce(
      (sum, exercise) => sum + exercise.sets.reduce((reps, set) => reps + set.reps, 0),
      0,
    ),
    0,
  );
  const totalSeconds = history.reduce((total, item) => total + item.durationSeconds, 0);

  return (
    <section className="screen evolution-screen" aria-labelledby="history-title">
      <header className="screen-heading">
        <div>
          <p className="eyebrow">Seus resultados</p>
          <h1 id="history-title"><TrendingUp className="evolution-heading-icon" aria-hidden="true" /> Evolução</h1>
          <p>Acompanhe sua força e saiba quando aumentar a carga.</p>
        </div>
      </header>

      <div className="evolution-tabs" role="tablist" aria-label="Evolução e histórico">
        <button
          className={view === 'progress' ? 'is-active' : ''}
          type="button"
          role="tab"
          aria-selected={view === 'progress'}
          onClick={() => setView('progress')}
        >
          <LineChart aria-hidden="true" size={18} /> Evolução
        </button>
        <button
          className={view === 'history' ? 'is-active' : ''}
          type="button"
          role="tab"
          aria-selected={view === 'history'}
          onClick={() => setView('history')}
        >
          <CalendarDays aria-hidden="true" size={18} /> Histórico
        </button>
      </div>

      {history.length ? (
        view === 'progress' ? (
          <>
            <div className="summary-grid">
              <Summary icon={<Dumbbell />} value={String(history.length)} label="treinos" />
              <Summary icon={<Clock3 />} value={formatDuration(totalSeconds)} label="tempo total" />
              <Summary icon={<Repeat2 />} value={String(totalSets)} label="séries" />
              <Summary icon={<RotateCcw />} value={String(totalReps)} label="repetições" />
            </div>

            {selectedProgress ? (
              <ExerciseEvolution
                progress={progress}
                selected={selectedProgress}
                weightUnit={weightUnit}
                onSelect={setSelectedExerciseKey}
              />
            ) : null}

            <section className="load-suggestions" aria-labelledby="load-suggestions-title">
              <div className="section-label-row">
                <div><Sparkles aria-hidden="true" /><span>PROGRESSÃO INTELIGENTE</span></div>
              </div>
              <div className="load-suggestions__heading">
                <div>
                  <h2 id="load-suggestions-title">Próximas cargas</h2>
                  <p>Ao atingir o topo das repetições em todas as séries, o app sugere o próximo passo.</p>
                </div>
              </div>
              {suggestions.length ? (
                <div className="load-suggestion-list">
                  {suggestions.map(({ planName, exercise, suggestion }) => (
                    <article key={`${planName}-${exercise.id}`}>
                      <div className="load-suggestion-icon"><Zap aria-hidden="true" /></div>
                      <div className="load-suggestion-copy">
                        <strong>{exercise.name}</strong>
                        <span>{planName} · meta atingida: {suggestion.targetReps} reps</span>
                      </div>
                      <div className="load-suggestion-weight">
                        <small>PRÓXIMO</small>
                        <strong>{formatWeight(suggestion.suggestedWeight, weightUnit)}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="progression-empty">
                  <Award aria-hidden="true" />
                  <div><strong>Continue progredindo</strong><span>As sugestões aparecem após você atingir o máximo da faixa de repetições.</span></div>
                </div>
              )}
            </section>
          </>
        ) : (
          <HistoryList history={history} weightUnit={weightUnit} onDelete={onDelete} />
        )
      ) : (
        <article className="empty-card history-empty">
          <div className="empty-icon"><TrendingUp /></div>
          <h2>Sua evolução começa aqui</h2>
          <p>Conclua seu primeiro treino para liberar gráficos, recordes e sugestões de carga.</p>
        </article>
      )}
    </section>
  );
}

function ExerciseEvolution({
  progress,
  selected,
  weightUnit,
  onSelect,
}: {
  progress: ExerciseProgress[];
  selected: ExerciseProgress;
  weightUnit: WeightUnit;
  onSelect: (key: string) => void;
}) {
  const latest = selected.sessions[selected.sessions.length - 1];
  const previousSessions = selected.sessions.slice(0, -1);
  const previousMaxWeight = maximum(previousSessions.map((session) => session.maxWeight));
  const previousMaxReps = maximum(previousSessions.map((session) => session.maxReps));
  const hasNewRecord = selected.sessions.length > 1 && (
    (latest.maxWeight !== null && (previousMaxWeight === null || latest.maxWeight > previousMaxWeight))
    || (previousMaxReps !== null && latest.maxReps > previousMaxReps)
  );

  return (
    <section className="exercise-evolution" aria-labelledby="exercise-evolution-title">
      <div className="section-label-row">
        <div><LineChart aria-hidden="true" /><span>POR EXERCÍCIO</span></div>
      </div>
      <label htmlFor="evolution-exercise">Escolha o exercício</label>
      <div className="evolution-select-wrap">
        <Dumbbell aria-hidden="true" size={19} />
        <select id="evolution-exercise" value={selected.key} onChange={(event) => onSelect(event.target.value)}>
          {progress.map((item) => <option value={item.key} key={item.key}>{item.exerciseName}</option>)}
        </select>
        <ChevronDown aria-hidden="true" size={18} />
      </div>

      <article className="evolution-chart-card">
        <div className="evolution-chart-heading">
          <div>
            <span>{selected.sessions.some((session) => session.maxWeight !== null) ? 'CARGA MÁXIMA' : 'REPETIÇÕES MÁXIMAS'}</span>
            <h2 id="exercise-evolution-title">{selected.exerciseName}</h2>
          </div>
          {hasNewRecord ? <div className="new-pr-badge"><Trophy aria-hidden="true" size={14} /> NOVO PR</div> : null}
        </div>
        <ProgressChart progress={selected} weightUnit={weightUnit} />
      </article>

      <div className="record-grid">
        <Record icon={<Trophy />} label="Maior carga" value={formatWeight(selected.maxWeight, weightUnit)} />
        <Record icon={<Repeat2 />} label="Mais repetições" value={`${selected.maxReps} reps`} />
        <Record icon={<Zap />} label="Força estimada" value={formatWeight(selected.bestEstimatedOneRepMax, weightUnit)} />
        <Record icon={<TrendingUp />} label="Melhor volume" value={formatWeight(selected.bestVolume || null, weightUnit)} />
      </div>
    </section>
  );
}

function ProgressChart({ progress, weightUnit }: { progress: ExerciseProgress; weightUnit: WeightUnit }) {
  const sessions = progress.sessions.slice(-8);
  const weighted = sessions.some((session) => session.maxWeight !== null);
  const values = sessions.map((session) => {
    const value = weighted ? (session.maxWeight ?? 0) : session.maxReps;
    return weightUnit === 'lb' && weighted ? value * 2.2046226218 : value;
  });
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const span = Math.max(1, maxValue - minValue);
  const width = 320;
  const height = 132;
  const horizontalPadding = 18;
  const verticalPadding = 21;
  const points = values.map((value, index) => {
    const x = sessions.length === 1
      ? width / 2
      : horizontalPadding + (index / (sessions.length - 1)) * (width - horizontalPadding * 2);
    const y = height - verticalPadding - ((value - minValue) / span) * (height - verticalPadding * 2);
    return { x, y, value };
  });
  const line = points.map(({ x, y }) => `${x},${y}`).join(' ');
  const area = points.length ? `${points[0].x},${height - verticalPadding} ${line} ${points[points.length - 1].x},${height - verticalPadding}` : '';
  const delta = values.length > 1 ? values[values.length - 1] - values[0] : 0;
  const suffix = weighted ? ` ${weightUnit}` : ' reps';

  return (
    <div className="progress-chart">
      <div className="progress-trend">
        <strong>{formatChartValue(values[values.length - 1])}{suffix}</strong>
        {values.length > 1 ? <span className={delta >= 0 ? 'is-positive' : 'is-negative'}>{delta >= 0 ? '+' : ''}{formatChartValue(delta)}{suffix}</span> : <span>Primeiro registro</span>}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Evolução de ${progress.exerciseName}`}>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line className="chart-grid-line" x1="0" y1={height * ratio} x2={width} y2={height * ratio} key={ratio} />
        ))}
        {points.length > 1 ? <polygon className="chart-area" points={area} /> : null}
        {points.length > 1 ? <polyline className="chart-line" points={line} /> : null}
        {points.map(({ x, y, value }, index) => (
          <g key={sessions[index].workoutId}>
            <circle className="chart-point-halo" cx={x} cy={y} r="8" />
            <circle className="chart-point" cx={x} cy={y} r="4" />
            {(index === 0 || index === points.length - 1) ? <text x={x} y={Math.max(12, y - 11)} textAnchor="middle">{formatChartValue(value)}</text> : null}
          </g>
        ))}
      </svg>
      <div className="chart-dates">
        <span>{formatDate(sessions[0].finishedAt)}</span>
        <span>{sessions.length} {sessions.length === 1 ? 'sessão' : 'sessões'}</span>
        <span>{formatDate(sessions[sessions.length - 1].finishedAt)}</span>
      </div>
    </div>
  );
}

function HistoryList({ history, weightUnit, onDelete }: Omit<HistoryScreenProps, 'plans'>) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sorted = [...history].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt));

  return (
    <div className="history-list">
      {sorted.map((item) => {
        const open = item.id === expandedId;
        const itemSets = item.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
        return (
          <article className={`history-card ${open ? 'is-open' : ''}`} key={item.id}>
            <button className="history-card-summary" type="button" onClick={() => setExpandedId(open ? null : item.id)} aria-expanded={open}>
              <div className="history-date-badge"><CalendarDays size={21} /></div>
              <div className="history-card-copy">
                <strong>{item.planName}</strong>
                <span>{formatDate(item.finishedAt, true)} · {formatDuration(item.durationSeconds)}</span>
                <small>{item.exercises.length} exercícios · {itemSets} séries</small>
              </div>
              <ChevronDown className="chevron" size={20} />
            </button>
            {open ? (
              <div className="history-details">
                {item.exercises.map((exercise) => (
                  <div className="history-exercise" key={`${item.id}-${exercise.exerciseId}`}>
                    <strong>{exercise.exerciseName}</strong>
                    <div className="history-set-table">
                      {exercise.sets.map((set) => (
                        <div key={set.id}>
                          <span>Série {set.setNumber}</span>
                          <span>{formatWeight(set.weight, weightUnit)}</span>
                          <span>{set.reps} reps</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  className="text-button danger"
                  type="button"
                  onClick={() => {
                    if (window.confirm('Excluir este registro do histórico deste iPhone?')) onDelete(item.id);
                  }}
                >
                  <Trash2 size={17} /> Excluir registro
                </button>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function Record({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <article className="record-card">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Summary({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <article className="summary-card">
      <div>{icon}</div>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function maximum(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null);
  return available.length ? Math.max(...available) : null;
}

function formatChartValue(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
}
