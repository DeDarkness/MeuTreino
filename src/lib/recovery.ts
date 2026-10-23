import type { ActiveWorkout, ActiveWorkoutSet, AppState, MuscleGroup, RecoveryItem, RecoverySelection } from '../types';

/** Technical selection limits, not a recommendation to perform that many sets. */
export const MAX_RECOVERY_SETS = 18;
export const MAX_RECOVERY_SETS_PER_EXERCISE = 12;
export const MAX_SAVED_RECOVERY_ITEMS = 200;

export function localWeekKey(date = new Date()): string {
  if (!Number.isFinite(date.getTime())) throw new Error('Data inválida.');
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

export function isWeekKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && date.getDay() === 1 && localWeekKey(date) === value;
}

export function recoveryWeekLabel(key: string) {
  const start = new Date(`${key}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const format = (date: Date) => date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${format(start)} — ${format(end)}`;
}

export function remainingSetCount(workout: ActiveWorkout): number {
  return workout.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => !set.completed).length, 0);
}

export function savedRecoverySets(items: RecoveryItem[]): number {
  return items.reduce((sum, item) => sum + item.exercise.sets.length, 0);
}

export function recoveryByMuscle(items: RecoveryItem[]) {
  const totals = new Map<MuscleGroup, number>();
  for (const item of items) if (item.exercise.muscleGroup) {
    const muscle = item.exercise.muscleGroup;
    totals.set(muscle, (totals.get(muscle) ?? 0) + item.exercise.sets.length);
  }
  return [...totals].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}

export function chooseRecoveryItems(state: AppState, selections: RecoverySelection[]) {
  if (state.activeWorkout) throw new Error('Encerre a sessão atual primeiro.');
  if (!selections.length || selections.length > MAX_SAVED_RECOVERY_ITEMS) throw new Error('Selecione exercícios pendentes.');
  const byItem = new Map<string, Set<string>>();
  for (const selection of selections) {
    if (!selection.setIds.length) throw new Error('Selecione pelo menos uma série de cada exercício marcado.');
    const ids = byItem.get(selection.itemId) ?? new Set<string>();
    selection.setIds.forEach((id) => ids.add(id));
    byItem.set(selection.itemId, ids);
  }
  const selected = [...byItem].map(([id, setIds]) => {
    const item = state.recoveryItems?.find((candidate) => candidate.id === id);
    if (!item || [...setIds].some((setId) => !item.exercise.sets.some((set) => set.id === setId))) {
      throw new Error('Alguma pendência não está mais disponível. Reabra a seleção.');
    }
    return { item, sets: item.exercise.sets.filter((set) => setIds.has(set.id)) };
  });
  if (new Set(selected.map(({ item }) => item.weekStart)).size !== 1) throw new Error('Selecione uma semana por vez.');
  const total = selected.reduce((sum, choice) => sum + choice.sets.length, 0);
  if (total > MAX_RECOVERY_SETS) throw new Error(`Escolha até ${MAX_RECOVERY_SETS} séries por reposição.`);
  const perExercise = new Map<string, number>();
  for (const { item, sets } of selected) {
    const key = `${item.exercise.exerciseId}::${item.exercise.exerciseName}`;
    perExercise.set(key, (perExercise.get(key) ?? 0) + sets.length);
  }
  if ([...perExercise.values()].some((count) => count > MAX_RECOVERY_SETS_PER_EXERCISE)) {
    throw new Error(`Selecione até ${MAX_RECOVERY_SETS_PER_EXERCISE} séries do mesmo exercício por reposição.`);
  }
  return selected;
}

/** Consume only performed source sets. Unselected and unfinished sets retain their origin. */
export function settleRecoveryItems(state: AppState, workout: ActiveWorkout): RecoveryItem[] {
  const queue = state.recoveryItems ?? [];
  const reserved = new Set(workout.recoveryItemIds ?? []);
  if (!reserved.size || [...reserved].some((id) => !queue.some((item) => item.id === id))) throw new Error('A origem desta reposição não está disponível. Importe o backup completo.');
  const updates = new Map<string, Map<string, ActiveWorkoutSet>>();
  for (const exercise of workout.exercises) for (const set of exercise.sets) {
    const item = queue.find((candidate) => candidate.id === set.recoveryItemId);
    if (!item || !reserved.has(item.id) || !item.exercise.sets.some((original) => original.id === set.recoverySetId)) throw new Error('Série de reposição sem origem válida.');
    const itemUpdates = updates.get(item.id) ?? new Map<string, ActiveWorkoutSet>();
    if (itemUpdates.has(set.recoverySetId!)) throw new Error('A mesma série foi selecionada duas vezes.');
    itemUpdates.set(set.recoverySetId!, set);
    updates.set(item.id, itemUpdates);
  }
  return queue.flatMap((item) => {
    const changes = updates.get(item.id);
    if (!changes) return [item];
    const sets = item.exercise.sets.flatMap((original) => {
      const updated = changes.get(original.id);
      if (!updated) return [original];
      if (updated.completed) return [];
      return [{ ...original, reps: updated.reps, weight: updated.weight, rir: updated.rir, completed: false, completedAt: null }];
    });
    return sets.length ? [{ ...item, exercise: { ...item.exercise, sets } }] : [];
  });
}

export function discardRecoveryItem(state: AppState, id: string): AppState {
  if (state.activeWorkout?.recoveryItemIds?.includes(id)) throw new Error('Esta pendência está reservada pela reposição ativa. Encerre ou abandone essa sessão antes.');
  if (!state.recoveryItems?.some((item) => item.id === id)) throw new Error('Pendência não encontrada.');
  return { ...state, recoveryItems: state.recoveryItems.filter((item) => item.id !== id), updatedAt: new Date().toISOString() };
}
