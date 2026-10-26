import type { NutritionState } from "./types";
import { validDate } from "./engine";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const fail = (path: string): never => {
  throw new Error(`Dados de alimentação inválidos: ${path}.`);
};
const object = (value: unknown, path: string): RecordValue =>
  record(value) ? value : fail(path);
function text(value: unknown, path: string, max = 2000, required = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    fail(path);
}
function number(
  value: unknown,
  path: string,
  min: number,
  max: number,
  nullable = false,
) {
  if (nullable && value === null) return;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    fail(path);
}
function date(value: unknown, path: string) {
  if (!validDate(value)) fail(path);
}
function bool(value: unknown, path: string) {
  if (typeof value !== "boolean") fail(path);
}
function list(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) return fail(path);
  return value;
}
function unique(items: unknown[], key: string, path: string) {
  const seen = new Set<unknown>();
  for (const item of items) {
    const value = object(item, path)[key];
    text(value, path, 1000, true);
    if (seen.has(value)) fail(`${path} duplicado`);
    seen.add(value);
  }
}
export function validateGoals(value: unknown) {
  const goals = object(value, "metas");
  for (const key of ["kcal", "protein", "carbs", "fat", "fiber", "waterMl"])
    number(
      goals[key],
      `metas.${key}`,
      key === "kcal" ? 1 : 0,
      key === "waterMl" ? 20000 : key === "kcal" ? 10000 : 3000,
      true,
    );
  bool(goals.validated, "meta validada");
  text(goals.professionalNote, "orientação da meta");
  if (
    goals.validated &&
    !(
      typeof goals.professionalNote === "string" &&
      goals.professionalNote.trim()
    )
  )
    fail(
      "registre a orientação profissional antes de marcar a meta como validada",
    );
}
export function validateProfile(value: unknown) {
  const profile = object(value, "perfil");
  for (const [key, min, max] of [
    ["age", 18, 110],
    ["heightCm", 100, 250],
    ["referenceWeightKg", 20, 500],
    ["targetWeightKg", 20, 500],
    ["estimatedBodyFat", 1, 75],
    ["activityFactor", 1, 3],
    ["stabilityDays", 2, 365],
    ["stabilityToleranceKg", 0, 50],
    ["preferredKcalMin", 1, 10000],
    ["preferredKcalMax", 1, 10000],
  ] as const)
    number(profile[key], `perfil.${key}`, min, max, true);
  if (
    profile.sex !== null &&
    profile.sex !== "male" &&
    profile.sex !== "female"
  )
    fail("sexo para estimativa");
  if (profile.surgeryDate !== null)
    date(profile.surgeryDate, "data da cirurgia");
  if (
    profile.preferredKcalMin !== null &&
    profile.preferredKcalMax !== null &&
    Number(profile.preferredKcalMin) > Number(profile.preferredKcalMax)
  )
    fail("faixa calórica invertida");
  if (
    profile.stabilityDays !== null &&
    !Number.isInteger(profile.stabilityDays)
  )
    fail("dias de estabilidade");
  text(profile.medicalNotes, "orientações médicas", 5000);
  text(profile.clearanceNote, "liberação médica", 5000);
}
export function validateFood(value: unknown) {
  const food = object(value, "alimento");
  text(food.id, "id alimento", 1000, true);
  text(food.name, "nome alimento", 180, true);
  text(food.group, "grupo", 120, true);
  text(food.preparation, "preparo", 500, true);
  text(food.source, "fonte", 2000, true);
  if (food.brand !== undefined) text(food.brand, "marca", 180);
  if (!["g", "ml"].includes(String(food.unit))) fail("unidade: use g ou ml");
  if (
    !["approximation", "label", "tbca", "usda", "recipe"].includes(
      String(food.confidence),
    )
  )
    fail("origem do alimento");
  if (food.verifiedAt !== null) date(food.verifiedAt, "data da conferência");
  if (food.confidence !== "approximation" && food.verifiedAt === null)
    fail("data da fonte conferida");
  const nutrients = object(food.per100, "nutrientes");
  number(nutrients.kcal, "kcal", 0, 10000);
  for (const key of ["protein", "carbs", "fat", "fiber"])
    number(nutrients[key], key, 0, 150, key === "fiber");
  if (
    food.unit === "g" &&
    Number(nutrients.protein) +
      Number(nutrients.carbs) +
      Number(nutrients.fat) >
      105
  )
    fail("macronutrientes incompatíveis com a referência de 100 g");
  number(food.portionSize, "tamanho da porção", 0.01, 100000, true);
}
function entry(value: unknown, template = false) {
  const item = object(value, "item da refeição");
  if (!template) {
    text(item.id, "id refeição", 1000, true);
    date(item.date, "data refeição");
  }
  text(item.meal, "nome da refeição", 120, true);
  if (
    typeof item.time !== "string" ||
    (item.time !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time))
  )
    fail("horário");
  if (item.kind !== "consumed" && item.kind !== "planned")
    fail("situação da refeição");
  number(item.quantity, "quantidade", 0.000001, 100000);
  number(item.order, "ordem", 0, 1000000);
  if (!Number.isInteger(item.order)) fail("ordem inteira");
  if (item.planEntryId !== undefined)
    text(item.planEntryId, "origem do consumo", 1000, true);
  validateFood(item.food);
}
export function validateNutrition(value: unknown): NutritionState {
  const state = object(value, "módulo");
  if (state.version !== 1) fail("versão incompatível");
  validateProfile(state.profile);
  validateGoals(state.goals);
  const foods = list(state.foods, "alimentos", 5000);
  unique(foods, "id", "alimentos");
  foods.forEach(validateFood);
  const entries = list(state.entries, "refeições", 30000);
  unique(entries, "id", "refeições");
  entries.forEach((item) => entry(item));
  const links = new Set<string>();
  for (const raw of entries) {
    const item = object(raw, "refeição");
    if (item.planEntryId !== undefined) {
      if (item.kind !== "consumed" || links.has(String(item.planEntryId)))
        fail("consumo duplicado ou origem inválida");
      links.add(String(item.planEntryId));
      const origin = entries.find(
        (candidate) => record(candidate) && candidate.id === item.planEntryId,
      );
      if (
        record(origin) &&
        (origin.kind !== "planned" || origin.date !== item.date)
      )
        fail("data/origem do consumo");
    }
  }
  const days = list(state.days, "dias", 10000);
  unique(days, "date", "dias");
  for (const raw of days) {
    const day = object(raw, "dia");
    date(day.date, "dia");
    number(day.waterMl, "água", 0, 30000);
    number(day.sleepHours, "sono", 0, 24, true);
    for (const key of ["hunger", "energy", "fatigue", "recovery"])
      number(day[key], key, 1, 5, true);
    bool(day.complete, "diário completo");
    text(day.notes, "observações");
    validateGoals(day.goals);
  }
  const measurements = list(state.measurements, "medidas", 10000);
  unique(measurements, "id", "medidas");
  unique(measurements, "date", "dia da medida");
  for (const raw of measurements) {
    const measurement = object(raw, "medida");
    date(measurement.date, "data medida");
    number(measurement.weightKg, "peso", 20, 500, true);
    number(measurement.bodyFat, "percentual de gordura", 1, 75, true);
    for (const key of [
      "waistCm",
      "hipCm",
      "armCm",
      "chestCm",
      "thighCm",
      "calfCm",
    ])
      number(measurement[key], key, 1, 400, true);
    text(measurement.method, "método", 200);
    text(measurement.notes, "observações medidas");
    if (measurement.bodyFat !== null && !String(measurement.method).trim())
      fail("informe o método do percentual estimado");
  }
  const favorites = list(state.favorites, "favoritos", 5000);
  if (new Set(favorites).size !== favorites.length)
    fail("favoritos duplicados");
  favorites.forEach((id) => text(id, "favorito", 1000, true));
  const templates = list(state.templates, "modelos", 200);
  unique(templates, "id", "modelos");
  for (const raw of templates) {
    const model = object(raw, "modelo");
    text(model.name, "nome modelo", 120, true);
    list(model.entries, "itens do modelo", 200).forEach((item) =>
      entry(item, true),
    );
  }
  const checks = list(state.checklist, "checklist", 100);
  unique(checks, "id", "checklist");
  for (const raw of checks) {
    const check = object(raw, "checklist");
    text(check.text, "item checklist", 500, true);
    bool(check.done, "concluído checklist");
  }
  return value as NutritionState;
}
