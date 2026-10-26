import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  applyStarterDiet,
  STARTER_DIET_MEALS,
  starterDietEntries,
  starterDietText,
} from "./starterDiet";
import {
  emptyNutrition,
  localDate,
  offsetDate,
  totalNutrients,
  consumePlannedMeal,
  consumePlannedEntry,
  copyNutritionEntries,
} from "./engine";
import { validateNutrition } from "./validation";
import { ELITE_FOODS } from "./catalog";
import { StarterDietPanel } from "./StarterDietPanel";
import { SubstitutionEditor } from "./SubstitutionEditor";

const today = localDate();
const defaults = [0, 0, 0, 0];
describe("cardápio pronto até 1.700 kcal", () => {
  it("calcula a base por ingredientes reais do catálogo sem inventar fibras", () => {
    const entries = starterDietEntries(today);
    const total = totalNutrients(entries);
    expect(total.kcal).toBeCloseTo(1666.936, 3);
    expect(total.protein).toBeGreaterThan(150);
    expect(total.fiber).toBeNull();
    expect(
      entries.every((entry) => entry.kind === "planned" && entry.time === ""),
    ).toBe(true);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    expect(
      entries
        .filter((entry) => entry.food.name === "Azeite de oliva (ml)")
        .reduce((sum, entry) => sum + entry.quantity, 0),
    ).toBe(6);
  });
  it("todas as 504 combinações respeitam o teto, sem frango no café/lanche e com doses de 15 g whey", () => {
    let count = 0;
    for (let a = 0; a < STARTER_DIET_MEALS[0].options.length; a++)
      for (let b = 0; b < STARTER_DIET_MEALS[1].options.length; b++)
        for (let c = 0; c < STARTER_DIET_MEALS[2].options.length; c++)
          for (let d = 0; d < STARTER_DIET_MEALS[3].options.length; d++) {
            const entries = starterDietEntries(today, [a, b, c, d]);
            const total = totalNutrients(entries);
            expect(total.kcal).toBeLessThanOrEqual(1700);
            expect(total.kcal).toBeGreaterThan(1500);
            expect(
              entries
                .filter(
                  (entry) =>
                    entry.meal === "Café da manhã" ||
                    entry.meal === "Lanche da tarde",
                )
                .some((entry) =>
                  entry.food.name.toLocaleLowerCase("pt-BR").includes("frango"),
                ),
            ).toBe(false);
            expect(
              entries
                .filter((entry) => entry.food.name.startsWith("Whey"))
                .every((entry) => entry.quantity === 15),
            ).toBe(true);
            count++;
          }
    expect(count).toBe(504);
    expect(STARTER_DIET_MEALS).toHaveLength(4);
  });
  it("aplica sete dias somente planejados, com meta não validada opcional e backup compatível", () => {
    const original = emptyNutrition();
    const next = applyStarterDiet(original, today, 7, defaults, true);
    expect(validateNutrition(next)).toEqual(next);
    expect(new Set(next.entries.map((entry) => entry.date)).size).toBe(7);
    expect(next.entries.every((entry) => entry.kind === "planned")).toBe(true);
    expect(next.goals.kcal).toBe(1700);
    expect(next.goals.validated).toBe(false);
    expect(
      next.days.every((day) => day.goals.kcal === 1700 && !day.complete),
    ).toBe(true);
    expect(original.entries).toHaveLength(0);
    expect(next.measurements).toHaveLength(0);
    expect(next.profile.referenceWeightKg).toBeNull();
  });
  it("preserva dia planejado, consumo, metas históricas e não duplica numa segunda aplicação", () => {
    const existing = applyStarterDiet(
      emptyNutrition(),
      today,
      1,
      defaults,
      false,
    );
    const next = applyStarterDiet(existing, today, 7, [1, 1, 1, 1], true);
    expect(next.entries.filter((entry) => entry.date === today)).toEqual(
      existing.entries,
    );
    expect(next.days.find((day) => day.date === today)?.goals.kcal).toBeNull();
    expect(() => applyStarterDiet(next, today, 7, defaults, false)).toThrow(
      "já têm planejamento",
    );
    expect(next.entries.length).toBe(
      starterDietEntries(today).length * 1 +
        starterDietEntries(today, [1, 1, 1, 1]).length * 6,
    );
    expect(existing.goals.kcal).toBeNull();
  });
  it("não muda meta sem escolha explícita e preserva consumo existente", () => {
    const state = emptyNutrition();
    state.goals.kcal = 2300;
    state.entries = [{ ...starterDietEntries(today)[0], kind: "consumed" }];
    const next = applyStarterDiet(state, today, 1, defaults, false);
    expect(next.goals.kcal).toBe(2300);
    expect(next.entries[0]).toEqual(state.entries[0]);
    expect(
      next.entries.filter((entry) => entry.kind === "consumed"),
    ).toHaveLength(1);
    expect(validateNutrition(next)).toEqual(next);
  });
  it("rejeita passado, opções inválidas e não altera estado com rótulos acima do teto", () => {
    const state = emptyNutrition();
    expect(() =>
      applyStarterDiet(state, offsetDate(today, -1), 1, defaults, false),
    ).toThrow();
    expect(() => starterDietEntries(today, [0])).toThrow();
    expect(() => starterDietEntries(today, [0, 0, 99, 0])).toThrow();
    expect(() => starterDietEntries("2026-02-30")).toThrow();
    const changed = structuredClone(ELITE_FOODS);
    changed.find(
      (food) => food.name === "Peito de frango cozido sem pele",
    )!.per100.kcal = 600;
    expect(() =>
      applyStarterDiet(state, today, 1, defaults, false, changed),
    ).toThrow("ultrapassa");
    expect(state.entries).toHaveLength(0);
  });
  it("mostra escolhas de refeições, ingredientes, cautelas e não reivindica validação", () => {
    const html = renderToStaticMarkup(
      createElement(StarterDietPanel, {
        state: emptyNutrition(),
        date: today,
        catalog: ELITE_FOODS,
        change: async () => undefined,
      }),
    );
    expect(html).toContain("Sua base de até 1.700 kcal");
    expect(html).toContain("Iogurte com 15 g de whey, aveia e manga");
    expect(html).toContain("Preencher 7 dias vazios");
    expect(html).toContain("não prescrição validada");
    expect(html).toContain("Preparo incluído");
    expect(html).toContain("peso do caldo não substitui o peso da carne");
    expect(html).not.toContain("110,5");
  });
  it("mostra o total diário projetado nas trocas de alimentos", () => {
    const html = renderToStaticMarkup(
      createElement(SubstitutionEditor, {
        entry: starterDietEntries(today)[0],
        catalog: ELITE_FOODS,
        onCancel: () => undefined,
        onSave: async () => undefined,
        dayTotalKcal: 1666.936,
        limitKcal: 1700,
      }),
    );
    expect(html).toContain("Total do dia após a troca:");
  });
  it("exporta ingredientes e opções reais e respeita alimento renomeado pelo ID estável", () => {
    const catalog = structuredClone(ELITE_FOODS);
    catalog.find(
      (food) => food.name === "Peito de frango cozido sem pele",
    )!.name = "Meu frango conferido";
    const text = starterDietText(today, defaults, catalog);
    expect(text).toContain("Meu frango conferido");
    expect(text).toContain("[ESCOLHIDA]");
    expect(text).toContain("[TROCA]");
    expect(text).toContain("Iogurte com 15 g de whey, aveia e manga");
    expect(text).toContain("Panqueca de aveia");
    expect(text).toContain("Tigela de iogurte, aveia");
    expect(text).toContain("Preparo incluído");
    expect(text).toContain("carne cozida sem o caldo");
    expect(
      starterDietEntries(today, defaults, catalog).some(
        (entry) => entry.food.name === "Meu frango conferido",
      ),
    ).toBe(true);
  });
  it("agrupa os temperos sem retirar calorias, incluindo cópias e backup", () => {
    const next = applyStarterDiet(emptyNutrition(), today, 1, defaults, false);
    const preparation = next.entries.filter((entry) => entry.preparationOnly);
    expect(preparation).toHaveLength(8);
    expect(totalNutrients(preparation).kcal).toBeCloseTo(115.066, 3);
    expect(validateNutrition(JSON.parse(JSON.stringify(next)))).toEqual(next);
    const invalid = structuredClone(next);
    Object.assign(invalid.entries[0], { preparationOnly: "yes" });
    expect(() => validateNutrition(invalid)).toThrow();
  });
  it("atualiza planos apenas após escolha explícita, preservando consumidos e dias fora do intervalo", () => {
    let state = applyStarterDiet(emptyNutrition(), today, 7, defaults, false);
    state = {
      ...state,
      entries: [
        ...state.entries,
        {
          ...state.entries[0],
          id: "consumed-original",
          kind: "consumed",
          planEntryId: state.entries[0].id,
        },
        { ...state.entries[0], id: "past", date: offsetDate(today, -1) },
        { ...state.entries[0], id: "later", date: offsetDate(today, 8) },
      ],
    };
    const original = structuredClone(state);
    const next = applyStarterDiet(
      state,
      today,
      7,
      [1, 1, 1, 1],
      false,
      ELITE_FOODS,
      "replace",
    );
    expect(
      next.entries.find((entry) => entry.id === "consumed-original"),
    ).toEqual(state.entries.find((entry) => entry.id === "consumed-original"));
    expect(next.entries.find((entry) => entry.id === "past")).toEqual(
      state.entries.find((entry) => entry.id === "past"),
    );
    expect(next.entries.find((entry) => entry.id === "later")).toEqual(
      state.entries.find((entry) => entry.id === "later"),
    );
    expect(next.entries.some((entry) => entry.id === state.entries[0].id)).toBe(
      false,
    );
    expect(
      next.entries.filter(
        (entry) => entry.kind === "planned" && entry.date === today,
      ),
    ).toHaveLength(starterDietEntries(today, [1, 1, 1, 1]).length);
    expect(validateNutrition(next)).toEqual(next);
    expect(state).toEqual(original);
  });
  it("registrar refeição inclui preparo sem duplicar alimentos já consumidos", () => {
    const state = applyStarterDiet(emptyNutrition(), today, 1, defaults, false);
    const lunch = state.entries.filter((entry) => entry.meal === "Almoço");
    const partial = consumePlannedEntry(state, lunch[0].id);
    const next = consumePlannedMeal(partial, today, "Almoço");
    const consumed = next.entries.filter((entry) => entry.kind === "consumed");
    expect(consumed).toHaveLength(lunch.length);
    expect(consumed.filter((entry) => entry.preparationOnly)).toHaveLength(4);
    expect(totalNutrients(consumed)).toEqual(totalNutrients(lunch));
    expect(validateNutrition(next)).toEqual(next);
    expect(() => consumePlannedMeal(next, today, "Almoço")).toThrow(
      "já foi registrada",
    );
  });
  it("refeição futura não vira consumo e cópia mantém a classificação de preparo", () => {
    const state = applyStarterDiet(emptyNutrition(), today, 1, defaults, false);
    const tomorrow = offsetDate(today, 1);
    const copied = copyNutritionEntries(state, today, tomorrow, "planned");
    expect(
      copied.entries.filter(
        (entry) => entry.date === tomorrow && entry.preparationOnly,
      ),
    ).toHaveLength(8);
    const original = structuredClone(copied);
    expect(() => consumePlannedMeal(copied, tomorrow, "Almoço")).toThrow(
      "Consumo futuro",
    );
    expect(copied).toEqual(original);
  });
  it("atualização do plano falha atomicamente se referências novas ultrapassam o teto", () => {
    const state = applyStarterDiet(emptyNutrition(), today, 7, defaults, false);
    const original = structuredClone(state);
    const catalog = structuredClone(ELITE_FOODS);
    catalog.find((food) => food.name === "Muçarela light")!.per100.kcal = 10000;
    expect(() =>
      applyStarterDiet(state, today, 7, defaults, false, catalog, "replace"),
    ).toThrow("ultrapassa");
    expect(state).toEqual(original);
  });
  it("inclui leite e requeijão com unidades e rótulos distintos, sem adicionar leite duas vezes", () => {
    const milkBreakfast = starterDietEntries(today, [5, 0, 0, 0]).filter(
      (entry) => entry.meal === "Café da manhã",
    );
    expect(
      milkBreakfast.find((entry) => entry.food.name === "Leite desnatado (ml)"),
    ).toMatchObject({ quantity: 150, food: { unit: "ml" } });
    expect(
      milkBreakfast.filter((entry) => entry.food.name.startsWith("Leite")),
    ).toHaveLength(1);
    expect(
      milkBreakfast.find((entry) => entry.food.name.startsWith("Whey"))
        ?.quantity,
    ).toBe(15);
    expect(
      milkBreakfast.find((entry) => entry.food.name === "Requeijao light")
        ?.quantity,
    ).toBe(15);
    const wholeMilkBreakfast = starterDietEntries(today, [6, 0, 0, 0]).filter(
      (entry) => entry.meal === "Café da manhã",
    );
    expect(
      wholeMilkBreakfast.some(
        (entry) => entry.food.name === "Leite integral (ml)",
      ),
    ).toBe(true);
    expect(
      wholeMilkBreakfast.some(
        (entry) => entry.food.name === "Requeijao tradicional",
      ),
    ).toBe(true);
    expect(totalNutrients(wholeMilkBreakfast).kcal).toBeCloseTo(386.32, 2);
    expect(starterDietText(today, [7, 0, 6, 0])).toContain(
      "Leite semidesnatado",
    );
  });
});
