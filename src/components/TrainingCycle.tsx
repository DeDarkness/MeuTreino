import { useState } from 'react';
import { localWeekKey, recoveryWeekLabel } from '../lib/recovery';
import { MAX_CYCLE_WEEKS, offsetWeek } from '../lib/trainingTimeline';
import type { AppState } from '../types';
import './training-timeline.css';

type Cycle = AppState['trainingCycle'];
export function TrainingCycle({ cycle, week, onChange }: { cycle: Cycle; week: string; onChange: (cycle: Cycle) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [start, setStart] = useState(cycle?.startWeek ?? week);
  const [length, setLength] = useState(cycle?.weeks ?? 8);
  const save = async (next: Cycle) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await onChange(next); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível guardar o ciclo.'); }
    finally { setBusy(false); }
  };
  return <section className="training-timeline" aria-labelledby="training-cycle-title">
    <h2 id="training-cycle-title">Ciclo de treino</h2>
    <p className="elite-caption">Marcar recuperação é só uma anotação no calendário. Não muda carga, séries, fichas nem pendências do Dia D.</p>
    <details><summary>Configurar ciclo</summary>
      <div className="training-cycle-fields"><label>Data de início<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label>
        <label>Semanas<select value={length} onChange={(event) => setLength(Number(event.target.value))}>{Array.from({ length: MAX_CYCLE_WEEKS }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label></div>
      <button type="button" className="button button-secondary" disabled={busy || !start} onClick={() => {
        if (cycle && !window.confirm('Substituir o calendário deste ciclo? As fichas e o histórico não serão alterados.')) return;
        void save({ startWeek: localWeekKey(new Date(`${start}T12:00:00`)), weeks: length, recoveryWeeks: [] });
      }}>{busy ? 'Salvando…' : cycle ? 'Substituir ciclo' : 'Criar ciclo'}</button>
    </details>
    {cycle ? <ol className="cycle-weeks">{Array.from({ length: cycle.weeks }, (_, i) => {
      const key = offsetWeek(cycle.startWeek, i);
      const marked = cycle.recoveryWeeks.includes(key);
      return <li key={key} className={key === week ? 'cycle-current' : undefined}>
        <span><strong>Semana {i + 1}{key === week ? ' · atual' : ''}</strong><small>{recoveryWeekLabel(key)}</small></span>
        <button className="button button-secondary" type="button" disabled={busy} aria-pressed={marked} aria-label={`Recuperação na semana ${i + 1}`} onClick={() => void save({ ...cycle, recoveryWeeks: marked ? cycle.recoveryWeeks.filter((item) => item !== key) : [...cycle.recoveryWeeks, key] })}>{marked ? 'Recuperação ✓' : 'Marcar recuperação'}</button>
      </li>;
    })}</ol> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
