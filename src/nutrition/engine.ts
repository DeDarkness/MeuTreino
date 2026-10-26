import type {
  BodyMeasurement,
  Food,
  MealEntry,
  Nutrients,
  NutritionGoals,
  NutritionProfile,
  NutritionState,
} from "./types";

export const MEALS = [
  "Café da manhã",
  "Lanche da manhã",
  "Almoço",
  "Lanche da tarde",
  "Pré-treino",
  "Pós-treino",
  "Jantar",
  "Ceia",
];
export const CONFIDENCE = {
  approximation: "Estimativa não verificada",
  label: "Rótulo informado",
  tbca: "TBCA informada",
  usda: "USDA informada",
  recipe: "Receita calculada",
};
export const blankGoals = (): NutritionGoals => ({
  kcal: null,
  protein: null,
  carbs: null,
  fat: null,
  fiber: null,
  waterMl: null,
  validated: false,
  professionalNote: "",
});
export const blankProfile = (): NutritionProfile => ({
  age: null,
  sex: null,
  heightCm: null,
  referenceWeightKg: null,
  targetWeightKg: null,
  estimatedBodyFat: null,
  activityFactor: null,
  surgeryDate: null,
  stabilityDays: null,
  stabilityToleranceKg: null,
  medicalNotes: "",
  clearanceNote: "",
  preferredKcalMin: null,
  preferredKcalMax: null,
});
export const emptyNutrition = (): NutritionState => ({
  version: 1,
  profile: blankProfile(),
  goals: blankGoals(),
  foods: [],
  entries: [],
  days: [],
  measurements: [],
  favorites: [],
  templates: [],
  checklist: [],
});
export const nutritionId = () => crypto.randomUUID();
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDate(date) === value;
}
export function offsetDate(date: string, offset: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + offset);
  return localDate(next);
}
export const macroEnergy = (
  value: Pick<Nutrients, "protein" | "carbs" | "fat">,
) => value.protein * 4 + value.carbs * 4 + value.fat * 9;
export function nutrientsFor(food: Food, quantity: number): Nutrients {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000)
    throw new Error("Informe uma quantidade positiva de até 100.000 g/ml.");
  const ratio = quantity / 100;
  return {
    kcal: food.per100.kcal * ratio,
    protein: food.per100.protein * ratio,
    carbs: food.per100.carbs * ratio,
    fat: food.per100.fat * ratio,
    fiber: food.per100.fiber === null ? null : food.per100.fiber * ratio,
  };
}
export function totalNutrients(
  entries: Pick<MealEntry, "food" | "quantity">[],
) {
  const values = entries.map((entry) =>
    nutrientsFor(entry.food, entry.quantity),
  );
  const sum = (key: "kcal" | "protein" | "carbs" | "fat") =>
    values.reduce((total, value) => total + value[key], 0);
  return {
    kcal: sum("kcal"),
    protein: sum("protein"),
    carbs: sum("carbs"),
    fat: sum("fat"),
    fiber: values.some((value) => value.fiber === null)
      ? null
      : values.reduce((total, value) => total + (value.fiber ?? 0), 0),
    missingFiber: values.filter((value) => value.fiber === null).length,
  };
}
export function substitution(
  food: Food,
  quantity: number,
  alternative: Food,
  metric: "kcal" | "protein" | "carbs" | "fat",
) {
  if (food.group !== alternative.group)
    throw new Error("Escolha uma alternativa do mesmo grupo.");
  const target = nutrientsFor(food, quantity)[metric];
  if (target <= 0 || alternative.per100[metric] <= 0) return null;
  const amount = (target / alternative.per100[metric]) * 100;
  if (!Number.isFinite(amount) || amount > 100000) return null;
  const next = nutrientsFor(alternative, amount);
  const previous = nutrientsFor(food, quantity);
  return {
    quantity: amount,
    nutrients: next,
    delta: {
      kcal: next.kcal - previous.kcal,
      protein: next.protein - previous.protein,
      carbs: next.carbs - previous.carbs,
      fat: next.fat - previous.fat,
      fiber:
        next.fiber === null || previous.fiber === null
          ? null
          : next.fiber - previous.fiber,
    },
  };
}
/** Original simplified Mifflin–St Jeor equation, PubMed 2305711. Not measured expenditure. */
export function restingEnergy(
  profile: NutritionProfile,
  observedWeight?: number | null,
) {
  const weight = observedWeight ?? profile.referenceWeightKg;
  if (!weight || !profile.heightCm || !profile.age || !profile.sex) return null;
  return (
    10 * weight +
    6.25 * profile.heightCm -
    5 * profile.age +
    (profile.sex === "male" ? 5 : -161)
  );
}
export function weightAverage(
  measurements: BodyMeasurement[],
  end: string,
  days = 7,
) {
  const start = offsetDate(end, -(days - 1));
  const values = measurements
    .filter(
      (entry) =>
        entry.date >= start && entry.date <= end && entry.weightKg !== null,
    )
    .map((entry) => entry.weightKg!);
  return {
    value: values.length
      ? values.reduce((sum, weight) => sum + weight, 0) / values.length
      : null,
    count: values.length,
  };
}
export function observedStability(state: NutritionState, end = localDate()) {
  const { stabilityDays, stabilityToleranceKg } = state.profile;
  if (!stabilityDays || stabilityToleranceKg === null) return null;
  const start = offsetDate(end, -(stabilityDays - 1));
  const values = state.measurements
    .filter(
      (entry) =>
        entry.date >= start && entry.date <= end && entry.weightKg !== null,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  if (values.length < 2)
    return { status: "Dados insuficientes", count: values.length, range: null };
  const span =
    (Date.parse(`${values.at(-1)!.date}T12:00:00`) -
      Date.parse(`${values[0].date}T12:00:00`)) /
    86400000;
  const range =
    Math.max(...values.map((entry) => entry.weightKg!)) -
    Math.min(...values.map((entry) => entry.weightKg!));
  return {
    status:
      span < stabilityDays - 1
        ? "Período incompleto"
        : range <= stabilityToleranceKg
          ? "Variação dentro da faixa informada"
          : "Variação acima da faixa informada",
    count: values.length,
    range,
  };
}
export function ensureNutritionDay(state: NutritionState, date: string) {
  if (!validDate(date)) throw new Error("Data inválida.");
  if (state.days.some((day) => day.date === date)) return state;
  return {
    ...state,
    days: [
      ...state.days,
      {
        date,
        waterMl: 0,
        sleepHours: null,
        hunger: null,
        energy: null,
        fatigue: null,
        recovery: null,
        notes: "",
        complete: false,
        goals: structuredClone(state.goals),
      },
    ],
  };
}
export function saveMealEntry(state: NutritionState, entry: MealEntry) {
  if (entry.kind === "consumed" && entry.date > localDate())
    throw new Error(
      "Consumo futuro não pode ser registrado como realizado. Use o planejamento.",
    );
  nutrientsFor(entry.food, entry.quantity);
  const next = ensureNutritionDay(state, entry.date);
  const exists = next.entries.some((item) => item.id === entry.id);
  const snapshot = structuredClone(entry);
  if (!exists)
    snapshot.order =
      next.entries.reduce((max, item) => Math.max(max, item.order), -1) + 1;
  return {
    ...next,
    entries: exists
      ? next.entries.map((item) => (item.id === entry.id ? snapshot : item))
      : [...next.entries, snapshot],
  };
}
export function consumePlannedEntry(state: NutritionState, id: string) {
  const planned = state.entries.find(
    (entry) => entry.id === id && entry.kind === "planned",
  );
  if (!planned) throw new Error("Refeição planejada não encontrada.");
  if (
    state.entries.some(
      (entry) => entry.kind === "consumed" && entry.planEntryId === id,
    )
  )
    throw new Error("Este item já foi registrado como consumido.");
  return saveMealEntry(state, {
    ...planned,
    id: nutritionId(),
    kind: "consumed",
    planEntryId: planned.id,
  });
}
export function copyNutritionEntries(
  state: NutritionState,
  date: string,
  target: string,
  kind: MealEntry["kind"],
) {
  if (date === target) throw new Error("Escolha outro dia.");
  if (!validDate(target)) throw new Error("Data de destino inválida.");
  let next = state;
  for (const entry of state.entries.filter(
    (item) => item.date === date && item.kind === kind,
  ))
    next = saveMealEntry(next, {
      ...entry,
      id: nutritionId(),
      date: target,
      planEntryId: undefined,
    });
  return next;
}
export function shoppingList(entries: MealEntry[], start: string, end: string) {
  const items = new Map<
    string,
    { name: string; quantity: number; unit: Food["unit"]; preparation: string }
  >();
  for (const entry of entries.filter(
    (item) => item.kind === "planned" && item.date >= start && item.date <= end,
  )) {
    const key = `${entry.food.id}::${entry.food.name}::${entry.food.unit}::${entry.food.preparation}`;
    const previous = items.get(key);
    items.set(key, {
      name: entry.food.name,
      unit: entry.food.unit,
      preparation: entry.food.preparation,
      quantity: entry.quantity + (previous?.quantity ?? 0),
    });
  }
  return [...items.values()];
}
/** Only the semicolon master catalog is accepted; narrative/profile text is not imported. */
export function parseEliteCatalog(text: string): Food[] {
  const rows = text.split(/\r?\n/).filter((line) => /;100 (g|ml);/.test(line));
  if (!rows.length || rows.length > 2000)
    throw new Error(
      "Catálogo vazio ou grande demais. Use até 2.000 alimentos.",
    );
  const keys = new Set<string>();
  return rows.map((row) => {
    const fields = row.split(";");
    if (fields.length !== 8 || fields[7].trim() !== "APROXIMACAO")
      throw new Error("Formato ou confiança inválida no catálogo.");
    const [group, name, base] = fields;
    const key = `${group.trim().toLocaleLowerCase("pt-BR")}::${name.trim().toLocaleLowerCase("pt-BR")}::${base}`;
    if (!group.trim() || !name.trim() || keys.has(key))
      throw new Error("Alimento sem nome/grupo ou duplicado.");
    keys.add(key);
    const numbers = fields
      .slice(3, 7)
      .map((value) =>
        /^\d+(?:[.,]\d+)?$/.test(value.trim())
          ? Number(value.replace(",", "."))
          : NaN,
      );
    if (
      numbers.some(
        (value) => !Number.isFinite(value) || value < 0 || value > 10000,
      )
    )
      throw new Error(`Valores inválidos: ${name}.`);
    return {
      id: `elite-1-${encodeURIComponent(key)}`,
      name: name.trim(),
      group: group.trim(),
      unit: base.trim() === "100 ml" ? "ml" : "g",
      preparation: name.trim(),
      source:
        "Tabela Elite fornecida, edição 26/10/2026. Estimativas genéricas; não transcritas individualmente da TBCA/USDA.",
      confidence: "approximation",
      verifiedAt: null,
      per100: {
        kcal: numbers[0],
        protein: numbers[1],
        carbs: numbers[2],
        fat: numbers[3],
        fiber: null,
      },
      portionSize: null,
    };
  });
}
export function nutritionReport(
  state: NutritionState,
  end: string,
  days: number,
) {
  const dates = Array.from({ length: days }, (_, index) =>
    offsetDate(end, -days + index + 1),
  );
  return dates.map((date) => {
    const entries = state.entries.filter(
      (item) => item.date === date && item.kind === "consumed",
    );
    const day = state.days.find((item) => item.date === date);
    const measurement = state.measurements.find((item) => item.date === date);
    return {
      date,
      hasFood: entries.length > 0 || Boolean(day?.complete),
      complete: day?.complete ?? false,
      totals: totalNutrients(entries),
      goals: day?.goals ?? null,
      waterMl: day?.waterMl ?? null,
      sleepHours: day?.sleepHours ?? null,
      weightKg: measurement?.weightKg ?? null,
      waistCm: measurement?.waistCm ?? null,
      notes: day?.notes ?? "",
    };
  });
}
export function reportCsv(state: NutritionState, end: string, days: number) {
  const cell = (value: unknown) =>
    `"${String(value ?? "")
      .replace(/^[\s\uFEFF]*[=+@-]/, "'$&")
      .replaceAll('"', '""')}"`;
  const rows = nutritionReport(state, end, days).map((row) => [
    row.date,
    row.complete ? "completo" : "parcial/sem registro",
    row.hasFood ? row.totals.kcal : null,
    row.hasFood ? row.totals.protein : null,
    row.hasFood ? row.totals.carbs : null,
    row.hasFood ? row.totals.fat : null,
    row.hasFood ? row.totals.fiber : null,
    row.goals?.kcal,
    row.waterMl,
    row.sleepHours,
    row.weightKg,
    row.waistCm,
    row.notes,
  ]);
  return (
    "\uFEFF" +
    [
      [
        "data",
        "diario",
        "kcal",
        "proteina_g",
        "carbo_g",
        "gordura_g",
        "fibra_g",
        "meta_kcal_informada",
        "agua_ml",
        "sono_h",
        "peso_kg",
        "cintura_cm",
        "observacoes",
      ],
      ...rows,
    ]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n")
  );
}
