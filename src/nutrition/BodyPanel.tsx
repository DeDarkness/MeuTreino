import { useMemo, useState } from 'react';
import type { BodyMeasurement, NutritionState } from './types';
import { localDate, nutritionId, offsetDate, validDate } from './engine';
import { dateLabel, display, numberValue, stringValue, type Update } from './uiHelpers';
import { Field, LocalForm, SaveButton } from './FormControls';
import { TrendChart } from './TrendChart';
import { BODY_METRICS, BODY_METRIC_KEYS, bodyMetricUnit, type BodyMetric } from './bodyMetrics';
import { downloadLocalFile } from '../lib/localFiles';
import './nutrition.css';

const periods = [
  [7, '7 dias'], [30, '30 dias'], [90, '90 dias'], [183, '6 meses'], [365, '12 meses'], [0, 'Todo o histórico'],
] as const;

function measurementLabel(item: BodyMeasurement) {
  const time = item.measuredAt && new Date(item.measuredAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return time ? `${dateLabel(item.date)} · ${time}` : dateLabel(item.date);
}

export function BodyPanel({ state, change }: { state: NutritionState; change: Update }) {
  const [editing, setEditing] = useState('');
  const [range, setRange] = useState(30);
  const [metric, setMetric] = useState<BodyMetric | 'movingAverage'>('weightKg');
  const [notice, setNotice] = useState('');
  const [formVersion, setFormVersion] = useState(0);
  const today = localDate();
  const sorted = useMemo(() => [...state.measurements].sort((a, b) => b.date.localeCompare(a.date)
    || (b.measuredAt ?? '').localeCompare(a.measuredAt ?? '')), [state.measurements]);
  const current = sorted.find((item) => item.id === editing);
  const points = useMemo(() => bodyChart(sorted, metric, today, range), [sorted, metric, today, range]);
  const label = metric === 'movingAverage' ? 'Média móvel de 7 dias (kg)' : `${BODY_METRICS[metric]} (${bodyMetricUnit(metric)})`;

  const save = async (data: FormData) => {
    const date = stringValue(data, 'date');
    const time = stringValue(data, 'time');
    const timestamp = new Date(`${date}T${time}`);
    if (!validDate(date) || date > today || !Number.isFinite(timestamp.getTime())) throw new Error('Informe uma data e hora válidas.');
    const values = Object.fromEntries(BODY_METRIC_KEYS.map((key) => [key, numberValue(data, key)])) as Record<BodyMetric, number | null>;
    if (Object.values(values).every((value) => value === null)) throw new Error('Informe pelo menos uma medida.');
    const now = new Date().toISOString();
    const entry: BodyMeasurement = {
      ...values, id: current?.id ?? nutritionId(), date,
      measuredAt: current?.date === date && !current.measuredAt && time === '12:00' ? undefined : timestamp.toISOString(),
      createdAt: current?.createdAt ?? now, updatedAt: now,
      method: stringValue(data, 'method'), notes: stringValue(data, 'notes'),
    };
    await change((next) => ({
      ...next,
      measurements: [...next.measurements.filter((item) => item.id !== entry.id), entry],
    }), 'Antes de salvar uma avaliação corporal');
    setEditing('');
    setFormVersion((value) => value + 1);
    setNotice('Avaliação salva no aparelho.');
  };
  const deleteMeasurement = async () => {
    if (!current || !window.confirm(`Excluir a avaliação de ${measurementLabel(current)}?`)) return;
    try {
      await change((next) => ({ ...next, measurements: next.measurements.filter((item) => item.id !== current.id) }), 'Antes de excluir avaliação corporal');
      setEditing('');
      setNotice('Avaliação excluída.');
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Falha ao excluir a avaliação.'); }
  };

  return <>
    <article className="nutrition-card">
      <h2>Registrar medidas</h2>
      {sorted.length ? <label>Avaliação<select value={editing} onChange={(event) => setEditing(event.target.value)}>
        <option value="">Nova avaliação</option>
        {sorted.map((item) => <option key={item.id} value={item.id}>{measurementLabel(item)}{item.weightKg == null ? '' : ` · ${display(item.weightKg)} kg`}</option>)}
      </select></label> : null}
      <LocalForm key={`${editing}-${formVersion}`} onSave={save}>
        <div className="nutrition-form-grid">
          <label>Data<input type="date" name="date" defaultValue={current?.date ?? today} max={today} required /></label>
          <label>Hora<input type="time" name="time" required defaultValue={current
            ? current.measuredAt ? new Date(current.measuredAt).toTimeString().slice(0, 5) : '12:00'
            : new Date().toTimeString().slice(0, 5)} /></label>
          {BODY_METRIC_KEYS.map((key) => <Field key={key} name={key} label={`${BODY_METRICS[key]} (${bodyMetricUnit(key)})`}
            min={key === 'bodyFat' ? 0 : 1} max={key === 'bodyFat' ? 100 : key === 'weightKg' ? 800 : 400} value={current?.[key]} />)}
        </div>
        <Field label="Método da estimativa de gordura" name="method" type="text" maxLength={200} value={current?.method} />
        <Field label="Observações" name="notes" type="textarea" value={current?.notes} />
        <SaveButton label={current ? 'Atualizar avaliação' : 'Salvar avaliação'} />
      </LocalForm>
      {current ? <button className="button button-secondary" type="button" onClick={() => void deleteMeasurement()}>Excluir avaliação</button> : null}
      {notice ? <p role="status">{notice}</p> : null}
    </article>
    <article className="nutrition-card">
      <h2>Gráficos de medidas</h2>
      <div className="nutrition-form-grid">
        <label>Período<select value={range} onChange={(event) => setRange(Number(event.target.value))}>
          {periods.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select></label>
        <label>Indicador<select value={metric} onChange={(event) => setMetric(event.target.value as typeof metric)}>
          {BODY_METRIC_KEYS.map((key) => <option key={key} value={key}>{BODY_METRICS[key]}</option>)}
          <option value="movingAverage">Média móvel do peso</option>
        </select></label>
      </div>
      <TrendChart key={`${metric}-${range}`} points={points} label={label} />
      <p className="elite-caption">O gráfico usa o último valor disponível do indicador em cada dia. A média móvel usa as pesagens dos sete dias que terminam na data do ponto. Circunferências e gordura estimada, isoladamente, não medem massa muscular.</p>
    </article>
    {sorted.length > 1 ? <CompareMeasurements measurements={sorted} /> : null}
    {sorted.length ? <button className="button button-secondary button-wide" type="button" onClick={() => {
      const columns = ['Data', 'Hora ISO', ...BODY_METRIC_KEYS.map((key) => `${BODY_METRICS[key]} (${bodyMetricUnit(key)})`), 'Método da gordura', 'Observações'];
      const rows = sorted.map((item) => [item.date, item.measuredAt, ...BODY_METRIC_KEYS.map((key) => item[key]), item.method, item.notes]);
      const csv = [columns, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
      downloadLocalFile(new File(['\uFEFF', csv], `MeuTreino-medidas-${today}.csv`, { type: 'text/csv;charset=utf-8' }));
    }}>Baixar relatório de medidas em CSV</button> : null}
  </>;
}

function bodyChart(sorted: BodyMeasurement[], metric: BodyMetric | 'movingAverage', today: string, range: number) {
  const daily = new Map<string, { date: string; value: number | null; weightTotal: number; weighIns: number }>();
  for (const item of sorted) {
    if (item.date > today) continue;
    const row = daily.get(item.date) ?? { date: item.date, value: null, weightTotal: 0, weighIns: 0 };
    if (metric !== 'movingAverage') row.value ??= item[metric] ?? null;
    if (item.weightKg !== null) {
      row.weightTotal += item.weightKg;
      row.weighIns++;
    }
    daily.set(item.date, row);
  }
  const dates = [...daily.values()].reverse();
  if (metric === 'movingAverage') {
    let first = 0;
    let sum = 0;
    let count = 0;
    for (const row of dates) {
      sum += row.weightTotal;
      count += row.weighIns;
      const from = offsetDate(row.date, -6);
      while (dates[first].date < from) {
        sum -= dates[first].weightTotal;
        count -= dates[first].weighIns;
        first++;
      }
      row.value = count ? sum / count : null;
    }
  }
  const start = range ? offsetDate(today, 1 - range) : '';
  return dates.filter((row) => row.date >= start);
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  const safe = typeof value === 'string' && /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function CompareMeasurements({ measurements }: { measurements: BodyMeasurement[] }) {
  const [firstId, setFirstId] = useState(measurements[1].id);
  const [secondId, setSecondId] = useState(measurements[0].id);
  const first = measurements.find((item) => item.id === firstId) ?? measurements[1];
  const second = measurements.find((item) => item.id === secondId) ?? measurements[0];
  return <article className="nutrition-card">
    <h2>Comparar avaliações</h2>
    <div className="nutrition-form-grid">
      <label>Referência<select value={first.id} onChange={(event) => setFirstId(event.target.value)}>
        {measurements.map((item) => <option key={item.id} value={item.id}>{measurementLabel(item)}</option>)}
      </select></label>
      <label>Comparar com<select value={second.id} onChange={(event) => setSecondId(event.target.value)}>
        {measurements.map((item) => <option key={item.id} value={item.id}>{measurementLabel(item)}</option>)}
      </select></label>
    </div>
    {first.id === second.id ? <p>Selecione avaliações diferentes.</p> : <dl className="nutrition-mini-grid">
      {BODY_METRIC_KEYS.map((key) => {
        const before = first[key];
        const after = second[key];
        if (before == null || after == null) return null;
        const delta = after - before;
        const unit = bodyMetricUnit(key);
        return <div key={key}><dt>{BODY_METRICS[key]}</dt><dd>{display(before)} → {display(after)} {unit} · {delta > 0 ? '+' : ''}{display(delta)} {key === 'bodyFat' ? 'p.p.' : unit}
          {before && key !== 'bodyFat' ? ` (${delta > 0 ? '+' : ''}${display(delta / before * 100)}%)` : ''}</dd></div>;
      })}
    </dl>}
  </article>;
}
