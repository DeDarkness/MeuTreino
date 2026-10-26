import { useState } from "react";
import type { NutritionState, BodyMeasurement } from "./types";
import { weightAverage, localDate, offsetDate, nutritionId } from "./engine";
import { numberValue, stringValue, display, type Update } from "./uiHelpers";
import { Field, SaveButton, LocalForm } from "./FormControls";
import { TrendChart } from "./TrendChart";

export function BodyPanel({
  state,
  change,
}: {
  state: NutritionState;
  change: Update;
}) {
  const [date, setDate] = useState(localDate);
  const [range, setRange] = useState(30);
  const [metric, setMetric] = useState<"weightKg" | "waistCm" | "bodyFat">(
    "weightKg",
  );
  const current = state.measurements.find((item) => item.date === date);
  const average = weightAverage(state.measurements, localDate());
  const composition = [...state.measurements]
    .filter(
      (item) =>
        item.date <= localDate() &&
        item.weightKg !== null &&
        item.bodyFat !== null,
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const points = state.measurements
    .filter(
      (item) =>
        item.date >= offsetDate(localDate(), -range + 1) &&
        item.date <= localDate(),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({ date: item.date, value: item[metric] }));
  return (
    <>
      <article className="nutrition-card">
        <span className="eyebrow">MEDIR NÃO É ESTIMAR</span>
        <h2>Corpo em perspectiva</h2>
        {composition ? (
          <p>
            Última gordura estimada: {display(composition.bodyFat)}% (
            {composition.method}). Massa livre de gordura estimada:{" "}
            {display(composition.weightKg! * (1 - composition.bodyFat! / 100))}{" "}
            kg. Não é uma medida de massa muscular.
          </p>
        ) : null}
        <p>
          Média dos últimos 7 dias: <strong>{display(average.value)} kg</strong>{" "}
          · {average.count} pesagens registradas.
        </p>
        <div className="nutrition-mini-grid">
          {[7, 14, 30].map((days) => {
            const mean = weightAverage(state.measurements, localDate(), days);
            return (
              <span key={days}>
                <b>{display(mean.value)} kg</b>Média {days} dias · {mean.count}{" "}
                registros
              </span>
            );
          })}
        </div>
        <div className="nutrition-form-grid">
          <label>
            Período
            <select
              value={range}
              onChange={(event) => setRange(Number(event.target.value))}
            >
              {[7, 14, 30, 90].map((days) => (
                <option key={days} value={days}>
                  {days} dias
                </option>
              ))}
            </select>
          </label>
          <label>
            Indicador
            <select
              value={metric}
              onChange={(event) =>
                setMetric(event.target.value as typeof metric)
              }
            >
              <option value="weightKg">Peso (kg)</option>
              <option value="waistCm">Cintura (cm)</option>
              <option value="bodyFat">Gordura estimada (%)</option>
            </select>
          </label>
        </div>
        <TrendChart
          points={points}
          label={
            metric === "weightKg"
              ? "Peso (kg)"
              : metric === "waistCm"
                ? "Cintura (cm)"
                : "Gordura estimada (%)"
          }
        />
        <p className="elite-caption">
          Sem interpolar pesagens ausentes. Gordura e massa livre de gordura são
          estimativas; massa livre de gordura não é massa muscular.
        </p>
      </article>
      <article className="nutrition-card">
        <h2>Registrar medidas</h2>
        <label>
          Data
          <input
            type="date"
            max={localDate()}
            value={date}
            onChange={(event) => {
              if (event.target.value) setDate(event.target.value);
            }}
          />
        </label>
        <LocalForm
          key={date}
          onSave={async (data) => {
            if (date > localDate())
              throw new Error("Use uma data atual ou passada.");
            const measurement: BodyMeasurement = {
              id: current?.id ?? nutritionId(),
              date,
              weightKg: numberValue(data, "weightKg"),
              waistCm: numberValue(data, "waistCm"),
              hipCm: numberValue(data, "hipCm"),
              armCm: numberValue(data, "armCm"),
              chestCm: numberValue(data, "chestCm"),
              thighCm: numberValue(data, "thighCm"),
              calfCm: numberValue(data, "calfCm"),
              bodyFat: numberValue(data, "bodyFat"),
              method: stringValue(data, "method"),
              notes: stringValue(data, "notes"),
            };
            if (
              [
                measurement.weightKg,
                measurement.waistCm,
                measurement.hipCm,
                measurement.armCm,
                measurement.chestCm,
                measurement.thighCm,
                measurement.calfCm,
                measurement.bodyFat,
              ].every((value) => value === null)
            )
              throw new Error("Informe pelo menos uma medida.");
            await change((next) => ({
              ...next,
              measurements: [
                ...next.measurements.filter((item) => item.date !== date),
                measurement,
              ],
            }));
          }}
        >
          <div className="nutrition-form-grid">
            {(
              [
                ["weightKg", "Peso (kg)", 20, 500],
                ["waistCm", "Cintura (cm)", 1, 400],
                ["hipCm", "Quadril (cm)", 1, 400],
                ["armCm", "Braço (cm)", 1, 400],
                ["chestCm", "Peitoral (cm)", 1, 400],
                ["thighCm", "Coxa (cm)", 1, 400],
                ["calfCm", "Panturrilha (cm)", 1, 400],
                ["bodyFat", "Gordura estimada (%)", 1, 75],
              ] as const
            ).map(([key, label, min, max]) => (
              <Field
                label={label}
                name={key}
                key={key}
                value={current?.[key]}
                min={min}
                max={max}
              />
            ))}
          </div>
          <Field
            label="Método da estimativa de gordura (obrigatório se informada)"
            name="method"
            type="text"
            value={current?.method}
          />
          <Field
            label="Observações das medidas"
            name="notes"
            type="textarea"
            value={current?.notes}
          />
          <SaveButton
            label={current ? "Atualizar medidas desse dia" : "Salvar medidas"}
          />
        </LocalForm>
      </article>
    </>
  );
}
