import { useState } from "react";
import type { Food, NutritionState } from "./types";
import type { Update } from "./uiHelpers";
import { dateLabel, display } from "./uiHelpers";
import { localDate, offsetDate, totalNutrients } from "./engine";
import {
  applyStarterDiet,
  STARTER_DIET_LIMIT,
  STARTER_DIET_MEALS,
  starterDietEntries,
  starterDietText,
} from "./starterDiet";

export function StarterDietPanel({
  state,
  date,
  catalog,
  change,
}: {
  state: NutritionState;
  date: string;
  catalog: Food[];
  change: Update;
}) {
  const [choices, setChoices] = useState(STARTER_DIET_MEALS.map(() => 0));
  const [setGoal, setSetGoal] = useState(state.goals.kcal === null);
  const [result, setResult] = useState("");
  const preview = starterDietEntries(date, choices, catalog);
  const total = totalNutrients(preview);
  const above = total.kcal > STARTER_DIET_LIMIT;
  const past = date < localDate();
  const hasPlan = state.entries.some(
    (entry) => entry.date === date && entry.kind === "planned",
  );
  const exportText = () => {
    const url = URL.createObjectURL(
      new Blob([starterDietText(date, choices, catalog)], {
        type: "text/plain;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "MeuTreino - Dieta e substituicoes.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const apply = async (days: 1 | 7) => {
    try {
      const dates = Array.from({ length: days }, (_, index) =>
        offsetDate(date, index),
      );
      const count = dates.filter(
        (day) =>
          !state.entries.some(
            (entry) => entry.date === day && entry.kind === "planned",
          ),
      ).length;
      await change(
        (current) =>
          applyStarterDiet(current, date, days, choices, setGoal, catalog),
        "Antes de aplicar cardápio pronto",
      );
      setResult(
        `Cardápio salvo como planejamento em ${count} dia(s). Dias já planejados foram preservados. Nada foi marcado como consumido.`,
      );
    } catch (cause) {
      setResult(
        cause instanceof Error ? cause.message : "Não foi possível aplicar.",
      );
    }
  };
  return (
    <article className="nutrition-card starter-diet">
      <span className="eyebrow">CARDÁPIO PRONTO · TROCAS POR REFEIÇÃO</span>
      <h2>Sua base de até 1.700 kcal</h2>
      <p>
        Crepioca, sanduíche, comida de verdade e opções com whey. Porções
        editáveis, sem horários obrigatórios: o lanche pode acompanhar seu
        horário de treino.
      </p>
      <div className="nutrition-mini-grid">
        <div>
          <span>Total estimado</span>
          <b>{display(total.kcal, 0)} kcal</b>
        </div>
        <div>
          <span>Proteína</span>
          <b>{display(total.protein, 0)} g</b>
        </div>
        <div>
          <span>Carboidratos</span>
          <b>{display(total.carbs, 0)} g</b>
        </div>
        <div>
          <span>Gorduras</span>
          <b>{display(total.fat, 0)} g</b>
        </div>
      </div>
      <p className="nutrition-warning">
        Modelo inicial com teto escolhido por você, não prescrição validada. As
        quantidades e o total usam estimativas; marcas, gordura da carne,
        preparo e rótulos alteram o resultado. 1.700 kcal não é uma necessidade
        universal nem garantia de adequação nutricional. Não reduza mais por
        conta própria para compensar refeições.
      </p>
      <details open={!hasPlan}>
        <summary>Ver refeições prontas e escolher substituições</summary>
        {STARTER_DIET_MEALS.map(({ meal, options }, index) => {
          const entries = preview.filter((entry) => entry.meal === meal);
          return (
            <section className="starter-diet-meal" key={meal}>
              <h3>
                {meal} · {display(totalNutrients(entries).kcal, 0)} kcal
              </h3>
              <label>
                Opção de {meal.toLocaleLowerCase("pt-BR")}
                <select
                  aria-label={`Opção de ${meal.toLocaleLowerCase("pt-BR")}`}
                  value={choices[index]}
                  onChange={(event) =>
                    setChoices((current) =>
                      current.map((choice, at) =>
                        at === index ? Number(event.target.value) : choice,
                      ),
                    )
                  }
                >
                  {options.map((option, at) => (
                    <option value={at} key={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <ul>
                {entries.map((entry) => (
                  <li key={entry.food.id}>
                    {display(entry.quantity, 1)} {entry.food.unit} ·{" "}
                    {entry.food.name}
                  </li>
                ))}
              </ul>
              <p className="elite-caption">
                {options[choices[index]].preparation}
              </p>
            </section>
          );
        })}
        <p className="elite-caption">
          Aromáticos nas refeições principais: 30 g de cebola, 50 g de pimentão
          e 3 g de alho por porção, já contados. Azeite: 3 ml no almoço + 3 ml
          no jantar. Páprica, molhos e qualquer óleo extra devem ser registrados
          pelo rótulo; não são considerados calorias livres. Fibras não
          disponíveis na tabela: adequação não avaliada.
        </p>
        <p className="elite-caption">
          Whey e iogurte usam referências genéricas; confira suas embalagens em
          Alimentos. As opções prontas recalculam o dia inteiro. Para outras
          trocas, use Substituir nos itens do plano e confira o novo total.
        </p>
      </details>
      <label className="starter-diet-check">
        <input
          type="checkbox"
          checked={setGoal}
          onChange={(event) => setSetGoal(event.target.checked)}
        />
        Definir também 1.700 kcal como minha meta informada, sem validação
        profissional. Isso altera a meta atual; metas já gravadas em outros dias
        não são reescritas.
      </label>
      {above ? (
        <p role="alert" className="nutrition-warning">
          A combinação atual soma {display(total.kcal)} kcal e ultrapassa o
          teto. Confira as referências e escolha outra opção.
        </p>
      ) : null}
      {past ? <p>Selecione hoje ou um dia futuro para aplicar.</p> : null}
      <div className="nutrition-entry-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={exportText}
        >
          Baixar dieta e trocas em TXT
        </button>
        <button
          className="button button-primary"
          type="button"
          disabled={above || past || hasPlan}
          onClick={() => void apply(1)}
        >
          Aplicar em {dateLabel(date)}
        </button>
        <button
          className="button button-secondary"
          type="button"
          disabled={above || past}
          onClick={() => void apply(7)}
        >
          Preencher 7 dias vazios
        </button>
      </div>
      <p className="elite-caption">
        Começa na data selecionada. Não apaga dias planejados, consumo, medidas
        nem treinos. Planejado não significa comido.
      </p>
      {result ? <p role="status">{result}</p> : null}
      <p className="elite-caption">
        <a
          href="https://www.gov.br/saude/pt-br/assuntos/saude-brasil/publicacoes-para-promocao-a-saude/guia_alimentar_populacao_brasileira_2ed.pdf"
          target="_blank"
          rel="noreferrer"
        >
          Guia Alimentar do Ministério da Saúde
        </a>{" "}
        ·{" "}
        <a
          href="https://www.facs.org/for-patients/preparing-for-surgery/how-nutrition-can-support-your-surgery/"
          target="_blank"
          rel="noreferrer"
        >
          Nutrição e preparo cirúrgico: ACS
        </a>
        . Essas fontes orientam princípios gerais; não validam este cardápio nem
        a meta de 1.700 kcal.
      </p>
    </article>
  );
}
