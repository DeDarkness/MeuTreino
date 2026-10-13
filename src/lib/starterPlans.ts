import type { AppState, Exercise, WorkoutPlan } from '../types';

export const STARTER_PLAN_VERSION = 2 as const;

const PLAN_BY_WEEKDAY = [
  'plan-full-body-a',
  'plan-full-body-a',
  'plan-full-body-b',
  'plan-full-body-b',
  'plan-full-body-c',
  'plan-full-body-c',
  'plan-full-body-a',
] as const;

const LEGACY_SAMPLE_PLAN_IDS = new Set(['plan-treino-a', 'plan-treino-b']);
const BUNDLED_PLAN_IDS = new Set([
  'plan-segunda',
  'plan-terca',
  'plan-quarta',
  'plan-quinta',
  'plan-sexta',
  'plan-sabado',
  'plan-full-body-a',
  'plan-full-body-b',
  'plan-full-body-c',
]);

export function getSuggestedPlanId(dayOfWeek = new Date().getDay()): string {
  return PLAN_BY_WEEKDAY[dayOfWeek] ?? 'plan-full-body-a';
}

type ExerciseInput = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  minReps?: number;
  restSeconds?: number;
  rir: string;
  supersetGroup?: string;
  guidance?: string;
};

function exercise({
  id,
  name,
  sets,
  reps,
  minReps,
  restSeconds = 90,
  rir,
  supersetGroup,
  guidance,
}: ExerciseInput): Exercise {
  const repetitionTarget = minReps === undefined ? `${reps}` : `${minReps}–${reps}`;
  const notes = [`Meta: ${repetitionTarget} repetições`, `RIR ${rir}`, guidance]
    .filter(Boolean)
    .join(' · ');

  return {
    id,
    name,
    targetSets: sets,
    targetReps: reps,
    restSeconds,
    notes,
    ...(supersetGroup ? { supersetGroup } : {}),
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
    plan('plan-full-body-a', 'Full Body A', 'Tensão mecânica · 22 séries', [
      exercise({ id: 'terca-hack', name: 'Hack squat ou agachamento Smith', sets: 4, minReps: 5, reps: 8, restSeconds: 180, rir: '1–2' }),
      exercise({ id: 'segunda-supino-inclinado-halteres', name: 'Supino inclinado com halteres', sets: 3, minReps: 6, reps: 10, restSeconds: 150, rir: '1–2' }),
      exercise({ id: 'quarta-remada-maquina', name: 'Remada máquina', sets: 3, minReps: 6, reps: 10, restSeconds: 150, rir: '1–2' }),
      exercise({ id: 'sexta-stiff', name: 'Stiff / terra romeno', sets: 3, minReps: 6, reps: 10, restSeconds: 150, rir: '2' }),
      exercise({ id: 'segunda-elevacao-lateral', name: 'Elevação lateral', sets: 2, minReps: 12, reps: 20, restSeconds: 75, rir: '1' }),
      exercise({ id: 'quarta-rosca-direta-halter', name: 'Rosca direta com halteres', sets: 2, minReps: 8, reps: 12, restSeconds: 75, rir: '1', supersetGroup: 'A' }),
      exercise({ id: 'sabado-frances-polia', name: 'Tríceps francês na polia', sets: 2, minReps: 10, reps: 15, restSeconds: 75, rir: '1', supersetGroup: 'A' }),
      exercise({ id: 'terca-panturrilha', name: 'Panturrilha em pé', sets: 3, minReps: 10, reps: 15, restSeconds: 75, rir: '1' }),
    ]),
    plan('plan-full-body-b', 'Full Body B', 'Volume e amplitude · 23 séries', [
      exercise({ id: 'terca-leg-press', name: 'Leg press', sets: 3, minReps: 8, reps: 12, restSeconds: 150, rir: '1–2' }),
      exercise({ id: 'quarta-puxada-alta', name: 'Puxada alta neutra ou aberta', sets: 3, minReps: 8, reps: 12, restSeconds: 120, rir: '1–2' }),
      exercise({ id: 'segunda-supino-reto', name: 'Supino reto no Smith ou barra', sets: 3, minReps: 6, reps: 10, restSeconds: 150, rir: '1–2' }),
      exercise({ id: 'sexta-cadeira-flexora', name: 'Cadeira flexora', sets: 3, minReps: 10, reps: 15, restSeconds: 105, rir: '1' }),
      exercise({ id: 'quinta-desenvolvimento', name: 'Desenvolvimento militar no Smith', sets: 2, minReps: 6, reps: 10, restSeconds: 120, rir: '1–2' }),
      exercise({ id: 'quinta-fly-reverso', name: 'Reverse peck deck', sets: 2, minReps: 12, reps: 20, restSeconds: 75, rir: '1' }),
      exercise({ id: 'sabado-scott-unilateral', name: 'Scott unilateral com halter', sets: 2, minReps: 8, reps: 12, restSeconds: 75, rir: '1', supersetGroup: 'A' }),
      exercise({ id: 'sabado-triceps-corda', name: 'Tríceps corda', sets: 2, minReps: 10, reps: 15, restSeconds: 75, rir: '1', supersetGroup: 'A' }),
      exercise({ id: 'full-body-b-abdomen', name: 'Abdômen com carga', sets: 3, minReps: 10, reps: 20, restSeconds: 75, rir: '1–2' }),
    ]),
    plan('plan-full-body-c', 'Full Body C', 'Densidade e unilateral · 24 séries', [
      exercise({ id: 'terca-bulgaro', name: 'Agachamento búlgaro', sets: 3, minReps: 8, reps: 12, restSeconds: 150, rir: '1–2', guidance: 'por perna' }),
      exercise({ id: 'segunda-supino-declinado', name: 'Supino declinado na máquina', sets: 3, minReps: 8, reps: 12, restSeconds: 120, rir: '1–2' }),
      exercise({ id: 'quarta-serrote', name: 'Serrote / remada unilateral', sets: 3, minReps: 8, reps: 12, restSeconds: 120, rir: '1–2' }),
      exercise({ id: 'sexta-cadeira-flexora', name: 'Flexora sentada ou deitada', sets: 2, minReps: 10, reps: 15, restSeconds: 90, rir: '1' }),
      exercise({ id: 'terca-cadeira-extensora', name: 'Cadeira extensora', sets: 2, minReps: 12, reps: 15, restSeconds: 90, rir: '1' }),
      exercise({ id: 'quarta-pulldown', name: 'Pullover / pulldown na polia', sets: 2, minReps: 12, reps: 15, restSeconds: 90, rir: '1' }),
      exercise({ id: 'quinta-elevacao-lateral-polia', name: 'Elevação lateral na polia', sets: 2, minReps: 12, reps: 20, restSeconds: 75, rir: '1' }),
      exercise({ id: 'sabado-martelo', name: 'Rosca martelo', sets: 2, minReps: 8, reps: 12, restSeconds: 75, rir: '1', supersetGroup: 'A' }),
      exercise({ id: 'sabado-barra-w', name: 'Tríceps barra W', sets: 2, minReps: 8, reps: 12, restSeconds: 75, rir: '1', supersetGroup: 'A' }),
      exercise({ id: 'sexta-panturrilha', name: 'Panturrilha', sets: 3, minReps: 12, reps: 20, restSeconds: 75, rir: '1' }),
    ]),
  ];
}

export function installWeeklyWorkoutPlans(state: AppState, now = new Date().toISOString()): AppState {
  if (state.starterPlanVersion === STARTER_PLAN_VERSION) return state;

  const weeklyPlans = createWeeklyWorkoutPlans(now);
  const preservedPlans = state.plans.filter(
    (plan) => !LEGACY_SAMPLE_PLAN_IDS.has(plan.id) && !BUNDLED_PLAN_IDS.has(plan.id),
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
