import { useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Leaf,
  Minus,
  Plus,
  Settings2,
  Utensils,
} from "lucide-react";
import type { Food, MealEntry, NutritionState } from "./types";
import { type Update, dateLabel, display } from "./uiHelpers";
import {
  ensureNutritionDay,
  localDate,
  MEALS,
  offsetDate,
  saveMealEntry,
  totalNutrients,
} from "./engine";
import {
  dailyMealRows,
  setMealConsumption,
  setPlannedConsumption,
  updateWater,
  weekDates,
} from "./dailyView";
import { applyStarterDiet, STARTER_DIET_MEALS } from "./starterDiet";
import { NutritionMealCard } from "./NutritionMealCard";
import { NutritionFoodSheet } from "./NutritionFoodSheet";
import { MealSwapSheet } from "./MealSwapSheet";
import { NutritionSheet } from "./NutritionSheet";
import { EntryEditor } from "./EntryEditor";
import {
  ActionDialog,
  type ActionConfirmation,
} from "../components/ActionDialog";

type Modal =
  | { type: "food"; entry: MealEntry }
  | { type: "meal"; meal: string }
  | { type: "add"; meal: string }
  | null;
export function NutritionDayView({
  state,
  catalog,
  date,
  onDateChange,
  mode = "diary",
  change,
  onOpenBuilder,
  onOpenTools,
  onOpenGoals,
}: {
  state: NutritionState;
  catalog: Food[];
  date: string;
  onDateChange: (date: string) => void;
  mode?: "diary" | "plan";
  change: Update;
  onOpenBuilder: () => void;
  onOpenTools: () => void;
  onOpenGoals: () => void;
}) {
  const [modal, setModal] = useState<Modal>(null);
  const [confirmation, setConfirmation] = useState<ActionConfirmation | null>(
    null,
  );
  const [weekOpen, setWeekOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const today = localDate();
  const future = date > today;
  const day = state.days.find((item) => item.date === date);
  const goals = day?.goals ?? state.goals;
  const actual = state.entries.filter(
    (entry) => entry.date === date && entry.kind === "consumed",
  );
  const planned = state.entries.filter(
    (entry) => entry.date === date && entry.kind === "planned",
  );
  const totals = totalNutrients(mode === "plan" ? planned : actual);
  const target = goals.kcal;
  const remaining = target === null ? null : target - totals.kcal;
  const ratio =
    target === null ? 0 : Math.max(0, Math.min(1, totals.kcal / target));
  const meals = [
    ...new Set([
      ...MEALS,
      ...state.entries
        .filter((entry) => entry.date === date)
        .map((entry) => entry.meal),
    ]),
  ].filter((meal) => dailyMealRows(state, date, meal, mode).length);
  const perform = async (operation: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const dayTitle =
    date === today
      ? "Hoje"
      : date === offsetDate(today, -1)
        ? "Ontem"
        : dateLabel(date);
  const markMeal = (meal: string, checked: boolean) => {
    const plans = planned.filter((entry) => entry.meal === meal);
    const extras = actual.filter(
      (entry) =>
        entry.meal === meal &&
        !plans.some((plan) => plan.id === entry.planEntryId),
    );
    const operation = () =>
      change(
        (current) => setMealConsumption(current, date, meal, checked),
        "Antes de marcar ou desmarcar refeição",
      );
    if (checked && extras.length)
      setConfirmation({
        title: "Já há alimentos registrados",
        message: `Esta refeição já tem ${display(totalNutrients(extras).kcal, 0)} kcal fora do plano atual. Registrar o plano acrescenta os itens que ainda não foram marcados. Confira para não contar a mesma comida duas vezes.`,
        confirmLabel: "Registrar os itens restantes do plano",
        onConfirm: operation,
      });
    else void perform(operation);
  };
  return (
    <div className="daily-nutrition">
      <div className="premium-date-heading">
        <button
          type="button"
          className="nutrition-icon-button"
          aria-label="Dia anterior da alimentação"
          onClick={() => onDateChange(offsetDate(date, -1))}
        >
          <ChevronLeft size={19} />
        </button>
        <label className="premium-date-picker">
          <CalendarDays size={15} />
          <span>{dayTitle}</span>
          <input
            type="date"
            aria-label="Escolher dia da alimentação"
            value={date}
            onChange={(event) => {
              if (event.target.value) onDateChange(event.target.value);
            }}
          />
        </label>
        <button
          type="button"
          className="nutrition-icon-button"
          aria-label="Dia seguinte da alimentação"
          onClick={() => onDateChange(offsetDate(date, 1))}
        >
          <ChevronRight size={19} />
        </button>
        <button
          className="nutrition-icon-button"
          type="button"
          aria-label="Mostrar semana da alimentação"
          aria-expanded={weekOpen}
          onClick={() => setWeekOpen(!weekOpen)}
        >
          <CalendarDays size={17} />
        </button>
      </div>
      {weekOpen ? (
        <div className="nutrition-week" aria-label="Semana da alimentação">
          {weekDates(date).map((value) => (
            <button
              type="button"
              key={value}
              aria-label={`Ver alimentação de ${dateLabel(value)}`}
              aria-current={date === value ? "date" : undefined}
              className={`${date === value ? "selected" : ""} ${value === today ? "today" : ""}`}
              onClick={() => onDateChange(value)}
            >
              <span>
                {new Date(`${value}T12:00:00`)
                  .toLocaleDateString("pt-BR", { weekday: "short" })
                  .slice(0, 3)}
              </span>
              <strong>{Number(value.slice(-2))}</strong>
              <i
                className={
                  state.entries.some(
                    (entry) =>
                      entry.date === value && entry.kind === "consumed",
                  )
                    ? "has-record"
                    : ""
                }
              />
            </button>
          ))}
          {date !== today ? (
            <button
              className="premium-today-button week-today"
              type="button"
              onClick={() => onDateChange(today)}
            >
              Voltar para hoje
            </button>
          ) : null}
        </div>
      ) : null}
      <section
        className="premium-day-summary"
        aria-label={
          mode === "plan" ? "Resumo do planejamento" : "Resumo do consumo"
        }
      >
        <div className="premium-summary-top">
          <span>
            {mode === "plan" ? "SEU PLANEJAMENTO" : "SEU DIA, NO SEU RITMO"}
          </span>
          <button
            type="button"
            className="nutrition-icon-button"
            aria-label="Editar metas de alimentação"
            onClick={onOpenGoals}
          >
            <Settings2 size={16} />
          </button>
        </div>
        <div className="premium-summary-body">
          <div
            className="nutrition-ring"
            style={
              { "--nutrition-progress": `${ratio * 360}deg` } as CSSProperties
            }
            role="img"
            aria-label={
              target === null
                ? `${display(totals.kcal, 0)} kcal ${mode === "plan" ? "planejadas" : "consumidas"}, sem meta definida`
                : `${display(totals.kcal, 0)} de ${display(target, 0)} kcal ${mode === "plan" ? "planejadas" : "consumidas"}`
            }
          >
            <div>
              <strong>
                {display(
                  remaining === null ? totals.kcal : Math.abs(remaining),
                  0,
                )}
              </strong>
              <span>
                {remaining === null
                  ? mode === "plan"
                    ? "kcal planejadas"
                    : "kcal registradas"
                  : remaining < 0
                    ? "kcal acima da meta"
                    : "kcal restantes"}
              </span>
            </div>
          </div>
          <div className="nutrition-energy-detail">
            <span>{mode === "plan" ? "Planejado" : "Consumido"}</span>
            <b>
              {display(totals.kcal, 0)} <small>kcal</small>
            </b>
            <span>
              {target === null
                ? "Sem meta definida"
                : `Meta informada: ${display(target, 0)} kcal`}
            </span>
            {!goals.validated && target !== null ? (
              <span className="premium-unvalidated">Meta não validada</span>
            ) : null}
          </div>
        </div>
        <div className="premium-macro-strip">
          {(
            [
              ["protein", "Proteína", "protein"],
              ["carbs", "Carbo", "carbs"],
              ["fat", "Gordura", "fat"],
            ] as const
          ).map(([key, label, tone]) => (
            <div className={tone} key={key}>
              <div>
                <i />
                <span>{label}</span>
              </div>
              <strong>
                {display(totals[key], 0)}{" "}
                <small>
                  g{goals[key] !== null ? ` / ${display(goals[key], 0)} g` : ""}
                </small>
              </strong>
              {goals[key] !== null && goals[key]! > 0 ? (
                <progress
                  aria-label={`${label} ${mode === "plan" ? "planejada" : "consumida"}`}
                  max={goals[key]!}
                  value={Math.min(totals[key], goals[key]!)}
                />
              ) : (
                <div className="macro-unset" />
              )}
            </div>
          ))}
        </div>
        <p className="premium-summary-note">
          {mode === "plan"
            ? "Planejado não é consumido."
            : "Somente o que você marcou entra no consumo."}{" "}
          Valores estimados; treino não desconta calorias.
        </p>
      </section>
      {error ? (
        <p className="nutrition-warning" role="alert">
          {error}
        </p>
      ) : null}
      <div className="premium-section-heading">
        <div>
          <h2>{mode === "plan" ? "Suas refeições" : "O que tem no seu dia"}</h2>
          <p>
            {mode === "plan"
              ? "Toque para ajustar do seu jeito."
              : "Marque o que comeu. Toque para editar."}
          </p>
        </div>
        <button
          type="button"
          className="nutrition-icon-button plus"
          aria-label={
            mode === "plan" ? "Planejar alimento" : "Registrar outro alimento"
          }
          disabled={future && mode === "diary"}
          onClick={() => setModal({ type: "add", meal: "Almoço" })}
        >
          <Plus size={20} />
        </button>
      </div>
      {!planned.length && date >= today ? (
        <section className="premium-plan-invite">
          <span className="plan-invite-icon">
            <Utensils size={23} />
          </span>
          <div>
            <h3>Seu cardápio já está pronto</h3>
            <p>
              Crepioca, sanduíches, leite e opções com queijo. Você escolhe as
              trocas.
            </p>
          </div>
          <button
            type="button"
            className="button button-primary button-wide"
            disabled={busy}
            onClick={() =>
              void perform(() =>
                change(
                  (current) =>
                    applyStarterDiet(
                      current,
                      date,
                      1,
                      STARTER_DIET_MEALS.map(() => 0),
                      false,
                      catalog,
                    ),
                  "Antes de ativar a dieta deste dia",
                ),
              )
            }
          >
            Usar minha dieta neste dia <ArrowRight size={17} />
          </button>
          <button
            type="button"
            className="premium-text-button"
            onClick={onOpenBuilder}
          >
            Escolher opções e montar a semana
          </button>
          <small>
            Aplicar cria somente um plano. Nada é marcado como comido.
          </small>
        </section>
      ) : null}
      <div className="premium-meal-list">
        {meals.map((meal) => {
          const rows = dailyMealRows(state, date, meal, mode);
          const allPlanned = planned.filter((entry) => entry.meal === meal);
          const eaten = actual.filter((entry) => entry.meal === meal);
          return (
            <NutritionMealCard
              key={`${date}-${meal}-${mode}`}
              meal={meal}
              rows={rows}
              mode={mode}
              busy={busy}
              future={future}
              plannedKcal={totalNutrients(allPlanned).kcal}
              consumedKcal={totalNutrients(eaten).kcal}
              onEdit={(row) => setModal({ type: "food", entry: row.entry })}
              onToggle={(row) =>
                void perform(() =>
                  change(
                    (current) =>
                      setPlannedConsumption(
                        current,
                        row.plannedId!,
                        !row.checked,
                      ),
                    "Antes de marcar ou desmarcar alimento",
                  ),
                )
              }
              onToggleMeal={(checked) => markMeal(meal, checked)}
              onSwap={
                date >= today &&
                STARTER_DIET_MEALS.some((item) => item.meal === meal)
                  ? () => setModal({ type: "meal", meal })
                  : undefined
              }
              onAdd={() => setModal({ type: "add", meal })}
            />
          );
        })}
      </div>
      {!meals.length && date < today ? (
        <div className="premium-empty-history">
          <Leaf size={28} />
          <h3>Nenhuma refeição registrada</h3>
          <p>Sem dados neste dia. Isso não significa consumo zero.</p>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setModal({ type: "add", meal: "Almoço" })}
          >
            Registrar uma refeição
          </button>
        </div>
      ) : null}
      {planned.length ? (
        <button
          type="button"
          className="premium-builder-link"
          onClick={onOpenBuilder}
        >
          <Utensils size={18} />
          <span>
            Cardápio e opções da semana
            <small>Leite, requeijão, crepioca e mais trocas</small>
          </span>
          <ChevronRight size={18} />
        </button>
      ) : null}
      {mode === "diary" ? (
        <>
          <section className="premium-water-card">
            <span className="water-symbol">
              <Droplets size={23} />
            </span>
            <div>
              <h3>Água</h3>
              <strong>
                {display((day?.waterMl ?? 0) / 1000, 2)} <small>L</small>
              </strong>
              <p>
                {goals.waterMl === null
                  ? "Sem meta informada"
                  : `Meta: ${display(goals.waterMl / 1000, 2)} L`}
              </p>
            </div>
            <div className="water-quick-actions">
              <button
                type="button"
                disabled={busy || future}
                onClick={() =>
                  void perform(() =>
                    change((current) => updateWater(current, date, 250)),
                  )
                }
              >
                +250 ml
              </button>
              <button
                type="button"
                aria-label="Retirar 250 ml de água"
                disabled={busy || future || (day?.waterMl ?? 0) < 250}
                onClick={() =>
                  void perform(() =>
                    change((current) => updateWater(current, date, -250)),
                  )
                }
              >
                <Minus size={15} />
              </button>
            </div>
          </section>
          <button
            type="button"
            role="checkbox"
            aria-checked={day?.complete ?? false}
            className={`premium-close-diary ${day?.complete ? "checked" : ""}`}
            disabled={busy || future}
            onClick={() =>
              void perform(() =>
                change((current) => {
                  const next = ensureNutritionDay(current, date);
                  return {
                    ...next,
                    days: next.days.map((item) =>
                      item.date === date
                        ? { ...item, complete: !item.complete }
                        : item,
                    ),
                  };
                }),
              )
            }
          >
            <span className="food-check">
              {day?.complete ? <Check size={16} /> : null}
            </span>
            <span>
              <strong>Registrei tudo neste dia</strong>
              <small>Marque só quando o diário estiver completo.</small>
            </span>
          </button>
        </>
      ) : null}
      <button
        type="button"
        className="premium-text-button"
        onClick={onOpenTools}
      >
        Água, sono e ferramentas detalhadas <ChevronRight size={14} />
      </button>
      {modal?.type === "food" ? (
        <NutritionFoodSheet
          key={modal.entry.id}
          entry={modal.entry}
          catalog={catalog}
          totalKcal={
            totalNutrients(
              state.entries.filter(
                (entry) =>
                  entry.date === date && entry.kind === modal.entry.kind,
              ),
            ).kcal
          }
          limitKcal={goals.kcal}
          onClose={() => setModal(null)}
          onSave={(entry) =>
            change(
              (current) => saveMealEntry(current, entry),
              "Antes de editar alimento",
            )
          }
          onRemove={() =>
            change(
              (current) => ({
                ...current,
                entries: current.entries.filter(
                  (entry) => entry.id !== modal.entry.id,
                ),
              }),
              "Antes de remover alimento",
            )
          }
        />
      ) : null}
      {modal?.type === "meal" ? (
        <MealSwapSheet
          state={state}
          date={date}
          meal={modal.meal}
          catalog={catalog}
          change={change}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal?.type === "add" ? (
        <NutritionSheet
          title={mode === "plan" ? "Planejar alimento" : "Adicionar ao diário"}
          subtitle={dateLabel(date)}
          onClose={() => setModal(null)}
        >
          <EntryEditor
            editorId="quick-food-editor"
            defaultMeal={modal.meal}
            catalog={catalog}
            favorites={state.favorites}
            editing={null}
            date={date}
            kind={mode === "plan" ? "planned" : "consumed"}
            order={state.entries.length}
            onSave={async (entry) => {
              await change((current) => saveMealEntry(current, entry));
              setModal(null);
            }}
            onCancel={() => setModal(null)}
          />
        </NutritionSheet>
      ) : null}
      {confirmation
        ? createPortal(
            <ActionDialog
              action={confirmation}
              onClose={() => setConfirmation(null)}
            />,
            document.body,
          )
        : null}
    </div>
  );
}
