import { useState } from "react";
import { Search, Star } from "lucide-react";
import type { ActionConfirmation } from "../components/ActionDialog";
import type { Food, NutritionState } from "./types";
import { CONFIDENCE, nutritionId } from "./engine";
import {
  numberValue,
  stringValue,
  normalized,
  display,
  type Update,
} from "./uiHelpers";
import { Field, SaveButton, LocalForm } from "./FormControls";

export function CatalogEditor({
  catalog,
  state,
  change,
  confirm,
}: {
  catalog: Food[];
  state: NutritionState;
  change: Update;
  confirm: (action: ActionConfirmation) => void;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Food | null>(null);
  const [show, setShow] = useState(false);
  const choices = catalog.filter((food) =>
    normalized(`${food.name} ${food.group}`).includes(normalized(query)),
  );
  return (
    <>
      <article className="nutrition-card">
        <div className="nutrition-heading">
          <div>
            <span className="eyebrow">CATÁLOGO COM ORIGEM</span>
            <h2>{catalog.length} alimentos</h2>
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              setEditing(null);
              setShow(!show);
            }}
          >
            Cadastrar alimento
          </button>
        </div>
        <p className="elite-caption">
          Cru, cozido e unidades não são intercambiáveis. Consulte o rótulo
          específico e registre fonte e data. Corrigir o catálogo não reescreve
          refeições anteriores.
        </p>
        <label className="nutrition-search">
          <Search size={18} />
          <input
            aria-label="Buscar no catálogo alimentar"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome ou grupo…"
          />
        </label>
        <div className="nutrition-catalog-list">
          {choices.slice(0, 50).map((food) => (
            <div className="nutrition-entry" key={food.id}>
              <strong>{food.name}</strong>
              <small>
                {food.group} · por 100 {food.unit} · {display(food.per100.kcal)}{" "}
                kcal
              </small>
              <small>{CONFIDENCE[food.confidence]}</small>
              <div className="nutrition-entry-actions">
                <button
                  type="button"
                  aria-label={`${state.favorites.includes(food.id) ? "Desfavoritar" : "Favoritar"} ${food.name}`}
                  onClick={() =>
                    void change((current) => ({
                      ...current,
                      favorites: current.favorites.includes(food.id)
                        ? current.favorites.filter((id) => id !== food.id)
                        : [...current.favorites, food.id],
                    })).catch(() => undefined)
                  }
                >
                  <Star
                    size={16}
                    fill={
                      state.favorites.includes(food.id)
                        ? "currentColor"
                        : "none"
                    }
                  />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(food);
                    setShow(true);
                  }}
                >
                  Conferir / editar fonte
                </button>
                {state.foods.some((custom) => custom.id === food.id) ? (
                  <button
                    type="button"
                    onClick={() =>
                      confirm({
                        title: "Remover cadastro local?",
                        message:
                          "O histórico mantém seus valores. Se for uma referência do catálogo incluído, a versão aproximada original voltará a aparecer.",
                        confirmLabel: "Remover cadastro",
                        onConfirm: () =>
                          change((current) => ({
                            ...current,
                            foods: current.foods.filter(
                              (item) => item.id !== food.id,
                            ),
                            favorites: current.favorites.filter(
                              (id) => id !== food.id,
                            ),
                          })),
                      })
                    }
                  >
                    Remover cadastro local
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {choices.length > 50 ? (
          <p className="elite-caption">
            Exibindo 50 de {choices.length}. Refine a busca para encontrar os
            demais.
          </p>
        ) : null}
      </article>
      {show ? (
        <article className="nutrition-card">
          <h2>{editing ? "Conferir alimento" : "Novo alimento"}</h2>
          <LocalForm
            key={editing?.id ?? "new"}
            onSave={async (data) => {
              const food: Food = {
                id: editing?.id ?? nutritionId(),
                name: stringValue(data, "name"),
                group: stringValue(data, "group"),
                unit: stringValue(data, "unit") as Food["unit"],
                preparation: stringValue(data, "preparation"),
                source: stringValue(data, "source"),
                confidence: stringValue(
                  data,
                  "confidence",
                ) as Food["confidence"],
                verifiedAt: stringValue(data, "verifiedAt") || null,
                portionSize: numberValue(data, "portionSize"),
                brand: stringValue(data, "brand"),
                per100: {
                  kcal: numberValue(data, "kcal") ?? NaN,
                  protein: numberValue(data, "protein") ?? NaN,
                  carbs: numberValue(data, "carbs") ?? NaN,
                  fat: numberValue(data, "fat") ?? NaN,
                  fiber: numberValue(data, "fiber"),
                },
              };
              await change((current) => ({
                ...current,
                foods: [
                  ...current.foods.filter((item) => item.id !== food.id),
                  food,
                ],
              }));
              setShow(false);
            }}
          >
            <Field
              label="Nome"
              name="name"
              type="text"
              required
              value={editing?.name}
              maxLength={180}
            />
            <Field
              label="Grupo alimentar"
              name="group"
              type="text"
              required
              value={editing?.group}
              maxLength={120}
            />
            <Field
              label="Estado de preparo (cru, cozido, drenado…)"
              name="preparation"
              type="text"
              required
              value={editing?.preparation}
              maxLength={500}
            />
            <div className="nutrition-form-grid">
              <label>
                Referência
                <select name="unit" defaultValue={editing?.unit ?? "g"}>
                  <option value="g">Por 100 g</option>
                  <option value="ml">Por 100 ml</option>
                </select>
              </label>
              <Field
                label="Porção em g/ml (opcional)"
                name="portionSize"
                value={editing?.portionSize}
                min={0.01}
              />
              {(
                [
                  ["kcal", "Calorias"],
                  ["protein", "Proteína (g)"],
                  ["carbs", "Carboidratos (g)"],
                  ["fat", "Gorduras (g)"],
                  ["fiber", "Fibras (g), se conhecidas"],
                ] as const
              ).map(([key, label]) => (
                <Field
                  label={label}
                  key={key}
                  name={key}
                  value={editing?.per100[key]}
                  required={key !== "fiber"}
                  max={key === "kcal" ? 10000 : 150}
                />
              ))}
            </div>
            <Field
              label="Marca / produto específico"
              name="brand"
              type="text"
              value={editing?.brand}
            />
            <Field
              label="Fonte, URL ou identificação exata do rótulo"
              name="source"
              type="textarea"
              required
              value={editing?.source}
            />
            <label>
              Origem informada
              <select
                name="confidence"
                defaultValue={editing?.confidence ?? "approximation"}
              >
                <option value="approximation">Estimativa não verificada</option>
                <option value="label">Rótulo conferido por mim</option>
                <option value="tbca">TBCA: ficha conferida por mim</option>
                <option value="usda">USDA: ficha conferida por mim</option>
              </select>
            </label>
            <Field
              label="Data de conferência (obrigatória para fontes conferidas)"
              name="verifiedAt"
              type="date"
              value={editing?.verifiedAt}
            />
            <p className="elite-caption">
              Energia declarada é preservada. Ela pode diferir de 4P+4C+9G por
              fibras, fatores específicos e arredondamentos.
            </p>
            <SaveButton label="Salvar alimento e fonte" />
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setShow(false)}
            >
              Cancelar cadastro
            </button>
          </LocalForm>
        </article>
      ) : null}
    </>
  );
}
