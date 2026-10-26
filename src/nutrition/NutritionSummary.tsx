import { Apple, ArrowRight, Droplets } from "lucide-react";
import type { NutritionState } from "./types";
import { localDate, totalNutrients, weightAverage } from "./engine";
import "./nutrition.css";

export function NutritionSummary({
  state,
  onOpen,
}: {
  state: NutritionState;
  onOpen: () => void;
}) {
  const today = localDate();
  const total = totalNutrients(
    state.entries.filter(
      (entry) => entry.date === today && entry.kind === "consumed",
    ),
  );
  const day = state.days.find((entry) => entry.date === today);
  const goal = day?.goals ?? state.goals;
  const average = weightAverage(state.measurements, today);
  return (
    <section
      className="nutrition-card nutrition-home"
      aria-labelledby="nutrition-home-title"
    >
      <div className="nutrition-heading">
        <div>
          <span className="eyebrow">ALIMENTAÇÃO + RECUPERAÇÃO</span>
          <h2 id="nutrition-home-title">Seu dia, por inteiro</h2>
        </div>
        <Apple aria-hidden="true" />
      </div>
      <div className="nutrition-energy">
        <strong>
          {Math.round(total.kcal)}
          <small> kcal registradas</small>
        </strong>
        <span>
          {goal.kcal === null
            ? "Defina sua meta manualmente"
            : `Meta informada: ${goal.kcal} kcal`}
        </span>
      </div>
      <div className="nutrition-mini-grid">
        <span>
          <b>{Math.round(total.protein)} g</b>Proteína
        </span>
        <span>
          <b>{day?.waterMl ?? 0} ml</b>
          <Droplets size={12} /> Água
        </span>
        <span>
          <b>
            {average.value === null ? "—" : `${average.value.toFixed(1)} kg`}
          </b>
          Média de 7 dias · {average.count} registros
        </span>
      </div>
      <p className="elite-caption">
        {day?.complete
          ? "Diário marcado como completo por você."
          : "Diário parcial: ausência de registro não significa ausência de consumo."}{" "}
        Nenhuma caloria de treino é descontada da meta.
      </p>
      <button
        className="button button-secondary button-wide"
        type="button"
        onClick={onOpen}
      >
        Abrir Alimentação <ArrowRight size={17} />
      </button>
    </section>
  );
}
