import type { AppState, Exercise, WorkoutPlan, MuscleGroup } from '../types';

export const STARTER_PLAN_VERSION = 2 as const;
export const ELITE_PROTOCOL_VERSION = 3 as const;

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
  muscleGroup: MuscleGroup;
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
  muscleGroup,
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
    minReps: minReps ?? reps,
    muscleGroup,
    targetRirMin: Number((rir.match(/\d/) ?? ['2'])[0]),
    targetRirMax: Number((rir.match(/\d(?!.*\d)/) ?? ['2'])[0]),
    restSeconds,
    notes,
    ...(supersetGroup ? { supersetGroup } : {}),
  };
}

const PRIORITY_ADDITIONS: Record<string, { afterId: string; item: ExerciseInput }[]> = {
  'plan-full-body-a': [{
    afterId: 'quarta-remada-maquina',
    item: { id: 'full-body-a-puxada-neutra', muscleGroup: 'costas', name: 'Puxada alta com pegada neutra', sets: 2, minReps: 10, reps: 12, restSeconds: 120, rir: '2', guidance: 'movimento controlado, sem impulsionar o tronco; ajuste a carga para manter a técnica' },
  }],
  'plan-full-body-b': [{
    afterId: 'b-elevacao-lateral',
    item: { id: 'full-body-b-rosca-polia', muscleGroup: 'biceps', name: 'Rosca direta na polia', sets: 2, minReps: 10, reps: 15, restSeconds: 90, rir: '2', guidance: 'sem embalo do tronco; use amplitude confortável e mantenha o controle' },
  }, {
    afterId: 'full-body-b-rosca-polia',
    item: { id: 'full-body-b-triceps-corda', muscleGroup: 'triceps', name: 'Tríceps corda na polia', sets: 2, minReps: 10, reps: 15, restSeconds: 90, rir: '2', guidance: 'cotovelos estáveis; movimento controlado, sem dor articular' },
  }],
};

function addPriorityExercises(plan: WorkoutPlan, now: string): WorkoutPlan {
  const additions = PRIORITY_ADDITIONS[plan.id];
  if (!additions) return plan;
  const nameKey = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
  const exercises = [...plan.exercises];
  let changed = false;
  for (const { afterId, item } of additions) {
    if (exercises.some((existing) => existing.id === item.id || nameKey(existing.name) === nameKey(item.name))) continue;
    const anchor = exercises.findIndex((existing) => existing.id === afterId);
    exercises.splice(anchor === -1 ? exercises.length : anchor + 1, 0, exercise(item));
    changed = true;
  }
  const sets = exercises.reduce((sum, item) => sum + item.targetSets, 0);
  const notes = plan.notes?.replace(/^(Pré-cirurgia · )\d+( séries ·)/, (_match, prefix: string, suffix: string) => `${prefix}${sets}${suffix}`);
  if (!changed && notes === plan.notes) return plan;
  return { ...plan, exercises: changed ? exercises : plan.exercises, notes, updatedAt: now };
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
    plan('plan-full-body-a', 'Full Body A', 'Pré-cirurgia · 20 séries · foco: quadríceps, peitoral, remada e posterior', [
      exercise({ id: 'terca-hack', muscleGroup: 'quadriceps', name: 'Hack squat ou agachamento Smith', sets: 3, minReps: 6, reps: 10, restSeconds: 180, rir: '2–3' }),
      exercise({ id: 'segunda-supino-inclinado-halteres', muscleGroup: 'peito', name: 'Supino inclinado com halteres', sets: 3, minReps: 6, reps: 10, restSeconds: 150, rir: '2' }),
      exercise({ id: 'quarta-remada-maquina', muscleGroup: 'costas', name: 'Remada máquina com apoio para o peito', sets: 2, minReps: 8, reps: 12, restSeconds: 120, rir: '2' }),
      exercise({ id: 'sexta-stiff', muscleGroup: 'posterior', name: 'Terra romeno (RDL)', sets: 2, minReps: 6, reps: 10, restSeconds: 180, rir: '2–3' }),
      exercise({ id: 'segunda-elevacao-lateral', muscleGroup: 'ombros', name: 'Elevação lateral', sets: 2, minReps: 12, reps: 20, restSeconds: 75, rir: '1–2' }),
      exercise({ id: 'quarta-rosca-direta-halter', muscleGroup: 'biceps', name: 'Rosca direta com halteres', sets: 2, minReps: 8, reps: 12, restSeconds: 75, rir: '1–2', supersetGroup: 'A' }),
      exercise({ id: 'sabado-frances-polia', muscleGroup: 'triceps', name: 'Tríceps francês na polia', sets: 2, minReps: 10, reps: 15, restSeconds: 75, rir: '1–2', supersetGroup: 'A' }),
      exercise({ id: 'terca-panturrilha', muscleGroup: 'panturrilhas', name: 'Panturrilha em pé', sets: 2, minReps: 8, reps: 15, restSeconds: 75, rir: '1–2' }),
      exercise({ id: 'full-body-a-abdomen', muscleGroup: 'core', name: 'Crunch abdominal na polia', sets: 2, minReps: 10, reps: 15, restSeconds: 60, rir: '2', guidance: 'sem dor e com técnica controlada' }),
    ]),
    plan('plan-full-body-b', 'Full Body B', 'Pré-cirurgia · 19 séries · foco: puxada, posterior, ombros e core', [
      exercise({ id: 'terca-leg-press', muscleGroup: 'quadriceps', name: 'Leg press', sets: 3, minReps: 10, reps: 15, restSeconds: 150, rir: '2' }),
      exercise({ id: 'quarta-puxada-alta', muscleGroup: 'costas', name: 'Puxada alta (neutra ou aberta)', sets: 3, minReps: 8, reps: 12, restSeconds: 120, rir: '2' }),
      exercise({ id: 'segunda-supino-reto', muscleGroup: 'peito', name: 'Supino reto no Smith ou máquina', sets: 2, minReps: 6, reps: 10, restSeconds: 150, rir: '2' }),
      exercise({ id: 'sexta-cadeira-flexora', muscleGroup: 'posterior', name: 'Flexora sentada', sets: 2, minReps: 10, reps: 15, restSeconds: 90, rir: '1–2' }),
      exercise({ id: 'quinta-desenvolvimento', muscleGroup: 'ombros', name: 'Desenvolvimento na máquina', sets: 2, minReps: 8, reps: 12, restSeconds: 120, rir: '2' }),
      exercise({ id: 'quinta-fly-reverso', muscleGroup: 'deltoide_posterior', name: 'Reverse peck deck', sets: 2, minReps: 12, reps: 20, restSeconds: 75, rir: '1–2' }),
      exercise({ id: 'b-elevacao-lateral', muscleGroup: 'ombros', name: 'Elevação lateral na máquina ou polia', sets: 1, minReps: 12, reps: 20, restSeconds: 75, rir: '1–2' }),
      exercise({ id: 'full-body-b-abdomen', muscleGroup: 'core', name: 'Crunch abdominal na polia', sets: 2, minReps: 10, reps: 15, restSeconds: 75, rir: '2', guidance: 'sem dor e com técnica controlada' }),
      exercise({ id: 'b-panturrilha-sentado', muscleGroup: 'panturrilhas', name: 'Panturrilha sentado', sets: 2, minReps: 10, reps: 15, restSeconds: 75, rir: '1–2' }),
    ]),
    plan('plan-full-body-c', 'Full Body C', 'Pré-cirurgia · 21 séries · foco: unilateral, costas, quadríceps e braços', [
      exercise({ id: 'terca-bulgaro', muscleGroup: 'quadriceps', name: 'Agachamento búlgaro', sets: 2, minReps: 8, reps: 12, restSeconds: 150, rir: '2–3', guidance: 'por perna; uma série = ambos os lados' }),
      exercise({ id: 'segunda-supino-declinado', muscleGroup: 'peito', name: 'Supino convergente ou declinado na máquina', sets: 3, minReps: 8, reps: 12, restSeconds: 120, rir: '2' }),
      exercise({ id: 'quarta-serrote', muscleGroup: 'costas', name: 'Remada unilateral com apoio', sets: 3, minReps: 8, reps: 12, restSeconds: 120, rir: '2', guidance: 'por lado; uma série = ambos os lados' }),
      exercise({ id: 'sexta-cadeira-flexora', muscleGroup: 'posterior', name: 'Flexora sentada ou deitada', sets: 2, minReps: 10, reps: 15, restSeconds: 90, rir: '1–2' }),
      exercise({ id: 'terca-cadeira-extensora', muscleGroup: 'quadriceps', name: 'Cadeira extensora', sets: 1, minReps: 12, reps: 15, restSeconds: 90, rir: '1–2' }),
      exercise({ id: 'quarta-pulldown', muscleGroup: 'costas', name: 'Pulldown com braços estendidos', sets: 2, minReps: 10, reps: 15, restSeconds: 90, rir: '1–2' }),
      exercise({ id: 'quinta-elevacao-lateral-polia', muscleGroup: 'ombros', name: 'Elevação lateral na polia', sets: 2, minReps: 12, reps: 20, restSeconds: 75, rir: '1–2' }),
      exercise({ id: 'sabado-martelo', muscleGroup: 'biceps', name: 'Rosca martelo', sets: 2, minReps: 8, reps: 12, restSeconds: 75, rir: '1–2', supersetGroup: 'C' }),
      exercise({ id: 'sabado-barra-w', muscleGroup: 'triceps', name: 'Tríceps corda ou barra W', sets: 2, minReps: 8, reps: 12, restSeconds: 75, rir: '1–2', supersetGroup: 'C' }),
      exercise({ id: 'sexta-panturrilha', muscleGroup: 'panturrilhas', name: 'Panturrilha em pé ou sentado', sets: 2, minReps: 12, reps: 20, restSeconds: 75, rir: '1–2' }),
    ]),
  ].map((item) => addPriorityExercises(item, now));
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

/** Instalação explícita evita substituir fichas editadas silenciosamente durante atualizações. */
export function applyPreSurgicalProtocol(state: AppState, now = new Date().toISOString()): AppState {
  if (state.activeWorkout) {
    throw new Error('Finalize ou abandone a sessão atual antes de trocar o protocolo.');
  }
  const bundledIds = new Set(['plan-full-body-a', 'plan-full-body-b', 'plan-full-body-c']);
  const archivedPersonalized = state.plans
    .filter((plan) => {
      const bundled = createWeeklyWorkoutPlans(now).find((item) => item.id === plan.id);
      return bundledIds.has(plan.id) && (plan.name !== bundled?.name
        || plan.notes !== bundled?.notes
        || JSON.stringify(plan.exercises) !== JSON.stringify(bundled?.exercises));
    })
    .map((plan) => ({
      ...plan,
      id: `plan-arquivo-${plan.id}-${now.replace(/\W/g, '')}`,
      name: `${plan.name} (versão pessoal anterior)`,
    }));
  return {
    ...state,
    eliteProtocolVersion: ELITE_PROTOCOL_VERSION,
    plans: [
      ...createWeeklyWorkoutPlans(now),
      ...archivedPersonalized,
      ...state.plans.filter((plan) => !bundledIds.has(plan.id)),
    ],
    updatedAt: now,
  };
}

/** User-authorized release migration. Never interrupt a session or reapply after edits. */
export function upgradeEliteProtocol(state: AppState, now = new Date().toISOString()): AppState {
  if (state.eliteProtocolVersion === ELITE_PROTOCOL_VERSION || state.activeWorkout) return state;
  let upgraded = state;
  if (state.eliteProtocolVersion === 1) {
    // This release changes only Monday's old core exercise, not personalized fichas.
    const plans = state.plans.map((plan) => {
      if (plan.id !== 'plan-full-body-a' || !plan.exercises.some((item) => item.id === 'pre-pallof')) return plan;
      return {
        ...plan,
        updatedAt: now,
        exercises: plan.exercises.map((item) => item.id === 'pre-pallof' ? {
          ...item,
          id: 'full-body-a-abdomen',
          name: 'Crunch abdominal na polia',
          muscleGroup: 'core' as const,
          // Pallof's per-side instruction does not apply to a cable crunch.
          ...(item.notes ? { notes: item.notes.replace('cada lado; ', '') } : {}),
        } : item),
      };
    });
    upgraded = { ...state, plans, eliteProtocolVersion: 2, updatedAt: now };
  }
  if (upgraded.eliteProtocolVersion === 2) return {
    ...upgraded,
    plans: upgraded.plans.map((plan) => addPriorityExercises(plan, now)),
    eliteProtocolVersion: ELITE_PROTOCOL_VERSION,
    updatedAt: now,
  };
  return applyPreSurgicalProtocol(state, now);
}
