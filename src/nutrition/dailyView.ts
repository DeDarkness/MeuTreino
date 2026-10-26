import type { Food, MealEntry, NutritionState } from "./types";
import {
  consumePlannedEntry,
  ensureNutritionDay,
  localDate,
  offsetDate,
  saveMealEntry,
  totalNutrients,
  validDate,
} from "./engine";
import {
  STARTER_DIET_LIMIT,
  STARTER_DIET_MEALS,
  starterDietEntries,
} from "./starterDiet";

export type DailyFoodRow = {
  entry: MealEntry;
  plannedId?: string;
  checked: boolean;
};
export function dailyMealRows(
  state: NutritionState,
  date: string,
  meal: string,
  mode: "diary" | "plan" = "diary",
): DailyFoodRow[] {
  const planned = state.entries
    .filter(
      (entry) =>
        entry.date === date && entry.meal === meal && entry.kind === "planned",
    )
    .sort((a, b) => a.order - b.order);
  const actual = state.entries
    .filter(
      (entry) =>
        entry.date === date && entry.meal === meal && entry.kind === "consumed",
    )
    .sort((a, b) => a.order - b.order);
  if (mode === "plan")
    return planned.map((entry) => ({
      entry,
      plannedId: entry.id,
      checked: actual.some((record) => record.planEntryId === entry.id),
    }));
  const linked = new Set<string>();
  const rows = planned.map((entry) => {
    const eaten = actual.find((record) => record.planEntryId === entry.id);
    if (eaten) linked.add(eaten.id);
    return {
      entry: eaten ?? entry,
      plannedId: entry.id,
      checked: Boolean(eaten),
    };
  });
  return [
    ...rows,
    ...actual
      .filter((entry) => !linked.has(entry.id))
      .map((entry) => ({ entry, checked: true })),
  ];
}
export function setPlannedConsumption(
  state: NutritionState,
  id: string,
  checked: boolean,
) {
  const planned = state.entries.find(
    (entry) => entry.id === id && entry.kind === "planned",
  );
  if (!planned)
    throw new Error(
      "Este item planejado não está mais disponível. Reabra a refeição.",
    );
  if (planned.date > localDate())
    throw new Error(
      "Você pode planejar o futuro, mas registrar consumo só no dia ou depois.",
    );
  const existing = state.entries.filter(
    (entry) => entry.kind === "consumed" && entry.planEntryId === id,
  );
  if (checked) return existing.length ? state : consumePlannedEntry(state, id);
  return {
    ...state,
    entries: state.entries.filter(
      (entry) => !existing.some((record) => record.id === entry.id),
    ),
  };
}
export function setMealConsumption(
  state: NutritionState,
  date: string,
  meal: string,
  checked: boolean,
) {
  const planned = state.entries.filter(
    (entry) =>
      entry.date === date && entry.meal === meal && entry.kind === "planned",
  );
  if (!planned.length)
    throw new Error("Ative um plano para esta refeição primeiro.");
  let next = state;
  for (const entry of planned)
    next = setPlannedConsumption(next, entry.id, checked);
  return next;
}
export function updateWater(
  state: NutritionState,
  date: string,
  delta: number,
) {
  if (!validDate(date) || date > localDate())
    throw new Error("Registre água em hoje ou num dia passado.");
  if (!Number.isFinite(delta)) throw new Error("Quantidade de água inválida.");
  const next = ensureNutritionDay(state, date);
  const current = next.days.find((day) => day.date === date)!;
  const amount = current.waterMl + delta;
  if (amount < 0 || amount > 30000)
    throw new Error("Água fora do intervalo permitido.");
  return {
    ...next,
    days: next.days.map((day) =>
      day.date === date ? { ...day, waterMl: amount } : day,
    ),
  };
}
export function replacePresetMeal(
  state: NutritionState,
  date: string,
  meal: string,
  option: number,
  catalog: Food[],
) {
  const index = STARTER_DIET_MEALS.findIndex((item) => item.meal === meal);
  if (index < 0)
    throw new Error(
      "Esta refeição não tem opções prontas. Edite os alimentos individualmente.",
    );
  if (!validDate(date) || date < localDate())
    throw new Error(
      "Troque o planejamento de hoje ou de um dia futuro; o passado fica preservado.",
    );
  const choices = STARTER_DIET_MEALS.map(() => 0);
  choices[index] = option;
  const added = starterDietEntries(date, choices, catalog).filter(
    (entry) => entry.meal === meal,
  );
  const remaining = state.entries.filter(
    (entry) =>
      !(entry.kind === "planned" && entry.date === date && entry.meal === meal),
  );
  const dayPlan = [
    ...remaining.filter(
      (entry) => entry.date === date && entry.kind === "planned",
    ),
    ...added,
  ];
  if (totalNutrients(dayPlan).kcal > STARTER_DIET_LIMIT)
    throw new Error(
      "A troca passa de 1.700 kcal no plano. Escolha outra opção ou revise as quantidades.",
    );
  let next = { ...state, entries: remaining };
  for (const entry of added) next = saveMealEntry(next, entry);
  return next;
}
export function weekDates(date: string) {
  const day = new Date(`${date}T12:00:00`).getDay();
  const monday = offsetDate(date, -((day + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => offsetDate(monday, index));
}
export function shortFoodName(name: string) {
  return name
    .replace(/\s*\(ml\)|\s*\(genérico\)|\s*EM PO|\s*\(sem casca\)/gi, "")
    .replace("Banana prata/nanica media (parte comestivel)", "Banana")
    .replace("Ovo inteiro cozido", "Ovos")
    .replace("Goma de tapioca hidratada", "Goma de tapioca")
    .replace("Peito de frango cozido sem pele", "Frango cozido")
    .replace("Carne moída bovina magra cozida", "Carne moída magra")
    .replace("Arroz branco cozido sem óleo", "Arroz branco")
    .replace("Batata inglesa cozida sem óleo", "Batata inglesa")
    .replace("Whey protein concentrado", "Whey protein")
    .replace("Aveia em flocos secos", "Aveia")
    .replace("Feijão carioca cozido com caldo", "Feijão carioca")
    .replace("Requeijao", "Requeijão")
    .replace(/ cozid[oa] sem óleo/g, "")
    .replace("Brocolis", "Brócolis")
    .replace("Macarrão comum cozido sem molho", "Macarrão")
    .trim();
}
