import { useState } from "react";
import type { Food, MealEntry } from "./types";
import { CONFIDENCE, substitution } from "./engine";
import { display } from "./uiHelpers";

export function SubstitutionEditor({
  entry,
  catalog,
  onCancel,
  onSave,
  dayTotalKcal,
  limitKcal,
}: {
  entry: MealEntry;
  catalog: Food[];
  onCancel: () => void;
  onSave: (food: Food, quantity: number) => Promise<void>;
  dayTotalKcal?: number;
  limitKcal?: number | null;
}) {
  const [metric, setMetric] = useState<"kcal" | "protein" | "carbs" | "fat">(
    "kcal",
  );
  const alternatives = catalog
    .filter(
      (food) => food.group === entry.food.group && food.id !== entry.food.id,
    )
    .map((food) => ({
      food,
      result: substitution(entry.food, entry.quantity, food, metric),
    }))
    .filter((item) => item.result !== null);
  return (
    <article className="nutrition-card nutrition-swap" id="nutrition-swap">
      <h2>Substituir {entry.food.name}</h2>
      <p>
        Equivalência matemática aproximada no mesmo grupo. A troca não garante
        as mesmas fibras, vitaminas ou saciedade.
      </p>
      <label>
        Igualar
        <select
          value={metric}
          onChange={(event) => setMetric(event.target.value as typeof metric)}
        >
          <option value="kcal">Calorias</option>
          <option value="protein">Proteínas</option>
          <option value="carbs">Carboidratos</option>
          <option value="fat">Gorduras</option>
        </select>
      </label>
      <div className="nutrition-alternatives">
        {alternatives.map(({ food, result }) =>
          result ? (
            <div className="nutrition-entry" key={food.id}>
              <strong>
                {food.name} · {display(result.quantity, 1)} {food.unit}
              </strong>
              <small>{CONFIDENCE[food.confidence]}</small>
              <span>
                Diferença: {display(result.delta.kcal)} kcal · P{" "}
                {display(result.delta.protein)} g · C{" "}
                {display(result.delta.carbs)} g · G {display(result.delta.fat)}{" "}
                g · fibras {display(result.delta.fiber)} g
              </span>
              {dayTotalKcal !== undefined ? (
                <span>
                  Total do dia após a troca:{" "}
                  {display(dayTotalKcal + result.delta.kcal)} kcal
                  {limitKcal != null &&
                  dayTotalKcal + result.delta.kcal > limitKcal + 0.01
                    ? " · ultrapassa a meta informada"
                    : ""}
                  .
                </span>
              ) : null}
              {result.quantity > 1000 ? (
                <p className="nutrition-warning">
                  Quantidade elevada: não é uma sugestão de porção.
                </p>
              ) : null}
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  void onSave(food, result.quantity).catch(() => undefined)
                }
              >
                Aplicar esta troca
              </button>
            </div>
          ) : null,
        )}
      </div>
      {!alternatives.length ? (
        <p>Sem alternativas válidas no mesmo grupo para esse critério.</p>
      ) : null}
      <button
        type="button"
        className="button button-secondary"
        onClick={onCancel}
      >
        Fechar substituições
      </button>
    </article>
  );
}
