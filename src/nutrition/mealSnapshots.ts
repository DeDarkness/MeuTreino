import { localDate, nutritionId, saveMealEntry } from './engine';
import type { MealEntry, MealTemplate, NutritionState } from './types';

export type MealSnapshot = MealTemplate['entries'];

export function mealSnapshot(entries: readonly MealEntry[]): MealSnapshot {
  return entries.map((entry) => ({
    meal: entry.meal, time: entry.time, quantity: entry.quantity, food: structuredClone(entry.food),
    kind: entry.kind, order: entry.order, preparationOnly: entry.preparationOnly,
  }));
}

export function recentConsumedMeals(entries: readonly MealEntry[], through: string, limit = 12) {
  const meals = new Map<string, { date: string; meal: string; entries: MealEntry[] }>();
  for (const entry of entries) {
    if (entry.kind !== 'consumed' || entry.date > through) continue;
    const key = JSON.stringify([entry.date, entry.meal]);
    const group = meals.get(key) ?? { date: entry.date, meal: entry.meal, entries: [] };
    group.entries.push(entry);
    meals.set(key, group);
  }
  return [...meals].sort(([, a], [, b]) => b.date.localeCompare(a.date)).slice(0, limit).map(([id, meal]) => ({ id, ...meal }));
}

export function addMealSnapshot(state: NutritionState, source: MealSnapshot, date: string, kind: MealEntry['kind']) {
  if (!source.length) throw new Error('A refeição não tem alimentos.');
  if (kind === 'consumed' && date > localDate()) throw new Error('Consumo futuro não pode ser registrado.');
  return source.reduce((current, entry) => saveMealEntry(current, { ...entry, id: nutritionId(), date, kind }), state);
}
