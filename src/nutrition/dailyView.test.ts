import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ELITE_FOODS } from "./catalog";
import {
  emptyNutrition,
  localDate,
  offsetDate,
  totalNutrients,
} from "./engine";
import { applyStarterDiet, STARTER_DIET_MEALS } from "./starterDiet";
import {
  dailyMealRows,
  replacePresetMeal,
  setMealConsumption,
  setPlannedConsumption,
  shortFoodName,
  updateWater,
  weekDates,
} from "./dailyView";
import { validateNutrition } from "./validation";
import { NutritionScreen } from "./NutritionScreen";
import { NutritionDayView } from "./NutritionDayView";
import { NutritionFoodSheet } from "./NutritionFoodSheet";
import { NutritionMealCard } from "./NutritionMealCard";
import { NutritionSheet } from "./NutritionSheet";
const today = localDate();
const seed = () =>
  applyStarterDiet(
    emptyNutrition(),
    today,
    1,
    STARTER_DIET_MEALS.map(() => 0),
    false,
  );
describe("diário premium e registro sem duplicação", () => {
  it("une planejado e consumido numa única linha sem contar planejado como ingestão", () => {
    const state = seed();
    const row = state.entries[0];
    expect(
      dailyMealRows(state, today, row.meal).every((item) => !item.checked),
    ).toBe(true);
    const next = setPlannedConsumption(state, row.id, true);
    const rows = dailyMealRows(next, today, row.meal);
    expect(rows).toHaveLength(
      state.entries.filter((entry) => entry.meal === row.meal).length,
    );
    expect(rows[0].checked).toBe(true);
    expect(rows[0].entry.kind).toBe("consumed");
    expect(rows[0].plannedId).toBe(row.id);
    expect(
      next.entries.filter((entry) => entry.kind === "consumed"),
    ).toHaveLength(1);
    expect(validateNutrition(next)).toEqual(next);
  });
  it("marcar é idempotente e desmarcar remove só o consumo ligado ao item", () => {
    const state = seed();
    const row = state.entries[0];
    const next = setPlannedConsumption(state, row.id, true);
    expect(setPlannedConsumption(next, row.id, true)).toBe(next);
    const undone = setPlannedConsumption(next, row.id, false);
    expect(undone.entries).toEqual(state.entries);
    expect(state.entries.every((entry) => entry.kind === "planned")).toBe(true);
  });
  it("marcar e desmarcar refeição inclui preparo, mas preserva registros avulsos", () => {
    const state = seed();
    state.entries.push({
      ...state.entries[0],
      id: "manual",
      kind: "consumed",
      planEntryId: undefined,
    });
    const next = setMealConsumption(state, today, "Almoço", true);
    const actual = next.entries.filter(
      (entry) => entry.kind === "consumed" && entry.meal === "Almoço",
    );
    expect(actual.filter((entry) => entry.preparationOnly)).toHaveLength(4);
    expect(totalNutrients(actual)).toEqual(
      totalNutrients(
        state.entries.filter(
          (entry) => entry.meal === "Almoço" && entry.kind === "planned",
        ),
      ),
    );
    const undone = setMealConsumption(next, today, "Almoço", false);
    expect(undone.entries.find((entry) => entry.id === "manual")).toEqual(
      state.entries.find((entry) => entry.id === "manual"),
    );
    expect(
      undone.entries.filter((entry) => entry.kind === "consumed"),
    ).toHaveLength(1);
  });
  it("mostra o snapshot consumido editado e preserva registros de planos antigos", () => {
    const state = seed();
    const next = setPlannedConsumption(state, state.entries[0].id, true);
    const record = next.entries.find((entry) => entry.kind === "consumed")!;
    record.quantity = 12;
    next.entries.push({
      ...record,
      id: "old-plan",
      planEntryId: "removed-plan",
      food: { ...record.food, name: "Registro antigo" },
    });
    const rows = dailyMealRows(next, today, record.meal);
    expect(rows[0].entry.quantity).toBe(12);
    expect(rows.find((item) => item.entry.id === "old-plan")?.checked).toBe(
      true,
    );
    expect(
      dailyMealRows(next, today, record.meal, "plan")[0].entry.quantity,
    ).toBe(state.entries[0].quantity);
  });
  it("não permite registrar consumo no futuro nem usar item inexistente", () => {
    const state = applyStarterDiet(
      emptyNutrition(),
      offsetDate(today, 1),
      1,
      [0, 0, 0, 0],
      false,
    );
    const original = structuredClone(state);
    expect(() =>
      setPlannedConsumption(state, state.entries[0].id, true),
    ).toThrow();
    expect(() =>
      setMealConsumption(state, offsetDate(today, 1), "Almoço", true),
    ).toThrow();
    expect(() => setPlannedConsumption(state, "missing", true)).toThrow();
    expect(state).toEqual(original);
  });
  it("troca só uma refeição planejada e mantém consumido, dias e demais refeições", () => {
    const state = seed();
    const next = setMealConsumption(state, today, "Café da manhã", true);
    const swapped = replacePresetMeal(
      next,
      today,
      "Café da manhã",
      5,
      ELITE_FOODS,
    );
    expect(
      swapped.entries.filter((entry) => entry.kind === "consumed"),
    ).toEqual(next.entries.filter((entry) => entry.kind === "consumed"));
    expect(swapped.entries.filter((entry) => entry.meal === "Almoço")).toEqual(
      next.entries.filter((entry) => entry.meal === "Almoço"),
    );
    expect(
      swapped.entries.some(
        (entry) =>
          entry.kind === "planned" &&
          entry.food.name === "Leite desnatado (ml)",
      ),
    ).toBe(true);
    expect(validateNutrition(swapped)).toEqual(swapped);
    expect(
      totalNutrients(
        swapped.entries.filter((entry) => entry.kind === "planned"),
      ).kcal,
    ).toBeLessThanOrEqual(1700);
  });
  it("trocas inválidas ou acima do teto não alteram o plano", () => {
    const state = seed();
    const original = structuredClone(state);
    expect(() =>
      replacePresetMeal(state, today, "Não existe", 0, ELITE_FOODS),
    ).toThrow();
    expect(() =>
      replacePresetMeal(state, offsetDate(today, -1), "Almoço", 0, ELITE_FOODS),
    ).toThrow();
    expect(() =>
      replacePresetMeal(state, today, "Almoço", 99, ELITE_FOODS),
    ).toThrow();
    const catalog = structuredClone(ELITE_FOODS);
    catalog.find((food) => food.name === "Leite desnatado (ml)")!.per100.kcal =
      9000;
    expect(() =>
      replacePresetMeal(state, today, "Café da manhã", 5, catalog),
    ).toThrow("1.700");
    expect(state).toEqual(original);
  });
  it("água usa gravação aditiva e mantém metas e outros campos", () => {
    const state = seed();
    const next = updateWater(updateWater(state, today, 250), today, 250);
    expect(next.days.find((day) => day.date === today)?.waterMl).toBe(500);
    expect(
      updateWater(next, today, -250).days.find((day) => day.date === today)
        ?.waterMl,
    ).toBe(250);
    expect(next.goals).toEqual(state.goals);
    expect(() => updateWater(next, today, -1000)).toThrow();
    expect(() => updateWater(next, today, 30000)).toThrow();
    expect(() => updateWater(next, offsetDate(today, 1), 250)).toThrow();
    expect(() => updateWater(next, today, NaN)).toThrow();
  });
  it("semana começa na segunda e cruza mês/ano sem UTC deslocar o dia", () => {
    expect(weekDates("2027-01-01")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
    expect(shortFoodName("Peito de frango cozido sem pele")).toBe(
      "Frango cozido",
    );
    expect(shortFoodName("Requeijao light")).toBe("Requeijão light");
  });
  it("tela inicial não contém formulários longos, nem ingestão fictícia", () => {
    const html = renderToStaticMarkup(
      createElement(NutritionScreen, {
        state: seed(),
        update: async () => undefined,
        history: [],
      }),
    );
    expect(html).toContain("Comi esta refeição");
    expect(html).toContain("Meu dia");
    expect(html).not.toContain("Buscar alimento para registrar");
    expect(html).not.toContain("Salvar recuperação e fechamento do diário");
    expect(html).toContain("Somente o que você marcou entra no consumo");
    expect(html).not.toContain('class="premium-meal-foods"');
  });
  it("sem plano oferece ativação explícita, sem criar metas ou registros", () => {
    const state = emptyNutrition();
    const html = renderToStaticMarkup(
      createElement(NutritionDayView, {
        state,
        catalog: ELITE_FOODS,
        date: today,
        onDateChange: () => undefined,
        change: async () => undefined,
        onOpenBuilder: () => undefined,
        onOpenTools: () => undefined,
        onOpenGoals: () => undefined,
      }),
    );
    expect(html).toContain("Usar minha dieta neste dia");
    expect(html).toContain("Sem meta definida");
    expect(html).toContain("Nada é marcado como comido");
    expect(state.entries).toHaveLength(0);
    expect(state.goals.kcal).toBeNull();
  });
  it("edição simples permite campo vazio sem gravar zero e informa a origem", () => {
    const row = seed().entries[0];
    const html = renderToStaticMarkup(
      createElement(NutritionFoodSheet, {
        entry: row,
        catalog: ELITE_FOODS,
        totalKcal: 1666.936,
        limitKcal: 1700,
        onSave: async () => undefined,
        onRemove: async () => undefined,
        onClose: () => undefined,
      }),
    );
    expect(html).toContain('aria-label="Quantidade do alimento"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain("Fonte e preparo");
    expect(html).toContain("Editando o planejado");
    expect(html).toContain('role="dialog"');
  });
  it("card recolhido separa registros antigos e não repete seus nomes no resumo do plano", () => {
    const state = seed();
    state.entries.push({
      ...state.entries[0],
      id: "old",
      kind: "consumed",
      planEntryId: "old-plan",
      food: { ...state.entries[0].food, name: "Registro antigo não repetir" },
    });
    const meal = "Café da manhã";
    const html = renderToStaticMarkup(
      createElement(NutritionMealCard, {
        meal,
        rows: dailyMealRows(state, today, meal),
        plannedKcal: 376,
        consumedKcal: 44,
        mode: "diary",
        busy: false,
        future: false,
        onEdit: () => undefined,
        onToggle: () => undefined,
        onToggleMeal: () => undefined,
        onAdd: () => undefined,
      }),
    );
    expect(html).toContain("item já registrado");
    expect(html).toContain("fora deste plano");
    expect(html).not.toContain("Registro antigo não repetir");
    expect(html).toContain('aria-expanded="false"');
  });
  it("folha de edição tem confirmação fora da área rolável e título acessível", () => {
    const html = renderToStaticMarkup(
      createElement(NutritionSheet, {
        title: "Editar alimento",
        onClose: () => undefined,
        children: "Conteúdo",
        footer: createElement("button", { type: "button" }, "Confirmar"),
      }),
    );
    expect(html).toContain('class="nutrition-sheet-content"');
    expect(html).toContain('class="nutrition-sheet-footer"');
    expect(html).toContain('aria-labelledby="nutrition-sheet-title"');
  });
});
