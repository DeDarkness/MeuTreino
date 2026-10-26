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
const chicken = "Peito de frango grelhado sem pele";
const eggs = "Ovo inteiro cozido (sem casca)";
const banana = "Banana prata/nanica media (parte comestivel)";
const bread = "Pão de forma integral";
const rice = "Arroz branco cozido sem óleo";
const mince = "Patinho bovino grelhado";
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
        name: "Crepioca de ovos com frango + banana",
        ingredients: [
          [tapioca, 40],
          [eggs, 100],
          [chicken, 50],
          [banana, 80],
        ],
        preparation:
          "Misture 40 g de goma hidratada com cerca de 2 ovos (100 g sem casca). Recheie com 50 g de frango pronto. Frigideira antiaderente, sem óleo extra; banana pesada sem casca. Ovos cozidos do catálogo são uma aproximação para os ovos preparados sem óleo.",
      },
      {
        name: "Sanduíche de ovos e frango + banana",
        ingredients: [
          [bread, 50],
          [eggs, 100],
          [chicken, 50],
          [banana, 40],
        ],
        preparation:
          "50 g de pão (confira o peso das fatias), 100 g de ovos sem casca e 50 g de frango pronto. Banana: 40 g de parte comestível. Sem manteiga ou maionese não registradas.",
      },
      {
        name: "Omelete com frango + kiwi",
        ingredients: [
          [eggs, 150],
          [chicken, 70],
          ["Kiwi", 80],
        ],
        preparation:
          "Cerca de 3 ovos (150 g sem casca), 70 g de frango pronto e 80 g de kiwi sem casca. Prepare sem óleo extra; valores dos ovos são aproximados.",
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
          [chicken, 130],
          [broccoli, 100],
        ]),
        preparation:
          "Arroz, feijão, frango e brócolis pesados prontos. Cebola, pimentão e alho pesados crus antes do preparo. Os 3 ml de azeite já são todo o óleo desta porção, não uma adição ao óleo da panela.",
      },
      {
        name: "Macarrão com frango e legumes",
        ingredients: hot([
          [pasta, 140],
          [chicken, 130],
          [zucchini, 150],
        ]),
        preparation:
          "Macarrão sem molho, frango e abobrinha pesados prontos; aromáticos crus. Use somente os 3 ml de azeite contabilizados. Molho de tomate, queijo e outros extras devem ser registrados.",
      },
      {
        name: "Batata com carne moída magra",
        ingredients: hot([
          [potato, 230],
          [mince, 110],
          [broccoli, 100],
        ]),
        preparation:
          "Batata, carne e brócolis pesados prontos. Patinho grelhado é referência aproximada para patinho moído sem gordura extra. Conte os aromáticos e os 3 ml de azeite desta porção.",
      },
    ],
  },
  {
    meal: "Lanche da tarde",
    options: [
      {
        name: "Sanduíche de frango",
        ingredients: [
          [bread, 50],
          [chicken, 70],
          ["Tomate cru", 50],
          ["Alface crua", 20],
        ],
        preparation:
          "Monte com pão pesado, frango pronto, tomate e alface. Sem molho, manteiga ou maionese não registrados.",
      },
      {
        name: "Iogurte com whey e manga",
        ingredients: [
          [yogurt, 170],
          [whey, 25],
          ["Manga", 100],
        ],
        preparation:
          "Misture 170 g de iogurte natural desnatado com 25 g de whey e 100 g de polpa de manga. Whey em gramas de pó, não proteína pura. Confira os rótulos das suas marcas.",
      },
      {
        name: "Iogurte com whey e kiwi",
        ingredients: [
          [yogurt, 170],
          [whey, 25],
          ["Kiwi", 95],
        ],
        preparation:
          "170 g de iogurte desnatado, 25 g de whey em pó e 95 g de kiwi sem casca. Confira os rótulos: iogurte integral, adoçado ou whey de outra marca alteram os valores.",
      },
      {
        name: "Iogurte com whey e banana",
        ingredients: [
          [yogurt, 170],
          [whey, 25],
          [banana, 65],
        ],
        preparation:
          "170 g de iogurte desnatado, 25 g de whey em pó e 65 g de banana sem casca. Sem mel, açúcar ou granola não registrados.",
      },
      {
        name: "Tigela de iogurte, aveia, whey e manga",
        ingredients: [
          [yogurt, 170],
          ["Aveia em flocos secos", 20],
          [whey, 15],
          ["Manga", 40],
        ],
        preparation:
          "Misture 170 g de iogurte desnatado, 20 g de aveia pura (em flocos ou triturada), 15 g de whey em pó e 40 g de polpa de manga. Pode hidratar na geladeira; não acrescente mel, leite ou granola sem registrar. Confira o rótulo se usar farinha de aveia comprada.",
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
          "Pesos prontos de batata, carne magra e abobrinha; aromáticos crus. Os 3 ml de azeite incluem todo o óleo desta porção. Patinho do catálogo é referência aproximada para a carne moída.",
      },
      {
        name: "Arroz com carne moída e brócolis",
        ingredients: hot([
          [rice, 100],
          [mince, 120],
          [broccoli, 150],
        ]),
        preparation:
          "Pese arroz, carne e brócolis prontos. Refogue com os aromáticos e somente os 3 ml de azeite contabilizados.",
      },
      {
        name: "Macarrão com frango temperado",
        ingredients: hot([
          [pasta, 130],
          [chicken, 120],
          [zucchini, 150],
        ]),
        preparation:
          "Pesos cozidos de macarrão sem molho, frango e abobrinha; aromáticos crus. Os 3 ml de azeite já estão incluídos. Registre molhos ou queijo à parte.",
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
) {
  if (!validDate(start) || start < localDate())
    throw new Error("Use hoje ou uma data futura para o planejamento.");
  if (days !== 1 && days !== 7) throw new Error("Escolha um dia ou sete dias.");
  const dates = Array.from({ length: days }, (_, index) =>
    offsetDate(start, index),
  );
  const emptyDates = dates.filter(
    (date) =>
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
          `  ${format(entry.quantity)} ${entry.food.unit} — ${entry.food.name}`,
        ),
      );
      lines.push(`  Preparo: ${option.preparation}`);
    });
    lines.push("");
  });
  lines.push(
    "Páprica, molhos e óleo extra devem ser registrados pelo rótulo. Azeite e aromáticos listados já estão incluídos; não acrescente outra vez o óleo da panela.",
    "Recalcule o total se mudar qualquer quantidade, marca ou preparo. As trocas são opções de refeição, não equivalências completas de vitaminas, fibras e minerais.",
    "Planejamento não é consumo confirmado. Este arquivo não contém medições pessoais.",
  );
  return lines.join("\r\n");
}
