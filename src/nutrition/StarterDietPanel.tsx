import { useState } from "react";
import {
  ActionDialog,
  type ActionConfirmation,
} from "../components/ActionDialog";
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
  const [confirmation, setConfirmation] = useState<ActionConfirmation | null>(
    null,
  );
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
  const confirmReplace = (days: 1 | 7) =>
    setConfirmation({
      title:
        days === 1
          ? "Atualizar o plano deste dia?"
          : "Atualizar os próximos sete dias?",
      message: `De ${dateLabel(date)} a ${dateLabel(offsetDate(date, days - 1))}: substituir somente os itens planejados pelas opções escolhidas aqui. Alimentos já consumidos, medidas, treinos e dias anteriores serão preservados. Uma cópia anterior fica nos Ajustes. Não registre novamente o que já consumiu.`,
      confirmLabel: "Confirmar atualização do plano",
      onConfirm: async () => {
        await change(
          (current) =>
            applyStarterDiet(
              current,
              date,
              days,
              choices,
              setGoal,
              catalog,
              "replace",
            ),
          "Antes de atualizar o cardápio planejado",
        );
        setResult(
          `Planejamento atualizado em ${days} dia(s); consumo e histórico preservados.`,
        );
      },
    });
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
                {entries
                  .filter((entry) => !entry.preparationOnly)
                  .map((entry) => (
                    <li key={entry.food.id}>
                      {display(entry.quantity, 1)} {entry.food.unit} ·{" "}
                      {entry.food.name}
                    </li>
                  ))}
              </ul>
              {entries.some((entry) => entry.preparationOnly) ? (
                <details className="nutrition-preparation">
                  <summary>
                    Preparo incluído ·{" "}
                    {display(
                      totalNutrients(
                        entries.filter((entry) => entry.preparationOnly),
                      ).kcal,
                    )}{" "}
                    kcal
                  </summary>
                  <p className="elite-caption">
                    Referência aproximada de temperos e óleo usada no cálculo,
                    não uma medição da sua panela. Pode ajustar os itens após
                    aplicar o plano.
                  </p>
                  <ul>
                    {entries
                      .filter((entry) => entry.preparationOnly)
                      .map((entry) => (
                        <li key={entry.food.id}>
                          {display(entry.quantity)} {entry.food.unit} ·{" "}
                          {entry.food.name}
                        </li>
                      ))}
                  </ul>
                </details>
              ) : null}
              <p className="elite-caption">
                {options[choices[index]].preparation}
              </p>
            </section>
          );
        })}
        <p className="elite-caption">
          Temperos ficam no preparo, não como acompanhamentos. A referência de
          óleo e temperos continua contada em “Preparo incluído”; ela não mede
          sua receita caseira. Ajuste ao que realmente usa e não conte o óleo
          duas vezes. Fibras não disponíveis na tabela: adequação não avaliada.
        </p>
        <p className="nutrition-warning">
          Frango cozido: pese a carne sem osso/pele, sem o caldo. Pode servir
          com caldo ou escorrido, mas o peso do caldo não substitui o peso da
          carne. A composição do caldo depende da receita e do óleo; não é
          automaticamente zero kcal. Registre a porção/receita real quando
          disponível. Tirar o caldo não gera um desconto automático.
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
        {hasPlan ? (
          <button
            className="button button-secondary"
            type="button"
            disabled={above || past}
            onClick={() => confirmReplace(1)}
          >
            Atualizar plano deste dia
          </button>
        ) : null}
        {state.entries.some(
          (entry) =>
            entry.kind === "planned" &&
            entry.date >= date &&
            entry.date <= offsetDate(date, 6),
        ) ? (
          <button
            className="button button-secondary"
            type="button"
            disabled={above || past}
            onClick={() => confirmReplace(7)}
          >
            Atualizar próximos 7 dias
          </button>
        ) : null}
      </div>
      <p className="elite-caption">
        Começa na data selecionada. Preencher preserva dias já planejados;
        Atualizar substitui somente o planejamento do intervalo após
        confirmação. Consumo, medidas e treinos são preservados. Planejado não
        significa comido.
      </p>
      {result ? <p role="status">{result}</p> : null}
      {confirmation ? (
        <ActionDialog
          action={confirmation}
          onClose={() => setConfirmation(null)}
        />
      ) : null}
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
