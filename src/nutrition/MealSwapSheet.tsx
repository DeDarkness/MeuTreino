import { useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import type { Food, NutritionState } from "./types";
import type { Update } from "./uiHelpers";
import { display } from "./uiHelpers";
import { NutritionSheet } from "./NutritionSheet";
import { STARTER_DIET_MEALS, starterDietEntries } from "./starterDiet";
import { shortFoodName, replacePresetMeal } from "./dailyView";
import { totalNutrients } from "./engine";

export function MealSwapSheet({
  state,
  date,
  meal,
  catalog,
  change,
  onClose,
}: {
  state: NutritionState;
  date: string;
  meal: string;
  catalog: Food[];
  change: Update;
  onClose: () => void;
}) {
  const index = STARTER_DIET_MEALS.findIndex((item) => item.meal === meal);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const other = state.entries.filter(
    (entry) =>
      entry.date === date && entry.kind === "planned" && entry.meal !== meal,
  );
  const options = (STARTER_DIET_MEALS[index]?.options ?? []).map(
    (option, at) => {
      const choices = STARTER_DIET_MEALS.map(() => 0);
      choices[index] = at;
      const entries = starterDietEntries(date, choices, catalog).filter(
        (entry) => entry.meal === meal,
      );
      return {
        ...option,
        entries,
        macros: totalNutrients(entries),
        projected: totalNutrients([...other, ...entries]).kcal,
      };
    },
  );
  const save = async () => {
    if (selected === null || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await change(
        (current) => replacePresetMeal(current, date, meal, selected, catalog),
        "Antes de trocar a refeição planejada",
      );
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível trocar.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <NutritionSheet
      title="O que você prefere?"
      subtitle={meal}
      onClose={onClose}
      busy={busy}
      footer={
        <button
          className="button button-primary button-wide"
          type="button"
          disabled={selected === null || busy}
          onClick={() => void save()}
        >
          {busy ? "Salvando…" : "Usar esta refeição"}
          <ArrowRight size={17} />
        </button>
      }
    >
      <p className="premium-caption">
        Escolha uma opção pronta. Muda apenas o plano deste dia; o que já foi
        consumido permanece registrado.
      </p>
      <div className="premium-meal-options">
        {options.map((option, at) => (
          <button
            key={option.name}
            type="button"
            disabled={busy || option.projected > 1700}
            className={selected === at ? "selected" : ""}
            onClick={() => setSelected(at)}
          >
            <span className="option-pick">
              {selected === at ? <Check size={15} /> : null}
            </span>
            <span>
              <strong>{option.name}</strong>
              <small>
                {option.entries
                  .filter((entry) => !entry.preparationOnly)
                  .map(
                    (entry) =>
                      `${display(entry.quantity, 0)} ${entry.food.unit} ${shortFoodName(entry.food.name)}`,
                  )
                  .join(" · ")}
              </small>
              <span className="option-macros">
                {display(option.macros.kcal, 0)} kcal <i />{" "}
                {display(option.macros.protein, 0)} g proteína
              </span>
              {option.projected > 1700 ? (
                <small>Passaria de 1.700 kcal no plano atual</small>
              ) : null}
            </span>
          </button>
        ))}
      </div>
      {selected !== null ? (
        <div className="meal-swap-projection">
          <span>Plano do dia com esta opção</span>
          <b>{display(options[selected].projected, 0)} kcal</b>
        </div>
      ) : null}
      <p className="premium-caption">
        Referências aproximadas. Marcas, preparo e ingredientes extras alteram
        os valores. As opções não têm macros idênticos.
      </p>
      {error ? (
        <p role="alert" className="nutrition-warning">
          {error}
        </p>
      ) : null}
    </NutritionSheet>
  );
}
