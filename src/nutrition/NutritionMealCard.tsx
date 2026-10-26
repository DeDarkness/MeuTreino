import { useId, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Coffee,
  Moon,
  Plus,
  Sun,
  Utensils,
} from "lucide-react";
import type { DailyFoodRow } from "./dailyView";
import { shortFoodName } from "./dailyView";
import { nutrientsFor } from "./engine";
import { display } from "./uiHelpers";

export function NutritionMealCard({
  meal,
  rows,
  plannedKcal,
  consumedKcal,
  mode,
  busy,
  future,
  onEdit,
  onToggle,
  onToggleMeal,
  onSwap,
  onAdd,
}: {
  meal: string;
  rows: DailyFoodRow[];
  plannedKcal: number;
  consumedKcal: number;
  mode: "diary" | "plan";
  busy: boolean;
  future: boolean;
  onEdit: (row: DailyFoodRow) => void;
  onToggle: (row: DailyFoodRow) => void;
  onToggleMeal: (checked: boolean) => void;
  onSwap?: () => void;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const planned = rows.filter((row) => row.plannedId);
  const currentRows =
    mode === "diary" && planned.length
      ? rows.filter((row) => row.plannedId)
      : rows;
  const extraRows =
    mode === "diary" && planned.length
      ? rows.filter((row) => !row.plannedId)
      : [];
  const main = currentRows.filter((row) => !row.entry.preparationOnly);
  const preparation = currentRows.filter((row) => row.entry.preparationOnly);
  const done = planned.length > 0 && planned.every((row) => row.checked);
  const lower = meal.toLocaleLowerCase("pt-BR");
  const tone = lower.includes("café")
    ? "morning"
    : lower.includes("almoço")
      ? "lunch"
      : lower.includes("jantar") || lower.includes("ceia")
        ? "evening"
        : "snack";
  const Icon =
    tone === "morning"
      ? Coffee
      : tone === "lunch"
        ? Sun
        : tone === "evening"
          ? Moon
          : Utensils;
  const rowView = (row: DailyFoodRow) => (
    <div
      className={`premium-food-row ${row.checked && mode === "diary" ? "eaten" : ""}`}
      key={row.entry.id}
    >
      {mode === "diary" && row.plannedId ? (
        <button
          className="food-check"
          role="checkbox"
          aria-checked={row.checked}
          aria-label={`${row.checked ? "Desmarcar" : "Marcar como comido"}: ${shortFoodName(row.entry.food.name)}`}
          type="button"
          disabled={busy || future}
          onClick={() => onToggle(row)}
        >
          {row.checked ? <Check size={16} strokeWidth={3} /> : null}
        </button>
      ) : (
        <span
          className={`food-dot ${row.checked && mode === "diary" ? "eaten" : ""}`}
          aria-hidden="true"
        >
          {row.checked && mode === "diary" ? <Check size={12} /> : null}
        </span>
      )}
      <button
        className="food-row-edit"
        type="button"
        aria-label={`Editar ${shortFoodName(row.entry.food.name)}: ${display(row.entry.quantity)} ${row.entry.food.unit}`}
        onClick={() => onEdit(row)}
      >
        <span>
          <strong>{shortFoodName(row.entry.food.name)}</strong>
          <small>
            {display(row.entry.quantity, 1)} {row.entry.food.unit}
            {row.entry.kind === "consumed" && mode === "diary"
              ? " · consumido"
              : " · planejado"}
          </small>
        </span>
        <span className="food-row-energy">
          {display(nutrientsFor(row.entry.food, row.entry.quantity).kcal, 0)}
          <small>kcal</small>
        </span>
      </button>
    </div>
  );
  return (
    <article
      className={`premium-meal-card ${tone} ${done && mode === "diary" ? "complete" : ""}`}
      aria-label={meal}
    >
      <button
        className="premium-meal-heading"
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="meal-symbol">
          <Icon size={21} />
        </span>
        <span className="meal-heading-text">
          <strong>{meal}</strong>
          <small>
            {mode === "plan"
              ? "Planejado"
              : done
                ? "Refeição registrada"
                : consumedKcal > 0
                  ? `${display(consumedKcal, 0)} kcal registradas`
                  : planned.length
                    ? "Pronta para registrar"
                    : "Seus registros"}
          </small>
        </span>
        <span className="meal-kcal">
          <b>
            {display(
              mode === "plan" || consumedKcal === 0
                ? plannedKcal
                : consumedKcal,
              0,
            )}
          </b>
          <small>
            kcal
            {mode === "diary" && consumedKcal === 0 && planned.length
              ? " previstas"
              : ""}
          </small>
        </span>
        <ChevronDown size={16} className={open ? "rotated" : ""} />
      </button>
      {!open ? (
        <p className="meal-food-preview">
          {main.map((row) => shortFoodName(row.entry.food.name)).join(" · ") ||
            "Adicione os alimentos desta refeição"}
        </p>
      ) : null}
      {open ? (
        <div id={id} className="premium-meal-foods">
          {main.map(rowView)}
          {extraRows.length ? (
            <details className="premium-preparation">
              <summary>Já registrado fora deste plano</summary>
              <p>
                Consumo preservado após troca de plano ou registro avulso. Não
                precisa registrar estes itens de novo.
              </p>
              {extraRows.map(rowView)}
            </details>
          ) : null}
          {preparation.length ? (
            <details className="premium-preparation">
              <summary>
                Preparo incluído{" "}
                <span>
                  {display(
                    preparation.reduce(
                      (sum, row) =>
                        sum +
                        nutrientsFor(row.entry.food, row.entry.quantity).kcal,
                      0,
                    ),
                    0,
                  )}{" "}
                  kcal
                </span>
              </summary>
              <p>
                Temperos e óleo já entram na conta. A referência não mede sua
                receita caseira.
              </p>
              {preparation.map(rowView)}
            </details>
          ) : null}
          <button
            className="meal-add-food"
            type="button"
            onClick={onAdd}
            disabled={future && mode === "diary"}
          >
            <Plus size={16} />
            Adicionar alimento
          </button>
        </div>
      ) : null}
      {extraRows.length ? (
        <p className="meal-existing-note">
          + {extraRows.length}{" "}
          {extraRows.length === 1
            ? "item já registrado"
            : "itens já registrados"}{" "}
          fora deste plano
        </p>
      ) : null}
      <footer className="premium-meal-actions">
        {mode === "diary" && planned.length ? (
          <button
            className={`meal-record-button ${done ? "done" : ""}`}
            type="button"
            disabled={busy || future}
            aria-label={
              done
                ? `Desfazer registro da refeição ${meal}`
                : `Comi esta refeição: ${meal}`
            }
            onClick={() => onToggleMeal(!done)}
          >
            <Check size={17} />
            {done ? "Registrada · desfazer" : "Comi esta refeição"}
          </button>
        ) : (
          <button
            className="meal-record-button neutral"
            type="button"
            onClick={() => setOpen(!open)}
          >
            {open ? "Recolher alimentos" : "Ver e editar"}
          </button>
        )}
        {onSwap ? (
          <button
            className="meal-swap-button"
            type="button"
            onClick={onSwap}
            disabled={busy}
          >
            <ArrowLeftRight size={15} />
            Trocar
          </button>
        ) : (
          <button
            className="meal-swap-button"
            type="button"
            onClick={onAdd}
            disabled={future && mode === "diary"}
          >
            <Plus size={15} />
            Adicionar
          </button>
        )}
      </footer>
    </article>
  );
}
