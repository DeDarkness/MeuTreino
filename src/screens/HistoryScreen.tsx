import { CalendarDays, ChevronDown, Clock3, Dumbbell, Repeat2, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { formatDate, formatDuration, formatWeight } from '../lib/format';
import type { WeightUnit, WorkoutHistory } from '../types';

type HistoryScreenProps = {
  history: WorkoutHistory[];
  weightUnit: WeightUnit;
  onDelete: (id: string) => void;
};

export function HistoryScreen({ history, weightUnit, onDelete }: HistoryScreenProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sorted = [...history].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt));
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
    <section className="screen" aria-labelledby="history-title">
      <header className="screen-heading">
        <div>
          <p className="eyebrow">Sua evolução</p>
          <h1 id="history-title">Histórico</h1>
          <p>Cada treino salvo conta sua história.</p>
        </div>
      </header>

      {history.length ? (
        <>
          <div className="summary-grid">
            <Summary icon={<Dumbbell />} value={String(history.length)} label="treinos" />
            <Summary icon={<Clock3 />} value={formatDuration(totalSeconds)} label="tempo total" />
            <Summary icon={<Repeat2 />} value={String(totalSets)} label="séries" />
            <Summary icon={<RotateCcw />} value={String(totalReps)} label="repetições" />
          </div>

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
        </>
      ) : (
        <article className="empty-card history-empty">
          <div className="empty-icon"><CalendarDays /></div>
          <h2>Seu histórico começa aqui</h2>
          <p>Ao terminar um treino, as séries, cargas e repetições aparecerão nesta tela.</p>
        </article>
      )}
    </section>
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
