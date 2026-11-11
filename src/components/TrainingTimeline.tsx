import { useMemo, useState } from 'react';
import { trainingTimeline } from '../lib/trainingTimeline';
import { formatDate } from '../lib/format';
import type { WeightUnit, WorkoutHistory, WorkoutPlan } from '../types';
import './training-timeline.css';

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function TrainingTimeline({ history, plans, week, unit }: { history: WorkoutHistory[]; plans: WorkoutPlan[]; week: string; unit: WeightUnit }) {
  const [metric, setMetric] = useState<'sessions' | 'sets' | 'volumeKg'>('sets');
  const weeks = useMemo(() => trainingTimeline(history, plans, week), [history, plans, week]);
  const factor = unit === 'lb' ? 2.2046226218 : 1;
  const max = Math.max(1, ...weeks.map((row) => row[metric]));
  const current = weeks.at(-1)!;
  return <section className="training-timeline" aria-labelledby="training-timeline-title">
    <h2 id="training-timeline-title">Evolução semanal</h2>
    <p className="elite-caption">Últimas oito semanas locais. Sessões e volume usam a data de encerramento.</p>
    <label className="elite-period">Indicador<select value={metric} onChange={(event) => setMetric(event.target.value as typeof metric)}><option value="sets">Séries concluídas</option><option value="sessions">Sessões registradas</option><option value="volumeKg">Volume com carga ({unit} × reps)</option></select></label>
    <div className="training-bars" aria-hidden="true">{weeks.map((row) => <div key={row.week}>
      <b>{number.format(row[metric] * (metric === 'volumeKg' ? factor : 1))}</b>
      <span><i style={{ height: `${row[metric] / max * 100}%` }} /></span>
      <small>{row.week.slice(8)}/{row.week.slice(5, 7)}</small>
    </div>)}</div>
    <p className="elite-caption"><strong>{current.completedPlans}/{current.scheduledPlans} fichas A/B/C registradas nesta semana.</strong> Cada ficha normal conta uma vez, mesmo parcial. Dia D não conta como nova ficha A/B/C.</p>
    <details><summary>Ver valores e como são calculados</summary>
      <p className="elite-caption">Volume = carga × repetições das séries com carga positiva. Séries sem carga contam na frequência e na quantidade, não no volume. A referência de fichas é a configuração atual, não uma fotografia histórica.</p>
      <div className="training-table-scroll"><table><thead><tr><th>Semana</th><th>Sessões</th><th>Séries</th><th>Volume ({unit} × reps)</th><th>Fichas</th></tr></thead><tbody>{weeks.map((row) => <tr key={row.week}><th scope="row">{formatDate(`${row.week}T12:00:00`)}</th><td>{row.sessions}</td><td>{row.sets}</td><td>{row.weightedSets ? number.format(row.volumeKg * factor) : '—'}</td><td>{row.completedPlans}/{row.scheduledPlans}</td></tr>)}</tbody></table></div>
    </details>
  </section>;
}
