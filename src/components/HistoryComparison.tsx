import { useMemo, useState } from 'react';
import { formatWeight } from '../lib/format';
import { compareHistoryExercises, comparisonGroup } from '../lib/historyComparison';
import type { WeightUnit, WorkoutHistory } from '../types';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const dateLabel = (value: string) => dateFormat.format(new Date(value));

export function HistoryComparison({ sessions, unit }: { sessions: WorkoutHistory[]; unit: WeightUnit }) {
  const [open, setOpen] = useState(false);
  return <details className="history-comparison history-selection" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Comparar dois treinos</summary>
    {open ? <Comparison sessions={sessions} unit={unit} /> : null}
  </details>;
}

function Comparison({ sessions, unit }: { sessions: WorkoutHistory[]; unit: WeightUnit }) {
  const groups = useMemo(() => {
    const grouped = new Map<string, WorkoutHistory[]>();
    for (const session of sessions) {
      const key = comparisonGroup(session);
      const group = grouped.get(key);
      if (group) group.push(session);
      else grouped.set(key, [session]);
    }
    return [...grouped.entries()].filter(([, group]) => group.length > 1);
  }, [sessions]);
  const [groupKey, setGroupKey] = useState('');
  const [firstId, setFirstId] = useState('');
  const [secondId, setSecondId] = useState('');
  const [key, group] = groups.find(([id]) => id === groupKey) ?? groups[0] ?? [];
  if (!group) return <p className="elite-caption">São necessárias duas sessões da mesma ficha e modalidade nos resultados do filtro.</p>;

  const second = group.find((session) => session.id === secondId) ?? group[0];
  const firstOptions = group.filter((session) => session.id !== second.id);
  const first = firstOptions.find((session) => session.id === firstId) ?? firstOptions[0];
  if (!first) return <p className="elite-caption">Escolha dois registros diferentes para comparar.</p>;
  const [earlier, later] = Date.parse(first.finishedAt) > Date.parse(second.finishedAt) ? [second, first] : [first, second];
  const title = (session: WorkoutHistory) => `${session.planName}${session.recoveryWeekStart ? ' · Reposição' : session.trainingMode === 'express' ? ' · Express' : ''}`;
  const pairs = compareHistoryExercises(earlier, later);

  return <div className="history-comparison-content">
    <label className="elite-period">Ficha<select value={key} onChange={(event) => { setGroupKey(event.target.value); setFirstId(''); setSecondId(''); }}>
      {groups.map(([id, items]) => <option value={id} key={id}>{title(items[0])}</option>)}
    </select></label>
    <label className="elite-period">Sessão 1<select value={first.id} onChange={(event) => setFirstId(event.target.value)}>
      {firstOptions.map((session) => <option value={session.id} key={session.id}>{dateLabel(session.finishedAt)}</option>)}
    </select></label>
    <label className="elite-period">Sessão 2<select value={second.id} onChange={(event) => setSecondId(event.target.value)}>
      {group.filter((session) => session.id !== first.id).map((session) => <option value={session.id} key={session.id}>{dateLabel(session.finishedAt)}</option>)}
    </select></label>
    <p className="elite-caption">Veja as séries registradas nas duas datas. Nomes diferentes aparecem separados. Confira se o equipamento e a execução foram os mesmos.</p>
    {pairs.map((pair) => {
      const exercise = pair.first ?? pair.second!;
      return <section className="history-comparison-exercise" aria-label={exercise.exerciseName} key={JSON.stringify([pair.first?.exerciseId, pair.second?.exerciseId])}>
        <strong>{exercise.exerciseName}</strong>
        <div className="history-comparison-columns">
          <Series exercise={pair.first} date={earlier.finishedAt} unit={unit} />
          <Series exercise={pair.second} date={later.finishedAt} unit={unit} />
        </div>
      </section>;
    })}
  </div>;
}

function Series({ exercise, date, unit }: { exercise?: WorkoutHistory['exercises'][number]; date: string; unit: WeightUnit }) {
  return <div>
    <strong className="elite-caption">{dateLabel(date)}</strong>
    {exercise?.sets.length ? <ul>{exercise.sets.map((set) => <li key={set.id}>
      Série {set.setNumber} · {formatWeight(set.weight, unit)} × {set.reps} reps
      {set.rir == null ? '' : ` · RIR ${set.rir === 4 ? '4+' : set.rir}`}
    </li>)}</ul> : <p className="elite-caption">Sem série registrada</p>}
  </div>;
}
