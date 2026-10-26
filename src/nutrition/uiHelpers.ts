import type { NutritionState } from "./types";

export type Update = (
  change: (current: NutritionState) => NutritionState,
  checkpoint?: string,
) => Promise<void>;
export const numberValue = (data: FormData, key: string) => {
  const value = String(data.get(key) ?? "").trim();
  return value === "" ? null : Number(value.replace(",", "."));
};
export const stringValue = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
export const display = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined
    ? "—"
    : value.toLocaleString("pt-BR", { maximumFractionDigits: digits });
export const dateLabel = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
export const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
