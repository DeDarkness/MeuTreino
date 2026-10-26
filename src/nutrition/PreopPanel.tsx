import type { ActionConfirmation } from "../components/ActionDialog";
import type { NutritionState } from "./types";
import {
  observedStability,
  localDate,
  weightAverage,
  nutritionId,
} from "./engine";
import {
  numberValue,
  stringValue,
  display,
  dateLabel,
  type Update,
} from "./uiHelpers";
import { Field, SaveButton, LocalForm } from "./FormControls";

export function PreopPanel({
  state,
  change,
  confirm,
}: {
  state: NutritionState;
  change: Update;
  confirm: (action: ActionConfirmation) => void;
}) {
  const profile = state.profile;
  const today = localDate();
  const countdown = profile.surgeryDate
    ? Math.round(
        (Date.parse(`${profile.surgeryDate}T12:00:00`) -
          Date.parse(`${today}T12:00:00`)) /
          86400000,
      )
    : null;
  const stability = observedStability(state);
  return (
    <>
      <article className="nutrition-card">
        <span className="eyebrow">PREPARAÇÃO, NÃO LIBERAÇÃO</span>
        <h2>Pré-operatório</h2>
        <p>
          {countdown === null
            ? "Informe a data prevista com sua equipe."
            : countdown >= 0
              ? `${countdown} dias até a data informada (${dateLabel(profile.surgeryDate!)}).`
              : "Data informada já passou; atualize as orientações com sua equipe."}
        </p>
        <p>
          Meta de peso desejada: {display(profile.targetWeightKg)} kg · média de
          7 dias: {display(weightAverage(state.measurements, today).value)} kg.
        </p>
        <p className="nutrition-warning">
          Peso ou percentual de gordura não comprovam aptidão cirúrgica. Perda
          acelerada não garante segurança. Metas, liberação e estabilidade
          precisam da avaliação da equipe responsável.
        </p>
        <p>
          {stability
            ? `${stability.status} · ${stability.count} pesagens · amplitude ${display(stability.range)} kg.`
            : "Sem período e tolerância de estabilidade informados pela equipe."}
        </p>
        <p className="elite-caption">
          Apenas descreve registros disponíveis; não é um certificado de
          estabilidade ou liberação.
        </p>
        <LocalForm
          onSave={async (data) => {
            await change((current) => ({
              ...current,
              profile: {
                ...current.profile,
                surgeryDate: stringValue(data, "surgeryDate") || null,
                stabilityDays: numberValue(data, "stabilityDays"),
                stabilityToleranceKg: numberValue(data, "stabilityToleranceKg"),
                medicalNotes: stringValue(data, "medicalNotes"),
                clearanceNote: stringValue(data, "clearanceNote"),
              },
            }));
          }}
        >
          <Field
            label="Data prevista da cirurgia"
            name="surgeryDate"
            type="date"
            value={profile.surgeryDate}
          />
          <Field
            label="Dias de estabilidade orientados pela equipe"
            name="stabilityDays"
            value={profile.stabilityDays}
            min={2}
            max={365}
          />
          <Field
            label="Tolerância de variação orientada (kg)"
            name="stabilityToleranceKg"
            value={profile.stabilityToleranceKg}
            min={0}
            max={50}
          />
          <Field
            label="Orientações médicas e nutricionais"
            name="medicalNotes"
            type="textarea"
            value={profile.medicalNotes}
            maxLength={5000}
          />
          <Field
            label="Registro de liberação informado por você (profissional/data/escopo)"
            name="clearanceNote"
            type="textarea"
            value={profile.clearanceNote}
            maxLength={5000}
          />
          <SaveButton label="Salvar orientações locais" />
        </LocalForm>
      </article>
      <article className="nutrition-card">
        <h2>Checklist para consultas</h2>
        {state.checklist.map((item) => (
          <div className="nutrition-checklist" key={item.id}>
            <label className="nutrition-checkbox">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() =>
                  void change((current) => ({
                    ...current,
                    checklist: current.checklist.map((check) =>
                      check.id === item.id
                        ? { ...check, done: !check.done }
                        : check,
                    ),
                  })).catch(() => undefined)
                }
              />
              {item.text}
            </label>
            <button
              type="button"
              onClick={() =>
                confirm({
                  title: "Remover item do checklist?",
                  message: "Não altera suas orientações médicas.",
                  confirmLabel: "Remover item",
                  onConfirm: () =>
                    change((current) => ({
                      ...current,
                      checklist: current.checklist.filter(
                        (check) => check.id !== item.id,
                      ),
                    })),
                })
              }
            >
              Remover
            </button>
          </div>
        ))}
        <LocalForm
          onSave={async (data) => {
            await change((current) => ({
              ...current,
              checklist: [
                ...current.checklist,
                {
                  id: nutritionId(),
                  text: stringValue(data, "text"),
                  done: false,
                },
              ],
            }));
          }}
        >
          <Field
            label="Novo item do checklist"
            name="text"
            type="text"
            required
            maxLength={500}
          />
          <SaveButton label="Adicionar item" />
        </LocalForm>
      </article>
    </>
  );
}
