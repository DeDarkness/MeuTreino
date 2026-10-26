export type Nutrients = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
};
export type FoodConfidence =
  | "approximation"
  | "label"
  | "tbca"
  | "usda"
  | "recipe";
export type Food = {
  id: string;
  name: string;
  group: string;
  unit: "g" | "ml";
  preparation: string;
  source: string;
  confidence: FoodConfidence;
  verifiedAt: string | null;
  per100: Nutrients;
  portionSize: number | null;
  brand?: string;
};
export type NutritionGoals = {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  waterMl: number | null;
  validated: boolean;
  professionalNote: string;
};
export type NutritionProfile = {
  age: number | null;
  sex: "male" | "female" | null;
  heightCm: number | null;
  referenceWeightKg: number | null;
  targetWeightKg: number | null;
  estimatedBodyFat: number | null;
  activityFactor: number | null;
  surgeryDate: string | null;
  stabilityDays: number | null;
  stabilityToleranceKg: number | null;
  medicalNotes: string;
  clearanceNote: string;
  preferredKcalMin: number | null;
  preferredKcalMax: number | null;
};
export type MealEntry = {
  id: string;
  date: string;
  meal: string;
  time: string;
  quantity: number;
  food: Food;
  kind: "planned" | "consumed";
  order: number;
  planEntryId?: string;
};
export type NutritionDay = {
  date: string;
  waterMl: number;
  sleepHours: number | null;
  hunger: number | null;
  energy: number | null;
  fatigue: number | null;
  recovery: number | null;
  notes: string;
  complete: boolean;
  goals: NutritionGoals;
};
export type BodyMeasurement = {
  id: string;
  date: string;
  weightKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
  armCm: number | null;
  chestCm: number | null;
  thighCm: number | null;
  calfCm: number | null;
  bodyFat: number | null;
  method: string;
  notes: string;
};
export type MealTemplate = {
  id: string;
  name: string;
  entries: Omit<MealEntry, "id" | "date" | "planEntryId">[];
};
export type NutritionState = {
  version: 1;
  profile: NutritionProfile;
  goals: NutritionGoals;
  foods: Food[];
  entries: MealEntry[];
  days: NutritionDay[];
  measurements: BodyMeasurement[];
  favorites: string[];
  templates: MealTemplate[];
  checklist: { id: string; text: string; done: boolean }[];
};
