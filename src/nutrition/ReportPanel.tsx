import { useState } from "react";
import type { WorkoutHistory } from "../types";
import type { NutritionState } from "./types";
import {
  nutritionReport,
  localDate,
  weightAverage,
  offsetDate,
  reportCsv,
} from "./engine";
import { display, dateLabel } from "./uiHelpers";
import { TrendChart } from "./TrendChart";

export function ReportPanel({
  state,
  history,
}: {
  state: NutritionState;
  history: WorkoutHistory[];
}) {
  const [end, setEnd] = useState(localDate);
  const [days, setDays] = useState(7);
  const report = nutritionReport(state, end, days);
  const complete = report.filter((row) => row.complete);
  const average = (key: "kcal" | "protein") =>
    complete.length
      ? complete.reduce((sum, row) => sum + row.totals[key], 0) /
        complete.length
      : null;
  const sessions = history.filter(
    (session) =>
      localDate(new Date(session.finishedAt)) >= offsetDate(end, -days + 1) &&
      localDate(new Date(session.finishedAt)) <= end,
  );
  const sets = sessions.reduce(
    (sum, session) =>
      sum +
      session.exercises.reduce(
        (total, exercise) => total + exercise.sets.length,
        0,
      ),
    0,
  );
  const exportCsv = () => {
    const url = URL.createObjectURL(
      new Blob([reportCsv(state, end, days)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `meutreino-alimentacao-${end}-${days}dias.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <article className="nutrition-card nutrition-report">
      <span className="eyebrow">DADOS, SEM PROMESSAS</span>
      <h2>Relatório integrado</h2>
      <div className="nutrition-form-grid">
        <label>
          Até o dia
          <input
            type="date"
            value={end}
            max={localDate()}
            onChange={(event) => {
              if (event.target.value) setEnd(event.target.value);
            }}
          />
        </label>
        <label>
          Janela
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            {[7, 14, 30].map((number) => (
              <option key={number} value={number}>
                {number} dias
              </option>
            ))}
          </select>
        </label>
      </div>
      <p>
        {complete.length} de {days} dias marcados como completos. Médias
        alimentares abaixo usam só esses dias; registros parciais não viram
        consumo zero.
      </p>
      <div className="nutrition-mini-grid">
        <span>
          <b>{display(average("kcal"), 0)}</b>kcal/dia completo
        </span>
        <span>
          <b>{display(average("protein"))} g</b>proteína/dia completo
        </span>
        <span>
          <b>{sets}</b>séries em {sessions.length} registros
        </span>
      </div>
      <p>
        Peso médio de 7 dias no fim da janela:{" "}
        {display(weightAverage(state.measurements, end).value)} kg.
      </p>
      <p className="elite-caption">
        Dados podem estar incompletos e alimentos podem ser aproximados.
        Tendências simultâneas não demonstram causalidade. Sem estimativa
        automática de calorias da musculação.
      </p>
      <div className="nutrition-report-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={exportCsv}
        >
          Exportar CSV
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => window.print()}
        >
          Imprimir / Salvar PDF
        </button>
      </div>
      <p className="elite-caption">
        Para PDF, use Salvar como PDF ou Compartilhar na tela de impressão do
        aparelho. Não é enviado à nuvem.
      </p>
      <TrendChart
        points={report.map((row) => ({
          date: row.date,
          value: row.hasFood ? row.totals.kcal : null,
        }))}
        label="Calorias registradas (kcal)"
      />
      <TrendChart
        points={report.map((row) => ({
          date: row.date,
          value: row.sleepHours,
        }))}
        label="Sono informado (h)"
      />
      <div className="nutrition-table-wrap">
        <table>
          <caption>
            Registros de {dateLabel(offsetDate(end, -days + 1))} a{" "}
            {dateLabel(end)}
          </caption>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Diário</th>
              <th>kcal</th>
              <th>P (g)</th>
              <th>Peso</th>
              <th>Cintura</th>
              <th>Sono</th>
            </tr>
          </thead>
          <tbody>
            {report.map((row) => (
              <tr key={row.date}>
                <td>{dateLabel(row.date)}</td>
                <td>{row.complete ? "Completo" : "Parcial / sem registro"}</td>
                <td>{row.hasFood ? display(row.totals.kcal, 0) : "—"}</td>
                <td>{row.hasFood ? display(row.totals.protein) : "—"}</td>
                <td>{display(row.weightKg)}</td>
                <td>{display(row.waistCm)}</td>
                <td>{display(row.sleepHours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
