import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Apple,
  Check,
  ChevronLeft,
  ChevronRight,
  Utensils,
} from "lucide-react";
import type { WorkoutHistory } from "../types";
import {
  ActionDialog,
  type ActionConfirmation,
} from "../components/ActionDialog";
import { ELITE_FOODS } from "./catalog";
import {
  CONFIDENCE,
  MEALS,
  consumePlannedEntry,
  consumePlannedMeal,
  copyNutritionEntries,
  ensureNutritionDay,
  localDate,
  nutritionId,
  nutrientsFor,
  offsetDate,
  parseEliteCatalog,
  saveMealEntry,
  shoppingList,
  totalNutrients,
} from "./engine";
import { validateProfile } from "./validation";
import type { MealEntry, NutritionState } from "./types";
import {
  numberValue,
  stringValue,
  display,
  dateLabel,
  type Update,
} from "./uiHelpers";
import { Field, SaveButton } from "./FormControls";
import { EntryEditor } from "./EntryEditor";
import { SubstitutionEditor } from "./SubstitutionEditor";
import { CatalogEditor } from "./CatalogEditor";
import { GoalsEditor } from "./GoalsEditor";
import { BodyPanel } from "./BodyPanel";
import { PreopPanel } from "./PreopPanel";
import { ReportPanel } from "./ReportPanel";
import { StarterDietPanel } from "./StarterDietPanel";
import { NutritionDayView } from "./NutritionDayView";
import { NutritionSheet } from "./NutritionSheet";
import "./nutrition.css";
import "./daily-premium.css";

type NutritionTab =
  | "diary"
  | "plan"
  | "foods"
  | "body"
  | "preop"
  | "reports"
  | "goals";
type NutritionScreenTab = NutritionTab | "tools";

export function NutritionScreen({
  state,
  update,
  history,
  initialTab = "diary",
}: {
  state: NutritionState;
  update: Update;
  history: WorkoutHistory[];
  initialTab?: NutritionTab;
}) {
  const [tab, setTab] = useState<NutritionScreenTab>(initialTab);
  const [moreOpen, setMoreOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [date, setDate] = useState(localDate);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [confirmation, setConfirmation] = useState<ActionConfirmation | null>(
    null,
  );
  const run = async (
    operation: () => Promise<void>,
    success = "Salvo neste aparelho.",
  ) => {
    if (lock.current) throw new Error("Aguarde a gravação terminar.");
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await operation();
      setMessage(success);
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      );
      throw cause;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const change: Update = (operation, checkpoint) =>
    run(() => update(operation, checkpoint), "");
  const submit = (
    event: FormEvent<HTMLFormElement>,
    operation: (data: FormData) => Promise<void>,
  ) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void operation(data).catch((cause: unknown) =>
      setMessage(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      ),
    );
  };
  const catalog = useMemo(
    () => [
      ...ELITE_FOODS.filter(
        (food) => !state.foods.some((custom) => custom.id === food.id),
      ),
      ...state.foods,
    ],
    [state.foods],
  );
  const day = state.days.find((item) => item.date === date);
  const goals = day?.goals ?? state.goals;
  const entries = state.entries
    .filter(
      (entry) =>
        entry.date === date &&
        entry.kind === (tab === "plan" ? "planned" : "consumed"),
    )
    .sort((a, b) => a.order - b.order);
  const total = totalNutrients(entries);
  const [editing, setEditing] = useState<MealEntry | null>(null);
  const [swapping, setSwapping] = useState<MealEntry | null>(null);
  useEffect(() => {
    if (editing)
      document
        .getElementById("meal-editor")
        ?.scrollIntoView({ block: "start" });
  }, [editing]);
  useEffect(() => {
    if (swapping)
      document
        .getElementById("nutrition-swap")
        ?.scrollIntoView({ block: "start" });
  }, [swapping]);
  const fileInput = useRef<HTMLInputElement>(null);
  const profileInput = useRef<HTMLInputElement>(null);

  return (
    <section
      className="screen nutrition-screen nutrition-premium"
      aria-labelledby="nutrition-title"
    >
      <header className="screen-heading">
        <div>
          <span className="eyebrow">MEUTREINO · NUTRIÇÃO</span>
          <h1 id="nutrition-title">
            Alimentação<span className="nutrition-title-dot">.</span>
          </h1>
          <p>Mais simples. Mais do seu jeito.</p>
        </div>
        <Apple aria-hidden="true" />
      </header>
      <div
        className="nutrition-tabs"
        role="tablist"
        aria-label="Áreas de alimentação"
        onKeyDown={(event) => {
          if (event.ctrlKey || event.metaKey || event.altKey) return;
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          const tabs = [
            ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
              '[role="tab"]',
            ),
          ];
          const current = tabs.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : (current +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    tabs.length) %
                  tabs.length;
          event.preventDefault();
          tabs[next]?.focus();
          tabs[next]?.click();
        }}
      >
        {(
          [
            ["diary", "Meu dia"],
            ["plan", "Minha Dieta"],
          ] as const
        ).map(([id, label]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            type="button"
            className={tab === id ? "selected" : ""}
            key={id}
            onClick={() => {
              setTab(id);
              setMoreOpen(false);
              setEditing(null);
              setSwapping(null);
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={moreOpen || (tab !== "diary" && tab !== "plan")}
          aria-expanded={moreOpen}
          className={
            moreOpen || (tab !== "diary" && tab !== "plan") ? "selected" : ""
          }
          onClick={() => setMoreOpen(!moreOpen)}
        >
          Mais <ChevronRight size={14} />
        </button>
      </div>
      {moreOpen ? (
        <div
          className="premium-more-menu"
          aria-label="Mais áreas da alimentação"
        >
          {(
            [
              ["foods", "Alimentos e favoritos"],
              ["body", "Corpo e medidas"],
              ["reports", "Relatórios"],
              ["goals", "Metas e perfil"],
              ["tools", "Sono e registro detalhado"],
              ["preop", "Pré-operatório"],
            ] as const
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              onClick={() => {
                setTab(id);
                setMoreOpen(false);
                setEditing(null);
                setSwapping(null);
              }}
            >
              {label}
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      ) : null}
      {message ? (
        <p className="nutrition-message" role="status">
          {message}
        </p>
      ) : null}
      <fieldset className="nutrition-fieldset" disabled={busy} aria-busy={busy}>
        {tab === "diary" || tab === "plan" ? (
          <NutritionDayView
            key={tab}
            state={state}
            catalog={catalog}
            date={date}
            onDateChange={setDate}
            mode={tab === "plan" ? "plan" : "diary"}
            change={change}
            onOpenBuilder={() => setBuilderOpen(true)}
            onOpenTools={() => setTab("tools")}
            onOpenGoals={() => setTab("goals")}
          />
        ) : null}
        {tab === "tools" || tab === "plan" ? (
          <details
            className="nutrition-card nutrition-tools-panel"
            open={tab === "tools"}
          >
            <summary>
              {tab === "tools"
                ? "Registro detalhado e recuperação"
                : "Ferramentas avançadas do plano"}
            </summary>
            <div className="nutrition-fieldset">
              <div className="nutrition-date">
                <button
                  type="button"
                  aria-label="Dia anterior"
                  onClick={() => {
                    setDate(offsetDate(date, -1));
                    setEditing(null);
                  }}
                >
                  <ChevronLeft />
                </button>
                <label>
                  Dia do registro
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => {
                      if (event.target.value) {
                        setDate(event.target.value);
                        setEditing(null);
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  aria-label="Dia seguinte"
                  onClick={() => {
                    setDate(offsetDate(date, 1));
                    setEditing(null);
                  }}
                >
                  <ChevronRight />
                </button>
              </div>
              <article className="nutrition-card">
                <div className="nutrition-heading">
                  <div>
                    <span className="eyebrow">
                      {tab === "plan"
                        ? "PLANEJADO · NÃO CONSUMIDO"
                        : day?.complete
                          ? "DIÁRIO COMPLETO POR DECLARAÇÃO"
                          : "CONSUMO REGISTRADO · PARCIAL"}
                    </span>
                    <h2>{tab === "plan" ? "Minha Dieta" : "Hoje no prato"}</h2>
                  </div>
                  <Utensils />
                </div>
                <div className="nutrition-energy">
                  <strong>
                    {display(total.kcal, 0)}
                    <small> kcal</small>
                  </strong>
                  <span>
                    {goals.kcal === null
                      ? "Sem meta definida"
                      : `${Math.abs(Math.round(goals.kcal - total.kcal))} kcal ${total.kcal > goals.kcal ? "acima da meta informada" : "até a meta informada"}`}
                  </span>
                </div>
                <div className="nutrition-macros">
                  {(
                    [
                      ["protein", "Proteínas"],
                      ["carbs", "Carboidratos"],
                      ["fat", "Gorduras"],
                      ["fiber", "Fibras"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <span>{label}</span>
                      <strong>
                        {display(total[key])} <small>g</small>
                      </strong>
                      <small>Meta: {display(goals[key])} g</small>
                      {goals[key] !== null && goals[key]! > 0 ? (
                        <progress
                          aria-label={label}
                          max={goals[key] || 1}
                          value={Math.min(total[key] ?? 0, goals[key] || 1)}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
                <p className="elite-caption">
                  {total.missingFiber
                    ? `Fibras incompletas: ${total.missingFiber} itens sem informação; total não estimado.`
                    : "Valores calculados a partir das fontes dos alimentos."}{" "}
                  Igualar calorias não iguala a qualidade nutricional. Nenhum
                  gasto de treino é descontado.
                </p>
                {!goals.validated && goals.kcal !== null ? (
                  <p className="nutrition-warning">
                    Meta informada por você, sem validação profissional
                    registrada. Não é uma prescrição do aplicativo.
                  </p>
                ) : null}
                {tab === "plan" &&
                goals.kcal !== null &&
                total.kcal > goals.kcal ? (
                  <p className="nutrition-warning" role="alert">
                    O plano ultrapassa a meta informada em{" "}
                    {display(total.kcal - goals.kcal)} kcal. Revise as
                    quantidades e substituições; não há ajuste automático.
                  </p>
                ) : null}
              </article>
              <EntryEditor
                key={editing?.id ?? `${tab}-${date}-${entries.length}`}
                catalog={catalog}
                favorites={state.favorites}
                editing={editing}
                date={date}
                kind={tab === "plan" ? "planned" : "consumed"}
                order={state.entries.length}
                onSave={async (entry) => {
                  await change((current) => saveMealEntry(current, entry));
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
              {[
                ...new Set([...MEALS, ...entries.map((entry) => entry.meal)]),
              ].map((meal) => {
                const mealEntries = entries.filter(
                  (entry) => entry.meal === meal,
                );
                if (!mealEntries.length) return null;
                return (
                  <article className="nutrition-card" key={meal}>
                    <h3>
                      {meal}{" "}
                      <small>
                        · {display(totalNutrients(mealEntries).kcal, 0)} kcal
                      </small>
                    </h3>
                    {tab === "plan" ? (
                      <button
                        className="button button-secondary"
                        type="button"
                        disabled={
                          date > localDate() ||
                          mealEntries.every((entry) =>
                            state.entries.some(
                              (consumed) => consumed.planEntryId === entry.id,
                            ),
                          )
                        }
                        onClick={() =>
                          void change((current) =>
                            consumePlannedMeal(current, date, meal),
                          ).catch(() => undefined)
                        }
                      >
                        Registrar refeição consumida
                      </button>
                    ) : null}
                    {[false, true].map((preparation) => {
                      const items = mealEntries.filter(
                        (entry) =>
                          Boolean(entry.preparationOnly) === preparation,
                      );
                      if (!items.length) return null;
                      const content = items.map((entry) => {
                        const index = mealEntries.indexOf(entry);
                        return (
                          <div className="nutrition-entry" key={entry.id}>
                            <strong>{entry.food.name}</strong>
                            <span>
                              {display(entry.quantity, 2)} {entry.food.unit}
                              {entry.time ? ` · ${entry.time}` : ""} ·{" "}
                              {display(
                                nutrientsFor(entry.food, entry.quantity).kcal,
                                0,
                              )}{" "}
                              kcal
                            </span>
                            <small>
                              {CONFIDENCE[entry.food.confidence]} ·{" "}
                              {entry.food.preparation}
                            </small>
                            <div className="nutrition-entry-actions">
                              <button
                                type="button"
                                onClick={() => setEditing(entry)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => setSwapping(entry)}
                              >
                                Substituir
                              </button>
                              <button
                                type="button"
                                aria-label={`Mover ${entry.food.name} para cima`}
                                disabled={index === 0}
                                onClick={() =>
                                  void change((current) => {
                                    const previous = mealEntries[index - 1];
                                    return {
                                      ...current,
                                      entries: current.entries.map((item) =>
                                        item.id === entry.id
                                          ? { ...item, order: previous.order }
                                          : item.id === previous.id
                                            ? { ...item, order: entry.order }
                                            : item,
                                      ),
                                    };
                                  }).catch(() => undefined)
                                }
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void change((current) =>
                                    saveMealEntry(current, {
                                      ...entry,
                                      id: nutritionId(),
                                      planEntryId: undefined,
                                      order: current.entries.length,
                                    }),
                                  ).catch(() => undefined)
                                }
                              >
                                Duplicar
                              </button>
                              {entry.kind === "planned" ? (
                                <button
                                  type="button"
                                  disabled={state.entries.some(
                                    (item) => item.planEntryId === entry.id,
                                  )}
                                  onClick={() =>
                                    void change((current) =>
                                      consumePlannedEntry(current, entry.id),
                                    ).catch(() => undefined)
                                  }
                                >
                                  <Check size={14} />
                                  {state.entries.some(
                                    (item) => item.planEntryId === entry.id,
                                  )
                                    ? "Consumido"
                                    : "Registrar consumo"}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="danger"
                                onClick={() =>
                                  setConfirmation({
                                    title: "Remover este item?",
                                    message:
                                      "A cópia anterior local fica disponível nos Ajustes. Outros registros não serão alterados.",
                                    confirmLabel: "Remover item",
                                    onConfirm: () =>
                                      change((current) => ({
                                        ...current,
                                        entries: current.entries.filter(
                                          (item) => item.id !== entry.id,
                                        ),
                                      })),
                                  })
                                }
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        );
                      });
                      return preparation ? (
                        <details
                          className="nutrition-preparation"
                          key="preparation"
                        >
                          <summary>
                            Preparo incluído ·{" "}
                            {display(totalNutrients(items).kcal)} kcal
                          </summary>
                          <p className="elite-caption">
                            Referência estimada de temperos e óleo, não
                            acompanhamentos separados. Ajuste ao preparo real.
                            Estes valores continuam incluídos no total.
                            Registrar a refeição inteira inclui também o
                            preparo; registrar só um alimento não inclui os
                            demais itens.
                          </p>
                          {content}
                        </details>
                      ) : (
                        <div key="main-foods">{content}</div>
                      );
                    })}
                  </article>
                );
              })}
              {!entries.length ? (
                <div className="nutrition-empty">
                  <Utensils />
                  <strong>
                    {tab === "plan"
                      ? "Monte o plano deste dia"
                      : "Seu diário começa com uma refeição"}
                  </strong>
                  <p>
                    Busque um alimento, confira a fonte e registre a quantidade.
                    Sem preenchimento fictício.
                  </p>
                  {tab === "tools" ? (
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => setTab("plan")}
                    >
                      Ver minha dieta pronta
                    </button>
                  ) : null}
                </div>
              ) : null}
              {swapping ? (
                <SubstitutionEditor
                  entry={swapping}
                  catalog={catalog}
                  dayTotalKcal={total.kcal}
                  limitKcal={goals.kcal}
                  onCancel={() => setSwapping(null)}
                  onSave={async (food, quantity) => {
                    await change((current) =>
                      saveMealEntry(current, { ...swapping, food, quantity }),
                    );
                    setSwapping(null);
                  }}
                />
              ) : null}
              <article className="nutrition-card">
                <h3>Copiar sem substituir registros</h3>
                <form
                  onSubmit={(event) =>
                    submit(event, async (data) => {
                      await change((current) =>
                        copyNutritionEntries(
                          current,
                          date,
                          stringValue(data, "target"),
                          tab === "plan" ? "planned" : "consumed",
                        ),
                      );
                    })
                  }
                >
                  <Field
                    label="Copiar para o dia"
                    name="target"
                    type="date"
                    required
                  />
                  <SaveButton label="Copiar itens deste dia" />
                </form>
                {tab === "plan" ? (
                  <>
                    <form
                      onSubmit={(event) =>
                        submit(event, async (data) => {
                          if (!entries.length)
                            throw new Error(
                              "Adicione alimentos ao plano primeiro.",
                            );
                          await change((current) => ({
                            ...current,
                            templates: [
                              ...current.templates,
                              {
                                id: nutritionId(),
                                name: stringValue(data, "name"),
                                entries: entries.map(
                                  ({
                                    food,
                                    quantity,
                                    meal,
                                    time,
                                    order,
                                    kind,
                                    preparationOnly,
                                  }) => ({
                                    food,
                                    quantity,
                                    meal,
                                    time,
                                    order,
                                    kind,
                                    ...(preparationOnly !== undefined
                                      ? { preparationOnly }
                                      : {}),
                                  }),
                                ),
                              },
                            ],
                          }));
                        })
                      }
                    >
                      <Field
                        label="Nome do modelo favorito"
                        name="name"
                        type="text"
                        required
                        maxLength={120}
                      />
                      <SaveButton label="Salvar plano como modelo" />
                    </form>
                    {state.templates.map((template) => (
                      <div className="nutrition-template" key={template.id}>
                        <strong>{template.name}</strong>
                        <button
                          type="button"
                          onClick={() =>
                            void change((current) => {
                              let next = current;
                              for (const entry of template.entries)
                                next = saveMealEntry(next, {
                                  ...entry,
                                  kind: "planned",
                                  id: nutritionId(),
                                  date,
                                  order: next.entries.length,
                                });
                              return next;
                            }).catch(() => undefined)
                          }
                        >
                          Adicionar modelo ao dia
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmation({
                              title: "Remover modelo?",
                              message:
                                "Os registros já criados com ele permanecem.",
                              confirmLabel: "Remover modelo",
                              onConfirm: () =>
                                change((current) => ({
                                  ...current,
                                  templates: current.templates.filter(
                                    (item) => item.id !== template.id,
                                  ),
                                })),
                            })
                          }
                        >
                          Remover modelo
                        </button>
                      </div>
                    ))}
                    <h3>
                      Compras · {dateLabel(date)} a{" "}
                      {dateLabel(offsetDate(date, 6))}
                    </h3>
                    <p className="elite-caption">
                      Quantidades no estado de preparo cadastrado, não uma
                      conversão automática para peso cru ou de compra.
                    </p>
                    {shoppingList(state.entries, date, offsetDate(date, 6)).map(
                      (item, index) => (
                        <p key={index}>
                          {item.name}:{" "}
                          <strong>
                            {display(item.quantity, 1)} {item.unit}
                          </strong>
                        </p>
                      ),
                    )}
                  </>
                ) : null}
              </article>
              {tab === "tools" ? (
                <article className="nutrition-card">
                  <h2>Água, sono e recuperação</h2>
                  <form
                    key={date}
                    onSubmit={(event) =>
                      submit(event, async (data) => {
                        if (date > localDate())
                          throw new Error(
                            "Registre recuperação em um dia atual ou passado.",
                          );
                        await change((current) => {
                          const next = ensureNutritionDay(current, date);
                          return {
                            ...next,
                            days: next.days.map((item) =>
                              item.date !== date
                                ? item
                                : {
                                    ...item,
                                    waterMl: numberValue(data, "waterMl") ?? 0,
                                    sleepHours: numberValue(data, "sleepHours"),
                                    hunger: numberValue(data, "hunger"),
                                    energy: numberValue(data, "energy"),
                                    fatigue: numberValue(data, "fatigue"),
                                    recovery: numberValue(data, "recovery"),
                                    notes: stringValue(data, "notes"),
                                    complete: data.get("complete") === "on",
                                  },
                            ),
                          };
                        });
                      })
                    }
                  >
                    <div className="nutrition-form-grid">
                      <Field
                        label="Água (ml)"
                        name="waterMl"
                        value={day?.waterMl ?? 0}
                        min={0}
                        max={30000}
                      />
                      <Field
                        label="Sono (horas)"
                        name="sleepHours"
                        value={day?.sleepHours}
                        min={0}
                        max={24}
                      />
                      {(
                        [
                          ["hunger", "Fome"],
                          ["energy", "Energia"],
                          ["fatigue", "Fadiga"],
                          ["recovery", "Recuperação"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key}>
                          {label}
                          <select name={key} defaultValue={day?.[key] ?? ""}>
                            <option value="">Não informado</option>
                            {[1, 2, 3, 4, 5].map((number) => (
                              <option key={number}>{number}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <p className="elite-caption">
                      Escala pessoal de 1 (muito baixa) a 5 (muito alta). Não é
                      diagnóstico.
                    </p>
                    <Field
                      label="Observações e sintomas para compartilhar com seu profissional"
                      name="notes"
                      value={day?.notes}
                      type="textarea"
                    />
                    <label className="nutrition-checkbox">
                      <input
                        type="checkbox"
                        name="complete"
                        defaultChecked={day?.complete ?? false}
                      />
                      Registrei toda a alimentação deste dia
                    </label>
                    <SaveButton label="Salvar recuperação e fechamento do diário" />
                  </form>
                </article>
              ) : null}
            </div>
          </details>
        ) : null}
        {tab === "foods" ? (
          <>
            <CatalogEditor
              catalog={catalog}
              state={state}
              change={change}
              confirm={setConfirmation}
            />
            <article className="nutrition-card">
              <h3>Importar sua Tabela Elite</h3>
              <p>
                O catálogo incluído tem 345 referências aproximadas. Nenhuma é
                rotulada como TBCA/USDA verificada. Um TXT compatível pode
                acrescentar ou atualizar o catálogo local; seus históricos
                guardam os valores usados no registro.
              </p>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => fileInput.current?.click()}
              >
                Selecionar TXT do catálogo
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".txt,text/plain"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void run(async () => {
                    if (file.size > 2 * 1024 * 1024)
                      throw new Error("Use um TXT de até 2 MB.");
                    const imported = parseEliteCatalog(await file.text());
                    await update((current) => ({
                      ...current,
                      foods: [
                        ...current.foods.filter(
                          (food) =>
                            !imported.some((item) => item.id === food.id),
                        ),
                        ...imported,
                      ],
                    }));
                  }, "Catálogo aproximado importado; históricos preservados.").catch(
                    () => undefined,
                  );
                  event.currentTarget.value = "";
                }}
              />
            </article>
          </>
        ) : null}
        {tab === "goals" ? (
          <>
            <GoalsEditor state={state} date={date} change={change} />
            <article className="nutrition-card">
              <h3>Configuração pessoal por arquivo</h3>
              <p>
                Importe somente seu perfil local. Isso não altera treinos,
                histórico, alimentação ou metas. O arquivo não é enviado a
                servidores.
              </p>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => profileInput.current?.click()}
              >
                Importar perfil pessoal JSON
              </button>
              <input
                ref={profileInput}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void run(async () => {
                    if (file.size > 50000)
                      throw new Error("Perfil deve ter até 50 KB.");
                    const parsed: unknown = JSON.parse(await file.text());
                    validateProfile(parsed);
                    await update((current) => ({
                      ...current,
                      profile: parsed as NutritionState["profile"],
                    }));
                  }).catch(() => undefined);
                  event.currentTarget.value = "";
                }}
              />
            </article>
          </>
        ) : null}
        {tab === "body" ? <BodyPanel state={state} change={change} /> : null}
        {tab === "preop" ? (
          <PreopPanel state={state} change={change} confirm={setConfirmation} />
        ) : null}
        {tab === "reports" ? (
          <ReportPanel state={state} history={history} />
        ) : null}
      </fieldset>
      {builderOpen ? (
        <NutritionSheet
          title="Seu cardápio, suas escolhas"
          subtitle="Opções prontas e planejamento da semana"
          busy={busy}
          onClose={() => setBuilderOpen(false)}
        >
          <fieldset className="nutrition-fieldset" disabled={busy}>
            <StarterDietPanel
              state={state}
              date={date}
              catalog={catalog}
              change={change}
            />
          </fieldset>
        </NutritionSheet>
      ) : null}
      {confirmation ? (
        <ActionDialog
          action={confirmation}
          onClose={() => setConfirmation(null)}
        />
      ) : null}
    </section>
  );
}
