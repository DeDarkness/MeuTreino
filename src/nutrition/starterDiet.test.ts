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
    expect(total.kcal).toBeCloseTo(1648.496, 3);
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
  it("todas as 180 combinações prontas respeitam o teto estimado, inclusive frutas/whey/aveia", () => {
    let count = 0;
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 3; b++)
        for (let c = 0; c < 5; c++)
          for (let d = 0; d < 3; d++) {
            const total = totalNutrients(
              starterDietEntries(today, [a, b, c, d]),
            );
            expect(total.kcal).toBeLessThanOrEqual(1700);
            expect(total.kcal).toBeGreaterThan(1500);
            count++;
          }
    expect(count).toBe(180);
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
      (food) => food.name === "Peito de frango grelhado sem pele",
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
    expect(html).toContain("Iogurte com whey e manga");
    expect(html).toContain("Preencher 7 dias vazios");
    expect(html).toContain("não prescrição validada");
    expect(html).toContain("Páprica");
    expect(html).not.toContain("110,5");
  });
  it("mostra o total diário projetado nas trocas de alimentos", () => {
    const html = renderToStaticMarkup(
      createElement(SubstitutionEditor, {
        entry: starterDietEntries(today)[0],
        catalog: ELITE_FOODS,
        onCancel: () => undefined,
        onSave: async () => undefined,
        dayTotalKcal: 1648.496,
        limitKcal: 1700,
      }),
    );
    expect(html).toContain("Total do dia após a troca:");
  });
  it("exporta ingredientes e opções reais e respeita alimento renomeado pelo ID estável", () => {
    const catalog = structuredClone(ELITE_FOODS);
    catalog.find(
      (food) => food.name === "Peito de frango grelhado sem pele",
    )!.name = "Meu frango conferido";
    const text = starterDietText(today, defaults, catalog);
    expect(text).toContain("Meu frango conferido");
    expect(text).toContain("[ESCOLHIDA]");
    expect(text).toContain("[TROCA]");
    expect(text).toContain("Iogurte com whey e manga");
    expect(text).toContain("Panqueca de aveia");
    expect(text).toContain("Tigela de iogurte, aveia");
    expect(text).toContain("Páprica");
    expect(
      starterDietEntries(today, defaults, catalog).some(
        (entry) => entry.food.name === "Meu frango conferido",
      ),
    ).toBe(true);
  });
});
