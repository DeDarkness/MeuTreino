import { ELITE_FOODS } from "./catalog";
import {
  localDate,
  nutritionId,
  offsetDate,
  saveMealEntry,
  totalNutrients,
  validDate,
} from "./engine";
import type { Food, MealEntry, NutritionState } from "./types";

export const STARTER_DIET_LIMIT = 1700;
type Ingredient = readonly [name: string, quantity: number];
type MealOption = {
  name: string;
  ingredients: readonly Ingredient[];
  preparation: string;
};
const chicken = "Peito de frango cozido sem pele";
const eggs = "Ovo inteiro cozido (sem casca)";
const banana = "Banana prata/nanica media (parte comestivel)";
const bread = "Pão de forma integral";
const rice = "Arroz branco cozido sem óleo";
const mince = "Carne moída bovina magra cozida";
const cheese = "Muçarela light";
const pasta = "Macarrão comum cozido sem molho";
const potato = "Batata inglesa cozida sem óleo";
const broccoli = "Brocolis cozido sem óleo";
const zucchini = "Abobrinha cozida sem óleo";
const tapioca = "Goma de tapioca hidratada";
const yogurt = "Iogurte natural desnatado";
const whey = "Whey protein concentrado EM PO (genérico)";
const olive = "Azeite de oliva (ml)";
const aromatics: readonly Ingredient[] = [
  ["Cebola crua", 30],
  ["Pimentao cru", 50],
  ["Alho cru", 3],
];
const hot = (ingredients: readonly Ingredient[]): readonly Ingredient[] => [
  ...ingredients,
  ...aromatics,
  [olive, 3],
];

export const STARTER_DIET_MEALS: { meal: string; options: MealOption[] }[] = [
  {
    meal: "Café da manhã",
    options: [
      {
        name: "Crepioca com queijo + banana e 15 g de whey",
        ingredients: [
          [tapioca, 20],
          [eggs, 100],
          [cheese, 25],
          [banana, 60],
          [whey, 15],
        ],
        preparation:
          "Crepioca: 20 g de goma hidratada, cerca de 2 ovos (100 g sem casca) e 25 g de muçarela light. À parte: 60 g de banana e 15 g de whey em pó com água. Frigideira antiaderente, sem óleo extra. Os ovos do catálogo são referência aproximada para o preparo sem óleo; confira o rótulo do queijo e do whey.",
      },
      {
        name: "Sanduíche de ovos e queijo + banana",
        ingredients: [
          [bread, 40],
          [eggs, 100],
          [cheese, 25],
          [banana, 50],
        ],
        preparation:
          "40 g de pão integral, cerca de 2 ovos (100 g sem casca), 25 g de muçarela light e 50 g de banana sem casca. Sem frango, manteiga ou maionese. Esta opção não tem whey no café; as proteínas diferem entre as trocas.",
      },
      {
        name: "Omelete com queijo + kiwi e 15 g de whey",
        ingredients: [
          [eggs, 100],
          [cheese, 30],
          ["Kiwi", 100],
          [whey, 15],
        ],
        preparation:
          "Omelete com cerca de 2 ovos (100 g sem casca) e 30 g de muçarela light. À parte: 100 g de kiwi sem casca e 15 g de whey em pó com água. Sem frango nem óleo extra; valores dos ovos são aproximados.",
      },
      {
        name: "Panqueca de aveia, ovos, whey e banana",
        ingredients: [
          ["Aveia em flocos secos", 30],
          [eggs, 100],
          [whey, 15],
          [banana, 60],
        ],
        preparation:
          "Triture 30 g de aveia pura, misture com cerca de 2 ovos (100 g sem casca), 15 g de whey em pó e 60 g de banana amassada. Use frigideira antiaderente, sem óleo extra. Se usar farinha de aveia comprada, confira e cadastre o rótulo; a referência é aveia pura, não mistura adoçada. Ovos do catálogo são aproximação para o preparo sem óleo.",
      },
      {
        name: "Crepioca com muçarela tradicional + banana e whey",
        ingredients: [
          [tapioca, 20],
          [eggs, 100],
          ["Muçarela tradicional", 25],
          [banana, 60],
          [whey, 15],
        ],
        preparation:
          "Mesma crepioca-base, mas com 25 g de muçarela tradicional, não light. Banana e 15 g de whey com água à parte. As calorias e os macros são recalculados; confira o rótulo da sua marca.",
      },
      {
        name: "Pão com ovo e requeijão + leite, whey e banana",
        ingredients: [
          [bread, 40],
          [eggs, 50],
          ["Requeijao light", 15],
          ["Leite desnatado (ml)", 150],
          [whey, 15],
          [banana, 60],
        ],
        preparation:
          "40 g de pão integral, cerca de 1 ovo (50 g sem casca), 15 g de requeijão light e 60 g de banana. Misture 15 g de whey em pó nos 150 ml de leite desnatado já contabilizados, sem acrescentar mais leite. O leite substitui a água desta opção, não é um extra livre. Sem manteiga ou açúcar não registrados.",
      },
      {
        name: "Sanduíche com requeijão tradicional + leite integral",
        ingredients: [
          [bread, 40],
          [eggs, 100],
          ["Requeijao tradicional", 15],
          ["Leite integral (ml)", 150],
        ],
        preparation:
          "40 g de pão integral, cerca de 2 ovos (100 g sem casca), 15 g de requeijão tradicional e 150 ml de leite integral. Esta opção não tem whey no café nem fruta adicional contabilizada. O leite integral e o requeijão tradicional já entram no total; não troque por quantidades maiores sem recalcular.",
      },
      {
        name: "Pão, ovos e requeijão + leite semidesnatado",
        ingredients: [
          [bread, 50],
          [eggs, 100],
          ["Requeijao light", 15],
          ["Leite semidesnatado (ml)", 150],
        ],
        preparation:
          "50 g de pão integral, cerca de 2 ovos (100 g sem casca), 15 g de requeijão light e 150 ml de leite semidesnatado. Sem whey nesta opção. Confira as embalagens e não acrescente manteiga, açúcar ou mais leite sem registrar.",
      },
    ],
  },
  {
    meal: "Almoço",
    options: [
      {
        name: "Arroz, feijão e frango temperado",
        ingredients: hot([
          [rice, 100],
          ["Feijão carioca cozido com caldo", 100],
          [chicken, 150],
          [broccoli, 100],
        ]),
        preparation:
          "Arroz, feijão e legumes pesados prontos. Frango: 150 g da carne cozida, sem osso/pele, pesada sem o caldo. Use seus temperos no cozimento; a referência de preparo fica agrupada e pode ser ajustada. O óleo do preparo já está contado na referência, não acrescente outra vez.",
      },
      {
        name: "Macarrão com frango e legumes",
        ingredients: hot([
          [pasta, 140],
          [chicken, 150],
          [zucchini, 150],
        ]),
        preparation:
          "Macarrão e legumes cozidos; 150 g da carne de frango cozida sem o caldo. Tempere durante o cozimento. Preparo agrupado inclui uma referência de temperos e óleo; molhos e queijo extras devem ser registrados.",
      },
      {
        name: "Batata com carne moída magra",
        ingredients: hot([
          [potato, 210],
          [mince, 140],
          [broccoli, 100],
        ]),
        preparation:
          "Batata, carne moída magra e legumes pesados prontos. Tempere como de costume; a referência de temperos e óleo está agrupada em Preparo incluído. O teor de gordura da carne muda os valores.",
      },
    ],
  },
  {
    meal: "Lanche da tarde",
    options: [
      {
        name: "Iogurte com 15 g de whey, aveia e manga",
        ingredients: [
          [yogurt, 170],
          [whey, 15],
          ["Aveia em flocos secos", 15],
          ["Manga", 100],
        ],
        preparation:
          "170 g de iogurte natural desnatado, 15 g de whey em pó, 15 g de aveia pura (pode triturar) e 100 g de polpa de manga. Sem frango. Confira os rótulos; whey é peso do pó, não proteína pura.",
      },
      {
        name: "Sanduíche de ovo e queijo",
        ingredients: [
          [bread, 40],
          [eggs, 50],
          [cheese, 25],
          ["Tomate cru", 50],
        ],
        preparation:
          "40 g de pão integral, cerca de 1 ovo (50 g sem casca), 25 g de muçarela light e 50 g de tomate. Sem frango, óleo ou molhos extras. Esta opção não usa whey no lanche.",
      },
      {
        name: "Iogurte com whey e kiwi",
        ingredients: [
          [yogurt, 170],
          [whey, 15],
          ["Aveia em flocos secos", 10],
          ["Kiwi", 110],
        ],
        preparation:
          "170 g de iogurte desnatado, 15 g de whey em pó, 10 g de aveia pura e 110 g de kiwi sem casca. Confira os rótulos das suas marcas.",
      },
      {
        name: "Iogurte com whey e banana",
        ingredients: [
          [yogurt, 170],
          [whey, 15],
          ["Aveia em flocos secos", 10],
          [banana, 70],
        ],
        preparation:
          "170 g de iogurte desnatado, 15 g de whey em pó, 10 g de aveia pura e 70 g de banana sem casca. Sem mel, açúcar ou granola não registrados.",
      },
      {
        name: "Tigela de iogurte, aveia, whey e banana",
        ingredients: [
          [yogurt, 170],
          ["Aveia em flocos secos", 15],
          [whey, 15],
          [banana, 65],
        ],
        preparation:
          "Misture 170 g de iogurte desnatado, 15 g de aveia pura, 15 g de whey em pó e 65 g de banana sem casca. Pode hidratar na geladeira; não acrescente mel, leite ou granola sem registrar. Confira o rótulo se usar farinha de aveia comprada.",
      },
      {
        name: "Sanduíche de ovo e requeijão + leite",
        ingredients: [
          [bread, 40],
          [eggs, 50],
          ["Requeijao light", 20],
          ["Tomate cru", 50],
          ["Leite desnatado (ml)", 100],
        ],
        preparation:
          "40 g de pão integral, cerca de 1 ovo (50 g sem casca), 20 g de requeijão light, 50 g de tomate e 100 ml de leite desnatado. Sem frango nem whey nesta opção. Leite e requeijão estão contados; não acrescente outra porção por fora.",
      },
      {
        name: "Sanduíche de queijo e requeijão + leite",
        ingredients: [
          [bread, 40],
          [cheese, 25],
          ["Requeijao tradicional", 15],
          ["Tomate cru", 50],
          ["Leite desnatado (ml)", 150],
        ],
        preparation:
          "40 g de pão integral, 25 g de muçarela light, 15 g de requeijão tradicional, 50 g de tomate e 150 ml de leite desnatado. Sem ovos, frango ou whey nesta opção. Leite integral ou mais queijo mudam as calorias; recalcule antes de trocar.",
      },
    ],
  },
  {
    meal: "Jantar",
    options: [
      {
        name: "Batata com carne moída e abobrinha",
        ingredients: hot([
          [potato, 180],
          [mince, 130],
          [zucchini, 150],
        ]),
        preparation:
          "Batata, carne moída magra e abobrinha pesadas prontas. Preparo incluído agrupa a referência dos temperos e óleo. Sem frango nesta opção; confira a gordura da carne usada.",
      },
      {
        name: "Arroz com carne moída e brócolis",
        ingredients: hot([
          [rice, 100],
          [mince, 120],
          [broccoli, 150],
        ]),
        preparation:
          "Pese arroz, carne moída magra e legumes prontos. Os temperos e o óleo do preparo ficam agrupados na referência; não conte o mesmo óleo duas vezes.",
      },
      {
        name: "Macarrão com frango temperado",
        ingredients: hot([
          [pasta, 130],
          [chicken, 130],
          [zucchini, 150],
        ]),
        preparation:
          "Opção com frango, se quiser: 130 g de carne cozida pesada sem caldo, macarrão e legumes prontos. Preparo incluído agrupa os temperos e óleo de referência. Não há obrigação de repetir frango no jantar.",
      },
    ],
  },
];

export function starterDietEntries(
  date: string,
  choices: number[] = STARTER_DIET_MEALS.map(() => 0),
  catalog: Food[] = ELITE_FOODS,
): MealEntry[] {
  if (!validDate(date)) throw new Error("Escolha uma data válida.");
  if (choices.length !== STARTER_DIET_MEALS.length)
    throw new Error("Seleção de refeições inválida.");
  return STARTER_DIET_MEALS.flatMap(({ meal, options }, mealIndex) => {
    const selected = choices[mealIndex];
    if (!Number.isInteger(selected) || !options[selected])
      throw new Error("Opção de refeição inválida.");
    return options[selected].ingredients.map(([name, quantity]) => {
      const reference = ELITE_FOODS.find(
        (candidate) => candidate.name === name,
      );
      const food = catalog.find((candidate) => candidate.id === reference?.id);
      if (!food) throw new Error(`Referência alimentar ausente: ${name}.`);
      return {
        id: nutritionId(),
        date,
        meal,
        time: "",
        quantity,
        food: structuredClone(food),
        kind: "planned" as const,
        order: 0,
        ...(aromatics.some(([ingredient]) => ingredient === name) ||
        name === olive
          ? { preparationOnly: true }
          : {}),
      };
    });
  }).map((entry, order) => ({ ...entry, order }));
}

export function applyStarterDiet(
  state: NutritionState,
  start: string,
  days: 1 | 7,
  choices: number[],
  setGoal: boolean,
  catalog: Food[] = ELITE_FOODS,
  mode: "fill" | "replace" = "fill",
) {
  if (!validDate(start) || start < localDate())
    throw new Error("Use hoje ou uma data futura para o planejamento.");
  if (days !== 1 && days !== 7) throw new Error("Escolha um dia ou sete dias.");
  if (mode !== "fill" && mode !== "replace")
    throw new Error("Modo de aplicação inválido.");
  const dates = Array.from({ length: days }, (_, index) =>
    offsetDate(start, index),
  );
  const emptyDates = dates.filter(
    (date) =>
      mode === "replace" ||
      !state.entries.some(
        (entry) => entry.date === date && entry.kind === "planned",
      ),
  );
  if (!emptyDates.length)
    throw new Error(
      "Esses dias já têm planejamento. Os registros foram preservados; escolha dias vazios.",
    );
  const generated = emptyDates.map((date) =>
    starterDietEntries(date, choices, catalog),
  );
  if (
    generated.some(
      (entries) => totalNutrients(entries).kcal > STARTER_DIET_LIMIT,
    )
  )
    throw new Error(
      "Esta combinação ultrapassa 1.700 kcal nas referências atuais. Ajuste as opções ou os rótulos antes de aplicar.",
    );
  let next = setGoal
    ? {
        ...state,
        goals: {
          ...state.goals,
          kcal: STARTER_DIET_LIMIT,
          validated: false,
          professionalNote: "",
        },
      }
    : state;
  if (mode === "replace")
    next = {
      ...next,
      entries: next.entries.filter(
        (entry) => entry.kind !== "planned" || !emptyDates.includes(entry.date),
      ),
    };
  for (const entries of generated)
    for (const entry of entries) next = saveMealEntry(next, entry);
  if (setGoal)
    next = {
      ...next,
      days: next.days.map((day) =>
        emptyDates.includes(day.date)
          ? { ...day, goals: structuredClone(next.goals) }
          : day,
      ),
    };
  return next;
}

export function starterDietText(
  date: string,
  choices: number[],
  catalog: Food[] = ELITE_FOODS,
) {
  const entries = starterDietEntries(date, choices, catalog);
  const total = totalNutrients(entries);
  const format = (value: number) =>
    value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const lines = [
    "MEUTREINO — CARDÁPIO BASE E SUBSTITUIÇÕES",
    `Referência: ${date} | Total selecionado estimado: ${format(total.kcal)} kcal`,
    `P: ${format(total.protein)} g | C: ${format(total.carbs)} g | G: ${format(total.fat)} g`,
    "Teto informado: 1.700 kcal. Modelo inicial não validado por profissional; não é garantia de adequação nutricional.",
    "Valores aproximados. Rótulos, preparo e gordura das carnes alteram os totais. Fibras desconhecidas, não zero.",
    "",
  ];
  STARTER_DIET_MEALS.forEach(({ meal, options }, mealIndex) => {
    lines.push(meal.toLocaleUpperCase("pt-BR"));
    options.forEach((option, at) => {
      const selected = [...choices];
      selected[mealIndex] = at;
      const alternate = starterDietEntries(date, selected, catalog);
      const mealEntries = alternate.filter((entry) => entry.meal === meal);
      lines.push(
        `${at === choices[mealIndex] ? "[ESCOLHIDA] " : "[TROCA] "}${option.name} — ${format(totalNutrients(mealEntries).kcal)} kcal na refeição; ${format(totalNutrients(alternate).kcal)} kcal no dia com esta troca.`,
      );
      mealEntries.forEach((entry) =>
        lines.push(
          `  ${entry.preparationOnly ? "[Detalhe do preparo incluído] " : ""}${format(entry.quantity)} ${entry.food.unit} — ${entry.food.name}`,
        ),
      );
      lines.push(`  Preparo: ${option.preparation}`);
    });
    lines.push("");
  });
  lines.push(
    "Preparo incluído agrupa temperos e azeite de referência; os detalhes continuam contados, mas não aparecem como acompanhamentos. Não é a medição da sua receita caseira. Ajuste quando souber quanto usa.",
    "Frango: pese a carne cozida sem o caldo. Caldo não substitui gramas de carne nem é considerado automaticamente zero kcal; óleo, ingredientes e rendimento mudam sua composição. Se consumir caldo, registre a receita/porção real quando disponível. Sem caldo, não há desconto automático de nutrientes.",
    "Recalcule o total se mudar qualquer quantidade, marca ou preparo. As trocas são opções de refeição, não equivalências completas de vitaminas, fibras e minerais.",
    "Planejamento não é consumo confirmado. Este arquivo não contém medições pessoais.",
  );
  return lines.join("\r\n");
}
