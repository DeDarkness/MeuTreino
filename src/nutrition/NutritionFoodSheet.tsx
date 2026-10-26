import { useRef, useState } from "react";
import {
  Minus,
  Plus,
  Search,
  Check,
  ArrowLeftRight,
  Pencil,
} from "lucide-react";
import { NutritionSheet } from "./NutritionSheet";
import { CONFIDENCE, nutrientsFor, substitution } from "./engine";
import type { Food, MealEntry } from "./types";
import { display, normalized } from "./uiHelpers";
import { shortFoodName } from "./dailyView";

export function NutritionFoodSheet({
  entry,
  catalog,
  totalKcal,
  limitKcal,
  onSave,
  onRemove,
  onClose,
}: {
  entry: MealEntry;
  catalog: Food[];
  totalKcal: number;
  limitKcal: number | null;
  onSave: (entry: MealEntry) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"quantity" | "swap">("quantity");
  const [quantity, setQuantity] = useState(String(entry.quantity));
  const [selected, setSelected] = useState<Food>(entry.food);
  const [query, setQuery] = useState("");
  const [metric, setMetric] = useState<"kcal" | "protein" | "carbs" | "fat">(
    "kcal",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const amount = Number(quantity.replace(",", "."));
  const valid =
    quantity.trim() !== "" &&
    Number.isFinite(amount) &&
    amount > 0 &&
    amount <= 100000;
  const macros = valid ? nutrientsFor(selected, amount) : null;
  const projected = macros
    ? totalKcal - nutrientsFor(entry.food, entry.quantity).kcal + macros.kcal
    : totalKcal;
  const alternatives = catalog
    .filter(
      (food) =>
        food.id !== entry.food.id &&
        food.group === entry.food.group &&
        normalized(food.name).includes(normalized(query)),
    )
    .map((food) => ({
      food,
      result: substitution(entry.food, entry.quantity, food, metric),
    }))
    .filter((item) => item.result !== null)
    .sort(
      (a, b) => Math.abs(a.result!.delta.kcal) - Math.abs(b.result!.delta.kcal),
    )
    .slice(0, 24);
  const perform = async (operation: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <NutritionSheet
      title={shortFoodName(entry.food.name)}
      subtitle={`${entry.kind === "consumed" ? "Editando o que você comeu" : "Editando o planejado"} · ${entry.meal}`}
      onClose={onClose}
      busy={busy}
      footer={
        <button
          className="button button-primary button-wide"
          type="button"
          disabled={
            !valid || busy || (tab === "swap" && selected.id === entry.food.id)
          }
          onClick={() =>
            void perform(() =>
              onSave({ ...entry, food: selected, quantity: amount }),
            )
          }
        >
          {busy
            ? "Salvando…"
            : tab === "swap"
              ? "Confirmar troca"
              : "Salvar quantidade"}
        </button>
      }
    >
      <fieldset className="nutrition-fieldset" disabled={busy}>
        <div className="nutrition-segment">
          <button
            type="button"
            className={tab === "quantity" ? "selected" : ""}
            onClick={() => setTab("quantity")}
          >
            <Pencil size={16} />
            Quantidade
          </button>
          <button
            type="button"
            className={tab === "swap" ? "selected" : ""}
            onClick={() => setTab("swap")}
          >
            <ArrowLeftRight size={16} />
            Substituir
          </button>
        </div>
        {tab === "quantity" ? (
          <div className="food-quantity-editor">
            <span>
              Quanto{" "}
              {entry.kind === "consumed" ? "você comeu" : "está planejado"}?
            </span>
            <div>
              <button
                type="button"
                aria-label="Diminuir 10"
                className="nutrition-icon-button"
                onClick={() =>
                  setQuantity(String(Math.max(0.1, (valid ? amount : 0) - 10)))
                }
              >
                <Minus size={20} />
              </button>
              <label>
                <input
                  aria-label="Quantidade do alimento"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  autoComplete="off"
                />
                <span>{selected.unit}</span>
              </label>
              <button
                type="button"
                aria-label="Aumentar 10"
                className="nutrition-icon-button"
                onClick={() => setQuantity(String((valid ? amount : 0) + 10))}
              >
                <Plus size={20} />
              </button>
            </div>
            <p>{shortFoodName(selected.name)}</p>
          </div>
        ) : (
          <>
            <label className="premium-search">
              <Search size={18} />
              <input
                aria-label="Buscar substituição"
                placeholder="Qual alimento você prefere?"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="swap-metric">
              Manter aproximadamente
              <select
                aria-label="Critério da substituição"
                value={metric}
                onChange={(event) => {
                  setMetric(event.target.value as typeof metric);
                  setSelected(entry.food);
                  setQuantity(String(entry.quantity));
                }}
              >
                <option value="kcal">Calorias</option>
                <option value="protein">Proteínas</option>
                <option value="carbs">Carboidratos</option>
                <option value="fat">Gorduras</option>
              </select>
            </label>
            <div className="premium-food-options">
              {alternatives.map(({ food, result }) =>
                result ? (
                  <button
                    type="button"
                    key={food.id}
                    className={selected.id === food.id ? "selected" : ""}
                    onClick={() => {
                      setSelected(food);
                      setQuantity(String(Number(result.quantity.toFixed(3))));
                    }}
                  >
                    <span>
                      <strong>{shortFoodName(food.name)}</strong>
                      <small>
                        {display(result.quantity, 1)} {food.unit} ·{" "}
                        {display(result.nutrients.kcal, 0)} kcal
                      </small>
                    </span>
                    {selected.id === food.id ? (
                      <Check size={18} />
                    ) : (
                      <Plus size={18} />
                    )}
                  </button>
                ) : null,
              )}
              {!alternatives.length ? (
                <p>Nenhuma alternativa deste grupo. Tente outro nome.</p>
              ) : null}
            </div>
            <p className="premium-caption">
              Troca aproximada no mesmo grupo. Não garante fibras, vitaminas,
              saciedade ou macros iguais.
            </p>
          </>
        )}
        <div className="food-sheet-nutrients">
          <div>
            <b>{display(macros?.kcal, 0)}</b>
            <span>kcal</span>
          </div>
          <div>
            <b>{display(macros?.protein)} g</b>
            <span>proteína</span>
          </div>
          <div>
            <b>{display(macros?.carbs)} g</b>
            <span>carbo</span>
          </div>
          <div>
            <b>{display(macros?.fat)} g</b>
            <span>gordura</span>
          </div>
        </div>
        <p
          className={`food-projection ${limitKcal !== null && projected > limitKcal ? "over" : ""}`}
        >
          Dia após salvar: <strong>{display(projected, 0)} kcal</strong>
          {limitKcal !== null && projected > limitKcal
            ? " · acima da meta informada"
            : ""}
          . Sem compensação automática.
        </p>
        <details className="premium-source">
          <summary>Fonte e preparo</summary>
          <p>
            {CONFIDENCE[selected.confidence]} · {selected.source}
          </p>
          <p>{selected.preparation}</p>
          <p>
            Fibras: {display(selected.per100.fiber)} g por 100 {selected.unit}.
            Se desconhecidas, não são zero.
          </p>
        </details>
        {error ? (
          <p className="nutrition-warning" role="alert">
            {error}
          </p>
        ) : null}
        <details className="premium-source">
          <summary>Mais opções</summary>
          <p>
            Remover afeta somente este registro; a cópia anterior fica nos
            Ajustes.
          </p>
          <button
            type="button"
            className="premium-danger-button"
            onClick={() => void perform(onRemove)}
          >
            Remover este item
          </button>
        </details>
      </fieldset>
    </NutritionSheet>
  );
}
