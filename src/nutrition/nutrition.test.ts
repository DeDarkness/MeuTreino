import { IDBDatabase, IDBFactory } from "fake-indexeddb";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ELITE_FOODS } from "./catalog";
import {
  blankProfile,
  consumePlannedEntry,
  copyNutritionEntries,
  emptyNutrition,
  ensureNutritionDay,
  localDate,
  macroEnergy,
  nutritionReport,
  nutrientsFor,
  observedStability,
  offsetDate,
  parseEliteCatalog,
  reportCsv,
  restingEnergy,
  saveMealEntry,
  shoppingList,
  substitution,
  totalNutrients,
  validDate,
  weightAverage,
} from "./engine";
import { validateFood, validateNutrition, validateProfile } from "./validation";
import {
  createSeedState,
  exportState,
  importState,
  loadState,
  readSafetySnapshot,
  saveState,
} from "../lib/database";
import {
  completeActiveSet,
  finishActiveWorkout,
  startRecoveryWorkout,
  startWorkoutFromPlan,
} from "../lib/workout";
import { NutritionSummary } from "./NutritionSummary";
import { BottomNav } from "../components/BottomNav";
import type { BodyMeasurement, MealEntry } from "./types";

const today = localDate();
const rice = ELITE_FOODS.find(
  (food) => food.name === "Arroz branco cozido sem óleo",
)!;
const integral = ELITE_FOODS.find(
  (food) => food.name === "Arroz integral cozido",
)!;
const olive = ELITE_FOODS.find((food) => food.name === "Azeite de oliva (ml)")!;
const entry = (kind: MealEntry["kind"] = "consumed"): MealEntry => ({
  id: "entry-1",
  date: today,
  meal: "Almoço",
  time: "12:30",
  quantity: 150,
  food: structuredClone(rice),
  kind,
  order: 0,
});
const measure = (date: string, weightKg: number | null): BodyMeasurement => ({
  id: date,
  date,
  weightKg,
  waistCm: null,
  hipCm: null,
  armCm: null,
  chestCm: null,
  thighCm: null,
  calfCm: null,
  bodyFat: null,
  method: "",
  notes: "",
});
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("origem e qualidade do catálogo enviado", () => {
  it("tem 345 referências e 12 grupos, sem IDs repetidos nem falsa verificação", () => {
    expect(ELITE_FOODS).toHaveLength(345);
    expect(new Set(ELITE_FOODS.map((food) => food.group)).size).toBe(12);
    expect(new Set(ELITE_FOODS.map((food) => food.id)).size).toBe(345);
    expect(
      ELITE_FOODS.every(
        (food) =>
          food.confidence === "approximation" &&
          food.verifiedAt === null &&
          food.per100.fiber === null,
      ),
    ).toBe(true);
    ELITE_FOODS.forEach((food) => {
      expect(() => validateFood(food)).not.toThrow();
      expect(
        Math.abs(food.per100.kcal - macroEnergy(food.per100)),
      ).toBeLessThan(0.11);
    });
  });
  it("não mistura volume e massa: azeite de 100 ml tem os valores já declarados no arquivo", () => {
    expect(olive.unit).toBe("ml");
    expect(nutrientsFor(olive, 10)).toMatchObject({ kcal: 81.9, fat: 9.1 });
    expect(rice.unit).toBe("g");
    expect(nutrientsFor(rice, 150).kcal).toBeCloseTo(192.6);
  });
  it("não inventa fibras; preserva casas decimais internamente", () => {
    const values = totalNutrients([{ food: rice, quantity: 87.321 }]);
    expect(values.fiber).toBeNull();
    expect(values.missingFiber).toBe(1);
    expect(values.carbs).toBeCloseTo(25.148448, 6);
    expect(totalNutrients([])).toMatchObject({
      kcal: 0,
      missingFiber: 0,
      fiber: 0,
    });
  });
  it.each([0, -1, NaN, Infinity, 100001])(
    "rejeita quantidade inválida %s",
    (quantity) => expect(() => nutrientsFor(rice, quantity)).toThrow(),
  );
  it("importa apenas catálogo, sem incorporar o texto pessoal do documento", () => {
    const raw =
      "Meu perfil clínico\nGRUPO;Alimento cozido;100 g;100,0;10,0;15,0;0,0;APROXIMACAO\nFim";
    const parsed = parseEliteCatalog(raw);
    expect(parsed).toHaveLength(1);
    expect(JSON.stringify(parsed)).not.toContain("Meu perfil clínico");
    expect(() =>
      parseEliteCatalog(
        raw + "\nGRUPO;Alimento cozido;100 g;100,0;10,0;15,0;0,0;APROXIMACAO",
      ),
    ).toThrow("duplicado");
    expect(() => parseEliteCatalog("")).toThrow();
    expect(() => parseEliteCatalog(raw.replace("100,0", "NaN"))).toThrow();
    expect(() =>
      parseEliteCatalog(raw.replace("APROXIMACAO", "TBCA_VERIFICADA")),
    ).toThrow();
  });
});
describe("equivalências, estimativas e datas", () => {
  it("iguala o critério e mostra as diferenças dos demais macros", () => {
    const result = substitution(rice, 100, integral, "carbs")!;
    expect(result.nutrients.carbs).toBeCloseTo(28.8);
    expect(result.delta.fat).not.toBe(0);
    expect(result.delta.fiber).toBeNull();
    expect(result.quantity).toBeCloseTo(111.6279069767);
    expect(() => substitution(rice, 100, olive, "kcal")).toThrow("mesmo grupo");
    expect(
      substitution(
        { ...rice, per100: { ...rice.per100, protein: 0 } },
        100,
        integral,
        "protein",
      ),
    ).toBeNull();
  });
  it("usa Mifflin simplificado e não calcula sem os parâmetros necessários", () => {
    const profile = {
      ...blankProfile(),
      age: 30,
      sex: "male" as const,
      heightCm: 180,
      referenceWeightKg: 80,
    };
    expect(restingEnergy(profile)).toBe(1780);
    expect(restingEnergy({ ...profile, sex: "female" })).toBe(1614);
    expect(restingEnergy(profile, 85)).toBe(1830);
    expect(restingEnergy(blankProfile())).toBeNull();
  });
  it("valida datas reais, anos bissextos e virada local sem depender de UTC", () => {
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2028-02-29")).toBe(true);
    expect(offsetDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(offsetDate("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("média usa só pesagens existentes na janela, não peso de referência nem dias vazios", () => {
    const measurements = [
      measure(offsetDate(today, -7), 200),
      measure(offsetDate(today, -6), 100),
      measure(today, 102),
    ];
    expect(weightAverage(measurements, today)).toEqual({
      value: 101,
      count: 2,
    });
    expect(weightAverage([], today)).toEqual({ value: null, count: 0 });
  });
  it("estabilidade usa período e faixa informados, sem emitir liberação", () => {
    const state = emptyNutrition();
    expect(observedStability(state)).toBeNull();
    state.profile.stabilityDays = 7;
    state.profile.stabilityToleranceKg = 1;
    expect(observedStability(state)?.status).toBe("Dados insuficientes");
    state.measurements = [
      measure(offsetDate(today, -6), 100),
      measure(today, 100.5),
    ];
    expect(observedStability(state)).toMatchObject({
      status: "Variação dentro da faixa informada",
      count: 2,
      range: 0.5,
    });
    state.measurements[0].date = offsetDate(today, -3);
    expect(observedStability(state)?.status).toBe("Período incompleto");
  });
});
describe("diário distinto do plano, sem consumo fictício", () => {
  it("planejar não registra consumo; marcar consumo é explícito e protegido contra duplicação", () => {
    const planned = saveMealEntry(emptyNutrition(), entry("planned"));
    expect(
      totalNutrients(planned.entries.filter((item) => item.kind === "consumed"))
        .kcal,
    ).toBe(0);
    const consumed = consumePlannedEntry(planned, "entry-1");
    expect(consumed.entries).toHaveLength(2);
    expect(consumed.entries[1].planEntryId).toBe("entry-1");
    expect(() => consumePlannedEntry(consumed, "entry-1")).toThrow(
      "já foi registrado",
    );
    expect(() => validateNutrition(consumed)).not.toThrow();
  });
  it("cada registro é uma fotografia imutável do alimento e da meta do dia", () => {
    const original = entry();
    const state = saveMealEntry(emptyNutrition(), original);
    original.food.per100.kcal = 999;
    expect(state.entries[0].food.per100.kcal).toBe(128.4);
    state.goals.kcal = 2000;
    expect(ensureNutritionDay(state, today).days[0].goals.kcal).toBeNull();
    const future = ensureNutritionDay(state, offsetDate(today, 1));
    expect(future.days.at(-1)!.goals.kcal).toBe(2000);
  });
  it("mantém ordenação única ao duplicar/copiar após excluir itens", () => {
    let state = saveMealEntry(emptyNutrition(), entry());
    state = saveMealEntry(state, { ...entry(), id: "entry-2" });
    state = {
      ...state,
      entries: state.entries.filter((item) => item.id !== "entry-1"),
    };
    state = saveMealEntry(state, { ...entry(), id: "entry-3" });
    expect(state.entries.map((item) => item.order)).toEqual([1, 2]);
  });
  it("copiar acrescenta novos IDs, não sobrescreve nem registra consumo futuro", () => {
    const state = saveMealEntry(emptyNutrition(), entry());
    const copied = copyNutritionEntries(
      state,
      today,
      offsetDate(today, -1),
      "consumed",
    );
    expect(copied.entries).toHaveLength(2);
    expect(copied.entries[0]).toEqual(state.entries[0]);
    expect(copied.entries[1].id).not.toBe(state.entries[0].id);
    expect(() => copyNutritionEntries(state, today, today, "consumed")).toThrow(
      "outro dia",
    );
    expect(() =>
      copyNutritionEntries(state, today, offsetDate(today, 1), "consumed"),
    ).toThrow("futuro");
    expect(() =>
      saveMealEntry(emptyNutrition(), {
        ...entry("planned"),
        date: offsetDate(today, 1),
      }),
    ).not.toThrow();
  });
  it("compras somam só planejamento na janela e mantêm unidade e preparo separados", () => {
    const items = [
      entry("planned"),
      { ...entry("planned"), id: "another", quantity: 50 },
      { ...entry(), id: "consumed" },
    ];
    expect(shoppingList(items, today, offsetDate(today, 6))).toMatchObject([
      { name: rice.name, quantity: 200, unit: "g" },
    ]);
    expect(
      shoppingList(items, offsetDate(today, 1), offsetDate(today, 6)),
    ).toEqual([]);
  });
  it("relatório preserva ausência de dados e status parcial", () => {
    const state = saveMealEntry(emptyNutrition(), entry());
    const report = nutritionReport(state, today, 7);
    expect(report).toHaveLength(7);
    expect(report.at(-1)).toMatchObject({ hasFood: true, complete: false });
    expect(report[0]).toMatchObject({
      hasFood: false,
      weightKg: null,
      sleepHours: null,
    });
    state.days[0].notes = '=HYPERLINK("x")';
    expect(reportCsv(state, today, 7)).toContain("'=HYPERLINK");
    expect(reportCsv(state, today, 7)).toContain("parcial/sem registro");
  });
});
describe("validação nutricional rigorosa e retrocompatibilidade", () => {
  it.each([
    "nan",
    "negative",
    "unit",
    "source",
    "date",
    "duplicate",
    "fiber",
    "goal",
    "profile",
    "bodyfat",
  ])("rejeita dados inválidos: %s", (kind) => {
    const state = saveMealEntry(emptyNutrition(), entry());
    if (kind === "nan") state.entries[0].quantity = NaN;
    if (kind === "negative") state.entries[0].food.per100.kcal = -1;
    if (kind === "unit")
      (state.entries[0].food as unknown as { unit: string }).unit = "kg";
    if (kind === "source") state.entries[0].food.source = "";
    if (kind === "date") state.entries[0].date = "2026-02-30";
    if (kind === "duplicate")
      state.entries.push(structuredClone(state.entries[0]));
    if (kind === "fiber") state.entries[0].food.per100.fiber = NaN;
    if (kind === "goal") state.goals.validated = true;
    if (kind === "profile") {
      state.profile.preferredKcalMin = 3000;
      state.profile.preferredKcalMax = 1000;
    }
    if (kind === "bodyfat")
      state.measurements = [
        { ...measure(today, 100), bodyFat: 20, method: "" },
      ];
    expect(() => validateNutrition(state)).toThrow();
  });
  it("validação de perfil não transforma faixa desejada em metas nem pesagens", () => {
    const state = emptyNutrition();
    expect(state.goals.kcal).toBeNull();
    expect(state.measurements).toEqual([]);
    state.profile.preferredKcalMin = 1500;
    state.profile.preferredKcalMax = 1700;
    expect(() => validateProfile(state.profile)).not.toThrow();
    expect(state.goals.kcal).toBeNull();
  });
  it("migra um estado 7.2 sem alterar sessão ativa, histórico ou fila e guarda a cópia anterior", async () => {
    let state = startWorkoutFromPlan(
      createSeedState(),
      "plan-full-body-a",
    ).state;
    const exercise = state.activeWorkout!.exercises[0];
    state = completeActiveSet(state, exercise.exerciseId, exercise.sets[0].id);
    state = finishActiveWorkout(state).state;
    state = startRecoveryWorkout(state, [
      {
        itemId: state.recoveryItems![0].id,
        setIds: [state.recoveryItems![0].exercise.sets[0].id],
      },
    ]).state;
    delete state.nutrition;
    await saveState(state);
    const loaded = await loadState();
    expect(loaded.activeWorkout).toEqual(state.activeWorkout);
    expect(loaded.recoveryItems).toEqual(state.recoveryItems);
    expect(loaded.history).toEqual(state.history);
    expect(loaded.plans).toEqual(state.plans);
    expect(loaded.nutrition).toEqual(emptyNutrition());
    expect((await readSafetySnapshot())?.value).toEqual({
      ...state,
      updatedAt: expect.any(String),
    });
    expect((await readSafetySnapshot())?.value.nutrition).toBeUndefined();
  });
  it("importa backup antigo preservando alimentação nova e exporta ambos no mesmo JSON", async () => {
    const current = createSeedState();
    current.nutrition = saveMealEntry(emptyNutrition(), entry());
    await saveState(current);
    const legacy = createSeedState();
    delete legacy.nutrition;
    legacy.plans[0].name = "Ficha pessoal importada";
    await importState(legacy);
    const loaded = await loadState();
    expect(loaded.plans[0].name).toBe("Ficha pessoal importada");
    expect(loaded.nutrition?.entries).toEqual(current.nutrition.entries);
    const backup = await exportState();
    expect(JSON.parse(backup).state.nutrition.entries).toHaveLength(1);
    await importState(backup);
    expect((await loadState()).nutrition).toEqual(loaded.nutrition);
  });
  it("backup nutricional inválido não substitui histórico nem alimentação existente", async () => {
    const current = await saveState(createSeedState());
    await expect(
      importState({ ...current, nutrition: { version: 99 } }),
    ).rejects.toThrow();
    expect((await loadState()).nutrition).toEqual(current.nutrition);
    expect((await loadState()).plans).toEqual(current.plans);
  });
  it("falha atômica na gravação não perde treino nem alimentação anteriores", async () => {
    const current = createSeedState();
    await saveState(current);
    const transaction = IDBDatabase.prototype.transaction;
    const spy = vi
      .spyOn(IDBDatabase.prototype, "transaction")
      .mockImplementation(function (
        this: IDBDatabase,
        ...args: Parameters<IDBDatabase["transaction"]>
      ) {
        const result = transaction.apply(this, args);
        if (args[1] === "readwrite") queueMicrotask(() => result.abort());
        return result;
      });
    await expect(
      saveState(
        { ...current, nutrition: saveMealEntry(emptyNutrition(), entry()) },
        "Antes de alterar Alimentação",
      ),
    ).rejects.toThrow();
    spy.mockRestore();
    const restored = await loadState();
    expect(restored.nutrition?.entries).toEqual([]);
    expect(restored.plans).toEqual(current.plans);
  });
});
describe("interface sem metas ou dados pessoais fictícios", () => {
  it("oferece cinco áreas com Alimentação, sem perder o tipo de navegação do Wallpaper", () => {
    const html = renderToStaticMarkup(
      createElement(BottomNav, {
        activeTab: "nutrition",
        onChange: () => undefined,
      }),
    );
    expect(html.match(/<button /g)).toHaveLength(5);
    expect(html).toContain("Alimentação");
    expect(html).toContain('aria-current="page"');
  });
  it("não mostra meta restritiva, peso inventado ou gráfico fake na abertura", () => {
    const html = renderToStaticMarkup(
      createElement(NutritionSummary, {
        state: emptyNutrition(),
        onOpen: () => undefined,
      }),
    );
    expect(html).toContain("Defina sua meta manualmente");
    expect(html).toContain("Diário parcial");
    expect(html).not.toContain("1.700");
    expect(html).not.toContain("110,5");
  });
});
