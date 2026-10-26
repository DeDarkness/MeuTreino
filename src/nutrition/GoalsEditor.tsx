import type { NutritionState, NutritionGoals } from "./types";
import {
  restingEnergy,
  ensureNutritionDay,
  localDate,
  macroEnergy,
} from "./engine";
import {
  numberValue,
  stringValue,
  display,
  dateLabel,
  type Update,
} from "./uiHelpers";
import { Field, SaveButton, LocalForm } from "./FormControls";

export function GoalsEditor({
  state,
  date,
  change,
}: {
  state: NutritionState;
  date: string;
  change: Update;
}) {
  const profile = state.profile;
  const observed = [...state.measurements]
    .filter((item) => item.weightKg !== null && item.date <= localDate())
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg;
  const resting = restingEnergy(profile, observed);
  const expenditure =
    resting && profile.activityFactor ? resting * profile.activityFactor : null;
  const macros =
    state.goals.protein !== null &&
    state.goals.carbs !== null &&
    state.goals.fat !== null
      ? macroEnergy({
          protein: state.goals.protein,
          carbs: state.goals.carbs,
          fat: state.goals.fat,
        })
      : null;
  return (
    <>
      <article className="nutrition-card">
        <h2>Metas definidas por você</h2>
        <p>
          Nenhuma meta é prescrita automaticamente. Registre a orientação do
          nutricionista. Não ajustamos calorias por um dia de pesagem nem
          adicionamos “créditos” do treino.
        </p>
        {profile.surgeryDate ? (
          <p className="nutrition-warning">
            Com cirurgia planejada, valide a ingestão e a estabilidade de peso
            com sua equipe. O aplicativo não determina aptidão cirúrgica.
          </p>
        ) : null}
        {profile.preferredKcalMin !== null ? (
          <p className="nutrition-warning">
            Preferência registrada: {display(profile.preferredKcalMin, 0)}–{display(profile.preferredKcalMax, 0)} kcal, ainda não é uma meta validada.
            {resting !== null && profile.preferredKcalMin < resting ? " Essa faixa começa abaixo do repouso estimado e pode representar restrição elevada." : " Revise a adequação com seu nutricionista antes de usá-la."}
            {profile.surgeryDate ? " A preparação cirúrgica exige avaliação da equipe responsável." : ""}
          </p>
        ) : null}
        {state.goals.kcal !== null &&
        ((expenditure !== null && state.goals.kcal < expenditure * 0.75) ||
          (resting !== null && state.goals.kcal < resting)) ? (
          <p className="nutrition-warning">
            Meta abaixo do gasto de repouso estimado ou mais de 25% abaixo do
            gasto total estimado: possível restrição elevada. Isso é um sinal de
            revisão, não um diagnóstico ou um limite de segurança.
          </p>
        ) : null}
        <LocalForm
          key={`goals-${date}`}
          onSave={async (data) => {
            const goals: NutritionGoals = {
              kcal: numberValue(data, "kcal"),
              protein: numberValue(data, "protein"),
              carbs: numberValue(data, "carbs"),
              fat: numberValue(data, "fat"),
              fiber: numberValue(data, "fiber"),
              waterMl: numberValue(data, "waterMl"),
              validated: data.get("validated") === "on",
              professionalNote: stringValue(data, "professionalNote"),
            };
            await change((current) => {
              const next = ensureNutritionDay(current, date);
              return {
                ...next,
                goals,
                days: next.days.map((day) =>
                  day.date === date
                    ? { ...day, goals: structuredClone(goals) }
                    : day,
                ),
              };
            });
          }}
        >
          <div className="nutrition-form-grid">
            {(
              [
                ["kcal", "Calorias (kcal)"],
                ["protein", "Proteína (g)"],
                ["carbs", "Carboidratos (g)"],
                ["fat", "Gorduras (g)"],
                ["fiber", "Fibras (g)"],
                ["waterMl", "Água (ml)"],
              ] as const
            ).map(([key, label]) => (
              <Field
                key={key}
                label={label}
                name={key}
                value={state.goals[key]}
                max={key === "waterMl" ? 20000 : key === "kcal" ? 10000 : 3000}
              />
            ))}
          </div>
          <Field
            label="Orientação profissional / data / contexto"
            name="professionalNote"
            type="textarea"
            value={state.goals.professionalNote}
          />
          <label className="nutrition-checkbox">
            <input
              name="validated"
              type="checkbox"
              defaultChecked={state.goals.validated}
            />
            Tenho uma meta validada por profissional e registrei a orientação
          </label>
          <p className="elite-caption">
            Aplica a meta ao dia selecionado ({dateLabel(date)}) e a novos dias.
            Dias anteriores mantêm sua própria meta registrada.
          </p>
          <p>
            4P + 4C + 9G: <strong>{display(macros, 0)} kcal</strong>
            {macros !== null && state.goals.kcal !== null
              ? ` · diferença para a meta: ${display(state.goals.kcal - macros)} kcal`
              : ""}
          </p>
          <SaveButton label="Salvar metas manuais" />
        </LocalForm>
      </article>
      <article className="nutrition-card">
        <h2>Perfil e estimativas</h2>
        <p>
          Campos em branco não serão preenchidos por suposição. Peso e gordura
          de referência são estimativas informadas, não medições.
        </p>
        <LocalForm
          key={JSON.stringify(profile)}
          onSave={async (data) => {
            await change((current) => ({
              ...current,
              profile: {
                ...current.profile,
                age: numberValue(data, "age"),
                sex: (stringValue(data, "sex") ||
                  null) as NutritionState["profile"]["sex"],
                heightCm: numberValue(data, "heightCm"),
                referenceWeightKg: numberValue(data, "referenceWeightKg"),
                targetWeightKg: numberValue(data, "targetWeightKg"),
                estimatedBodyFat: numberValue(data, "estimatedBodyFat"),
                activityFactor: numberValue(data, "activityFactor"),
                preferredKcalMin: numberValue(data, "preferredKcalMin"),
                preferredKcalMax: numberValue(data, "preferredKcalMax"),
              },
            }));
          }}
        >
          <div className="nutrition-form-grid">
            <Field
              label="Idade para estimativa (anos)"
              name="age"
              value={profile.age}
              min={18}
              max={110}
            />
            <label>
              Sexo para a equação
              <select name="sex" defaultValue={profile.sex ?? ""}>
                <option value="">Não informado</option>
                <option value="male">Masculino</option>
                <option value="female">Feminino</option>
              </select>
            </label>
            <Field
              label="Altura (cm)"
              name="heightCm"
              value={profile.heightCm}
              min={100}
              max={250}
            />
            <Field
              label="Peso de referência estimado (kg)"
              name="referenceWeightKg"
              value={profile.referenceWeightKg}
              min={20}
              max={500}
            />
            <Field
              label="Meta desejada de peso (kg)"
              name="targetWeightKg"
              value={profile.targetWeightKg}
              min={20}
              max={500}
            />
            <Field
              label="Gordura corporal estimada (%)"
              name="estimatedBodyFat"
              value={profile.estimatedBodyFat}
              min={1}
              max={75}
            />
            <Field
              label="Fator de atividade informado (opcional)"
              name="activityFactor"
              value={profile.activityFactor}
              min={1}
              max={3}
            />
            <Field
              label="Preferência calórica mínima (não é meta)"
              name="preferredKcalMin"
              value={profile.preferredKcalMin}
              min={1}
              max={10000}
            />
            <Field
              label="Preferência calórica máxima (não é meta)"
              name="preferredKcalMax"
              value={profile.preferredKcalMax}
              min={1}
              max={10000}
            />
          </div>
          <SaveButton label="Salvar perfil local" />
        </LocalForm>
        <p>
          Repouso estimado (Mifflin–St Jeor):{" "}
          <strong>{display(resting, 0)} kcal/dia</strong>
          <br />
          Gasto total estimado:{" "}
          <strong>{display(expenditure, 0)} kcal/dia</strong>
        </p>
        <p className="elite-caption">
          Não são medições. Fator de atividade e equação têm incerteza; não são
          usados para criar uma dieta automaticamente.{" "}
          <a
            href="https://pubmed.ncbi.nlm.nih.gov/2305711/"
            target="_blank"
            rel="noreferrer"
          >
            Fonte da equação
          </a>{" "}
          ·{" "}
          <a
            href="https://fdc.nal.usda.gov/Foundation_Foods_Documentation/"
            target="_blank"
            rel="noreferrer"
          >
            Energia e fatores nutricionais
          </a>
          .
        </p>
      </article>
    </>
  );
}
