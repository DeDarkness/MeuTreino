import { useMemo, useRef, useState } from 'react';
import { addMealSnapshot, mealSnapshot, recentConsumedMeals } from './mealSnapshots';
import { localDate, nutritionId, totalNutrients } from './engine';
import { dateLabel, display, type Update } from './uiHelpers';
import type { NutritionState } from './types';
import './meal-reuse.css';

export function MealReuse({ state, date, mode, change }: { state: NutritionState; date: string; mode: 'diary' | 'plan'; change: Update }) {
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const recent = useMemo(() => recentConsumedMeals(state.entries, date), [state.entries, date]);
  const meal = recent.find((row) => row.id === selected);
  const template = state.templates.find((item) => `favorite:${item.id}` === selected);
  const entries = template?.entries ?? (meal ? mealSnapshot(meal.entries) : null);
  const run = async (operation: () => Promise<void>, success: string) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try { await operation(); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const kind = mode === 'plan' ? 'planned' : 'consumed';
  return <details className="nutrition-card meal-reuse">
    <summary>Refeições favoritas e recentes</summary>
    {!state.templates.length && !recent.length ? <p className="elite-caption">Registre uma refeição para repetir ou salvar como favorita.</p> : <>
      <label>Escolher refeição<select value={selected} disabled={busy} onChange={(event) => { setSelected(event.target.value); setMessage(''); }}>
        <option value="">Selecione uma opção</option>
        {state.templates.length ? <optgroup label="Favoritas">{state.templates.map((item) => <option key={item.id} value={`favorite:${item.id}`}>{item.name}</option>)}</optgroup> : null}
        {recent.length ? <optgroup label="Registradas recentemente">{recent.map((item) => <option key={item.id} value={item.id}>{item.meal} · {dateLabel(item.date)}</option>)}</optgroup> : null}
      </select></label>
      {entries ? <><p className="elite-caption">{entries.length} itens · {display(totalNutrients(entries).kcal, 0)} kcal estimadas. As porções podem ser editadas após adicionar.</p>
        <button type="button" className="button button-secondary" disabled={busy || kind === 'consumed' && date > localDate()} onClick={() => {
          if (!window.confirm(`Adicionar ${entries.length} itens em ${dateLabel(date)} como ${kind === 'consumed' ? 'consumo' : 'plano'}? Nenhum registro existente será substituído.`)) return;
          void run(() => change((current) => addMealSnapshot(current, entries, date, kind), 'Antes de repetir refeição'), 'Refeição adicionada.');
        }}>{kind === 'consumed' ? 'Registrar esta refeição' : 'Adicionar ao plano'}</button>
        {meal ? <div className="meal-reuse__favorite"><label>Nome da favorita<input type="text" maxLength={80} value={name} placeholder={meal.meal} onChange={(event) => setName(event.target.value)} /></label>
          <button type="button" className="button button-secondary" disabled={busy} onClick={() => void run(() => change((current) => ({
            ...current, templates: [...current.templates, { id: nutritionId(), name: name.trim() || meal.meal, entries }],
          }), 'Antes de salvar refeição favorita'), 'Favorita salva.')}>Salvar como favorita</button></div> : null}
      </> : null}
    </>}
    {message ? <p role="status">{message}</p> : null}
  </details>;
}
