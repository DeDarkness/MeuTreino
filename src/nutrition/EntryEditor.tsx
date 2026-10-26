import { useState } from "react";
import { Search } from "lucide-react";
import type { Food, MealEntry } from "./types";
import { MEALS, CONFIDENCE, nutritionId } from "./engine";
import { numberValue, stringValue, normalized, display } from "./uiHelpers";
import { Field, SaveButton, LocalForm } from "./FormControls";

export function EntryEditor({
  catalog,
  favorites,
  editing,
  date,
  kind,
  order,
  onSave,
  onCancel,
  editorId = "meal-editor",
  defaultMeal = "Almoço",
}: {
  catalog: Food[];
  favorites: string[];
  editing: MealEntry | null;
  date: string;
  kind: MealEntry["kind"];
  order: number;
  onSave: (entry: MealEntry) => Promise<void>;
  onCancel: () => void;
  editorId?: string;
  defaultMeal?: string;
}) {
  const [query, setQuery] = useState("");
  const [foodId, setFoodId] = useState(editing?.food.id ?? "");
  const [unit, setUnit] = useState<"base" | "portion">("base");
  const food =
    foodId === editing?.food.id
      ? editing.food
      : catalog.find((item) => item.id === foodId);
  const choices = catalog
    .filter((item) =>
      normalized(`${item.name} ${item.group}`).includes(normalized(query)),
    )
    .sort(
      (a, b) =>
        Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)) ||
        a.name.localeCompare(b.name),
    );
  return (
    <article className="nutrition-card" id={editorId}>
      <h2>
        {editing
          ? "Editar registro"
          : kind === "planned"
            ? "Planejar alimento"
            : "Registrar alimento"}
      </h2>
      <LocalForm
        onSave={async (data) => {
          if (!food) throw new Error("Escolha um alimento.");
          const quantity = numberValue(data, "quantity");
          if (quantity === null) throw new Error("Informe a quantidade.");
          await onSave({
            id: editing?.id ?? nutritionId(),
            date,
            kind,
            food: structuredClone(food),
            quantity:
              quantity * (unit === "portion" ? (food.portionSize ?? 1) : 1),
            meal: stringValue(data, "meal"),
            time: stringValue(data, "time"),
            order: editing?.order ?? order,
            ...(editing?.preparationOnly !== undefined
              ? { preparationOnly: editing.preparationOnly }
              : {}),
            ...(editing?.planEntryId
              ? { planEntryId: editing.planEntryId }
              : {}),
          });
        }}
      >
        <label className="nutrition-search">
          <Search size={17} />
          <input
            type="search"
            aria-label="Buscar alimento para registrar"
            placeholder="Arroz, frango, ovo…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Alimento
          <select
            required
            value={foodId}
            onChange={(event) => {
              setFoodId(event.target.value);
              setUnit("base");
            }}
          >
            <option value="">Escolha entre {choices.length} alimentos</option>
            {editing && !choices.some((item) => item.id === editing.food.id) ? (
              <option value={editing.food.id}>
                {editing.food.name} · registro original
              </option>
            ) : null}
            {choices.map((item) => (
              <option key={item.id} value={item.id}>
                {favorites.includes(item.id) ? "★ " : ""}
                {item.name} · {item.unit}
              </option>
            ))}
          </select>
        </label>
        {food ? (
          <>
            <p className="nutrition-source">
              {CONFIDENCE[food.confidence]} · {food.source}
            </p>
            <p className="elite-caption">
              Por 100 {food.unit}: {display(food.per100.kcal)} kcal · P{" "}
              {display(food.per100.protein)} · C {display(food.per100.carbs)} ·
              G {display(food.per100.fat)} · fibras {display(food.per100.fiber)}{" "}
              g. {food.preparation}
            </p>
          </>
        ) : null}
        <div className="nutrition-form-grid">
          <label>
            Refeição
            <input
              name="meal"
              list={`${editorId}-meals`}
              required
              maxLength={120}
              defaultValue={editing?.meal ?? defaultMeal}
            />
            <datalist id={`${editorId}-meals`}>
              {MEALS.map((meal) => (
                <option key={meal}>{meal}</option>
              ))}
            </datalist>
          </label>
          <Field
            label="Horário (opcional)"
            name="time"
            type="time"
            value={editing?.time}
          />
          <Field
            key={`${foodId}-${unit}`}
            label={`Quantidade (${unit === "portion" ? "porções" : (food?.unit ?? "g/ml")})`}
            name="quantity"
            required
            min={0.001}
            max={100000}
            value={
              editing
                ? editing.quantity /
                  (unit === "portion" ? (food?.portionSize ?? 1) : 1)
                : null
            }
          />
          <label>
            Unidade
            <select
              value={unit}
              onChange={(event) =>
                setUnit(event.target.value as "base" | "portion")
              }
            >
              <option value="base">{food?.unit ?? "g/ml"}</option>
              {food?.portionSize ? (
                <option value="portion">
                  Porção de {food.portionSize} {food.unit}
                </option>
              ) : null}
            </select>
          </label>
        </div>
        <SaveButton
          label={editing ? "Salvar alteração" : "Adicionar alimento"}
        />
        {editing ? (
          <button
            type="button"
            className="button button-secondary"
            onClick={onCancel}
          >
            Cancelar edição
          </button>
        ) : null}
      </LocalForm>
    </article>
  );
}
