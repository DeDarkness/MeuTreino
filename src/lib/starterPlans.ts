import type { AppState, Exercise, WorkoutPlan } from '../types';

export const STARTER_PLAN_VERSION = 1 as const;

const PLAN_BY_WEEKDAY = [
  'plan-segunda',
  'plan-segunda',
  'plan-terca',
  'plan-quarta',
  'plan-quinta',
  'plan-sexta',
  'plan-sabado',
] as const;

const LEGACY_SAMPLE_PLAN_IDS = new Set(['plan-treino-a', 'plan-treino-b']);

export function getSuggestedPlanId(dayOfWeek = new Date().getDay()): string {
  return PLAN_BY_WEEKDAY[dayOfWeek] ?? 'plan-segunda';
}

type ExerciseInput = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  minReps?: number;
  restSeconds?: number;
};

function exercise({
  id,
  name,
  sets,
  reps,
  minReps,
  restSeconds = 90,
}: ExerciseInput): Exercise {
  return {
    id,
    name,
    targetSets: sets,
    targetReps: reps,
    restSeconds,
    ...(minReps === undefined ? {} : { notes: `Meta: ${minReps}–${reps} repetições` }),
  };
}

export function createWeeklyWorkoutPlans(now = new Date().toISOString()): WorkoutPlan[] {
  const plan = (id: string, name: string, notes: string, exercises: Exercise[]): WorkoutPlan => ({
    id,
    name,
    notes,
    exercises,
    createdAt: now,
    updatedAt: now,
  });

  return [
    plan('plan-segunda', 'Segunda-feira', 'Peito, ombros e tríceps', [
      exercise({ id: 'segunda-supino-inclinado-halteres', name: 'Supino inclinado com halteres', sets: 3, minReps: 8, reps: 12, restSeconds: 120 }),
      exercise({ id: 'segunda-supino-reto', name: 'Supino reto no Smith ou barra', sets: 3, minReps: 6, reps: 10 }),
      exercise({ id: 'segunda-supino-declinado', name: 'Supino declinado na máquina', sets: 4, minReps: 12, reps: 15 }),
      exercise({ id: 'segunda-fly-peck-deck', name: 'Fly peck deck', sets: 2, minReps: 15, reps: 20 }),
      exercise({ id: 'segunda-elevacao-lateral', name: 'Elevação lateral', sets: 4, reps: 12 }),
      exercise({ id: 'segunda-triceps-testa', name: 'Tríceps testa', sets: 4, reps: 12 }),
    ]),
    plan('plan-terca', 'Terça-feira', 'Quadríceps e panturrilha', [
      exercise({ id: 'terca-agachamento', name: 'Agachamento livre ou Smith', sets: 4, minReps: 8, reps: 10 }),
      exercise({ id: 'terca-leg-press', name: 'Leg press', sets: 3, minReps: 8, reps: 10 }),
      exercise({ id: 'terca-hack', name: 'Hack', sets: 3, minReps: 10, reps: 12 }),
      exercise({ id: 'terca-bulgaro', name: 'Búlgaro', sets: 2, minReps: 6, reps: 10 }),
      exercise({ id: 'terca-cadeira-extensora', name: 'Cadeira extensora', sets: 4, minReps: 8, reps: 10 }),
      exercise({ id: 'terca-panturrilha', name: 'Panturrilha', sets: 3, reps: 10 }),
    ]),
    plan('plan-quarta', 'Quarta-feira', 'Costas e bíceps', [
      exercise({ id: 'quarta-pulldown', name: 'Pulldown', sets: 2, minReps: 15, reps: 20 }),
      exercise({ id: 'quarta-puxada-alta', name: 'Puxada alta', sets: 3, minReps: 12, reps: 15 }),
      exercise({ id: 'quarta-remada-maquina', name: 'Remada máquina', sets: 4, minReps: 10, reps: 12 }),
      exercise({ id: 'quarta-remada-unilateral', name: 'Remada unilateral', sets: 3, minReps: 8, reps: 10 }),
      exercise({ id: 'quarta-serrote', name: 'Serrote', sets: 4, minReps: 8, reps: 10 }),
      exercise({ id: 'quarta-rosca-direta-halter', name: 'Rosca direta com halteres', sets: 4, reps: 12 }),
      exercise({ id: 'quarta-rosca-unilateral-polia', name: 'Rosca unilateral na polia', sets: 3, minReps: 8, reps: 10 }),
    ]),
    plan('plan-quinta', 'Quinta-feira', 'Ombros e peitoral', [
      exercise({ id: 'quinta-elevacao-lateral-polia', name: 'Elevação lateral na polia', sets: 3, minReps: 12, reps: 15 }),
      exercise({ id: 'quinta-desenvolvimento', name: 'Desenvolvimento militar ou com halteres', sets: 4, minReps: 8, reps: 10 }),
      exercise({ id: 'quinta-fly-reverso', name: 'Fly peck deck reverso', sets: 3, minReps: 10, reps: 12 }),
      exercise({ id: 'quinta-elevacao-frontal', name: 'Elevação frontal', sets: 3, minReps: 6, reps: 10 }),
      exercise({ id: 'quinta-crossover-alto', name: 'Crossover alto', sets: 4, minReps: 12, reps: 15 }),
      exercise({ id: 'quinta-crossover-medio', name: 'Crossover médio', sets: 4, minReps: 12, reps: 15 }),
    ]),
    plan('plan-sexta', 'Sexta-feira', 'Posterior, glúteos e panturrilha', [
      exercise({ id: 'sexta-mesa-extensora', name: 'Mesa extensora', sets: 4, minReps: 10, reps: 12 }),
      exercise({ id: 'sexta-stiff', name: 'Stiff', sets: 5, minReps: 10, reps: 15 }),
      exercise({ id: 'sexta-cadeira-flexora', name: 'Cadeira flexora', sets: 4, reps: 10 }),
      exercise({ id: 'sexta-elevacao-pelvica', name: 'Elevação pélvica', sets: 3, reps: 10 }),
      exercise({ id: 'sexta-panturrilha', name: 'Panturrilha', sets: 3, reps: 10 }),
    ]),
    plan('plan-sabado', 'Sábado', 'Bíceps e tríceps', [
      exercise({ id: 'sabado-rosca-direta-halter', name: 'Rosca direta com halteres', sets: 3, minReps: 10, reps: 12 }),
      exercise({ id: 'sabado-martelo', name: 'Rosca martelo', sets: 3, minReps: 8, reps: 10 }),
      exercise({ id: 'sabado-scott-unilateral', name: 'Scott unilateral com halter', sets: 4, minReps: 10, reps: 12 }),
      exercise({ id: 'sabado-rosca-inclinada', name: 'Rosca inclinada', sets: 2, reps: 10 }),
      exercise({ id: 'sabado-triceps-corda', name: 'Tríceps corda', sets: 3, minReps: 10, reps: 12 }),
      exercise({ id: 'sabado-barra-w', name: 'Tríceps barra W', sets: 3, minReps: 10, reps: 12 }),
      exercise({ id: 'sabado-frances-polia', name: 'Tríceps francês na polia', sets: 4, minReps: 10, reps: 12 }),
      exercise({ id: 'sabado-unilateral-polia', name: 'Tríceps unilateral na polia', sets: 2, minReps: 8, reps: 10 }),
      exercise({ id: 'sabado-triceps-pulley', name: 'Tríceps pulley', sets: 4, minReps: 12, reps: 15 }),
    ]),
  ];
}

export function installWeeklyWorkoutPlans(state: AppState, now = new Date().toISOString()): AppState {
  if (state.starterPlanVersion === STARTER_PLAN_VERSION) return state;

  const weeklyPlans = createWeeklyWorkoutPlans(now);
  const weeklyIds = new Set(weeklyPlans.map((plan) => plan.id));
  const preservedPlans = state.plans.filter(
    (plan) => !LEGACY_SAMPLE_PLAN_IDS.has(plan.id) && !weeklyIds.has(plan.id),
  );
  const unusedLegacyWorkout = Boolean(
    state.activeWorkout
    && state.activeWorkout.planId
    && LEGACY_SAMPLE_PLAN_IDS.has(state.activeWorkout.planId)
    && state.activeWorkout.exercises.every((item) => item.sets.every((set) => !set.completed)),
  );

  return {
    ...state,
    starterPlanVersion: STARTER_PLAN_VERSION,
    plans: [...weeklyPlans, ...preservedPlans],
    activeWorkout: unusedLegacyWorkout ? null : state.activeWorkout,
    updatedAt: now,
  };
}
