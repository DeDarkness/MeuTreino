import { CalendarClock, Play, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { localWeekKey, MAX_RECOVERY_SETS, MAX_RECOVERY_SETS_PER_EXERCISE, recoveryByMuscle, recoveryWeekLabel, savedRecoverySets } from '../lib/recovery';
import { MUSCLE_LABELS } from '../lib/trainingModes';
import type { ActiveWorkout, RecoveryItem, RecoverySelection } from '../types';
import './recovery.css';

export function RecoveryPanel({ items, activeWorkout, onStart, onDiscard }: {
  items: RecoveryItem[];
  activeWorkout: ActiveWorkout | null;
  onStart: (selection: RecoverySelection[]) => Promise<void>;
  onDiscard: (item: RecoveryItem) => void;
}) {
  const weeks = [...new Set(items.map((item) => item.weekStart))].sort().reverse();
  const [selectedWeek, setSelectedWeek] = useState(localWeekKey);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const week = weeks.includes(selectedWeek) ? selectedWeek : weeks[0];
  const visible = items.filter((item) => item.weekStart === week);
  const selection = visible.flatMap((item) => quantities[item.id] > 0 ? [{ itemId: item.id,
    setIds: item.exercise.sets.slice(0, quantities[item.id]).map((set) => set.id),
  }] : []);
  const selectedSets = selection.reduce((total, entry) => total + entry.setIds.length, 0);
  const muscles = recoveryByMuscle(visible);
  const unclassified = savedRecoverySets(visible) - muscles.reduce((total, entry) => total + entry.sets, 0);
  const selectWithinLimit = () => {
    let available = MAX_RECOVERY_SETS;
    const perExercise = new Map<string, number>();
    const next: Record<string, number> = {};
    for (const item of visible) {
      const key = `${item.exercise.exerciseId}::${item.exercise.exerciseName}`;
      const count = Math.min(available, item.exercise.sets.length, MAX_RECOVERY_SETS_PER_EXERCISE - (perExercise.get(key) ?? 0));
      next[item.id] = count;
      available -= count;
      perExercise.set(key, (perExercise.get(key) ?? 0) + count);
    }
    setQuantities(next);
    setError(null);
  };
  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try { await onStart(selection); setQuantities({}); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar a reposição.'); }
    finally { setBusy(false); }
  };
  return <section className="recovery-panel" id="weekly-recovery" aria-labelledby="recovery-title">
    <div className="elite-section-top"><div><span className="eyebrow">NO SEU RITMO</span><h2 id="recovery-title">Reposição da semana</h2></div><CalendarClock aria-hidden="true" /></div>
    <p className="elite-caption">Encerre quando quiser. As séries não feitas ficam aqui para escolher outro dia, inclusive sábado ou domingo. Não é preciso compensar tudo.</p>
    {!items.length ? <div className="recovery-empty"><strong>Nenhuma série pendente</strong><span>Seu histórico registra só o que você realmente fez.</span></div> : <>
      <label className="recovery-week">Semana de origem<select value={week} onChange={(event) => { setSelectedWeek(event.target.value); setQuantities({}); setError(null); }}>
        {weeks.map((entry) => <option key={entry} value={entry}>{recoveryWeekLabel(entry)}{entry === localWeekKey() ? ' · atual' : ''}</option>)}
      </select></label>
      {week !== localWeekKey() ? <p className="recovery-notice">Pendências de uma semana anterior. Elas não aumentam automaticamente a ficha atual; revise sua recuperação antes de selecionar.</p> : null}
      <p className="elite-caption">{savedRecoverySets(visible)} séries pendentes · {visible.length} exercícios nesta semana</p>
      <div className="recovery-muscles" aria-label="Séries pendentes por músculo">{muscles.map((entry) => <span key={entry.muscle}>{MUSCLE_LABELS[entry.muscle]} <b>{entry.sets}</b></span>)}{unclassified ? <span>Sem classificação <b>{unclassified}</b></span> : null}</div>
      <div className="recovery-selection-tools"><strong>{selectedSets} {selectedSets === 1 ? 'série selecionada' : 'séries selecionadas'}</strong><button type="button" className="text-button" disabled={busy || Boolean(activeWorkout)} onClick={selectWithinLimit}>Selecionar até {MAX_RECOVERY_SETS}</button><button type="button" className="text-button" onClick={() => setQuantities({})} disabled={busy}>Limpar seleção</button></div>
      <div className="recovery-items">{visible.map((item) => {
        const count = Math.min(quantities[item.id] ?? 0, item.exercise.sets.length);
        const reserved = activeWorkout?.recoveryItemIds?.includes(item.id);
        const limit = Math.min(item.exercise.sets.length, MAX_RECOVERY_SETS_PER_EXERCISE);
        return <article className={`recovery-item${count ? ' is-selected' : ''}`} key={item.id}>
          <label className="recovery-check"><input type="checkbox" checked={count > 0} disabled={busy || Boolean(activeWorkout)} onChange={(event) => { setQuantities({ ...quantities, [item.id]: event.target.checked ? limit : 0 }); setError(null); }} /><span><strong>{item.exercise.exerciseName}</strong><small>{item.sourcePlanName} · {item.exercise.sets.length} séries pendentes</small><small>{reserved ? 'Reservado pela reposição em andamento' : `Descanso: ${item.exercise.restSeconds}s · séries originais ${item.exercise.sets.map((set) => set.setNumber).join(', ')}`}</small></span></label>
          <div className="recovery-item-actions"><label>Séries a repor<select aria-label={`Séries a repor de ${item.exercise.exerciseName} em ${item.sourcePlanName}`} value={count} disabled={busy || Boolean(activeWorkout)} onChange={(event) => { setQuantities({ ...quantities, [item.id]: Number(event.target.value) }); setError(null); }}><option value={0}>Não selecionar</option>{Array.from({ length: limit }, (_, index) => index + 1).map((number) => <option value={number} key={number}>{number}</option>)}</select></label>
          <button className="recovery-discard" type="button" aria-label={`Descartar pendência de ${item.exercise.exerciseName} em ${item.sourcePlanName}`} disabled={busy || reserved} onClick={() => onDiscard(item)}><Trash2 size={18} /><span>Descartar</span></button></div>
        </article>;
      })}</div>
      <p className="elite-caption">Limites técnicos por sessão: até {MAX_RECOVERY_SETS} séries no total e {MAX_RECOVERY_SETS_PER_EXERCISE} do mesmo exercício. Não são metas nem indicação de volume. Só séries concluídas são descontadas da fila, depois de salvar.</p>
      {activeWorkout ? <p className="recovery-notice">Encerre a sessão em andamento para iniciar outra. Pendências reservadas não podem ser descartadas durante a reposição.</p> : null}
      {error ? <p className="recovery-error" role="alert">{error}</p> : null}
      <button type="button" className="button button-primary button-wide" disabled={busy || Boolean(activeWorkout) || !selectedSets || selectedSets > MAX_RECOVERY_SETS} onClick={() => void start()}><Play size={18} />{busy ? 'Salvando…' : 'Iniciar reposição selecionada'}</button>
    </>}
  </section>;
}
