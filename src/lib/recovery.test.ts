import { IDBDatabase, IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState, RecoveryItem, RecoverySelection } from '../types';
import { createSeedState, exportState, importState, loadState, readSafetySnapshot, saveState, validateAppState } from './database';
import { chooseRecoveryItems, discardRecoveryItem, isWeekKey, localWeekKey, MAX_SAVED_RECOVERY_ITEMS, recoveryByMuscle, remainingSetCount, savedRecoverySets } from './recovery';
import { weeklyInsights } from './weeklyInsights';
import { completeActiveSet, deferActiveExercise, finishActiveWorkout, moveActiveExercise, queueMissedWorkoutPlan, startRecoveryWorkout, startWorkoutFromPlan, toggleSkipActiveExercise, updateActiveSet } from './workout';

const monday = new Date(2026, 9, 19, 19).toISOString();
const saturday = new Date(2026, 9, 24, 19).toISOString();
const seed = () => createSeedState(monday);
const begin = (state = seed()) => startWorkoutFromPlan(state, state.plans[0].id, monday).state;
const finish = (state: AppState, at = monday) => finishActiveWorkout(state, new Date(at)).state;
const mark = (state: AppState, exerciseIndex = 0, setIndex = 0) => {
  const exercise = state.activeWorkout!.exercises[exerciseIndex];
  return completeActiveSet(state, exercise.exerciseId, exercise.sets[setIndex].id, new Date(saturday));
};
const choices = (state: AppState, itemIndex = 0, count = 2): RecoverySelection[] => {
  const item = state.recoveryItems![itemIndex];
  return [{ itemId: item.id, setIds: item.exercise.sets.slice(0, count).map((set) => set.id) }];
};
const queue = () => finish(begin());
beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('encerramento flexível e origem das pendências', () => {
  it('encerra sem nenhuma série, sem inventar histórico, e guarda a ficha toda', () => {
    const initial = begin();
    const result = finish(initial);
    expect(result.activeWorkout).toBeNull();
    expect(result.history).toEqual([]);
    expect(savedRecoverySets(result.recoveryItems!)).toBe(22);
    expect(result.recoveryItems![0].exercise.sets).toEqual(initial.activeWorkout!.exercises[0].sets);
    expect(() => validateAppState(result)).not.toThrow();
  });
  it('salva só o realizado, incluindo pulados nas pendências e sem mudar a ficha', () => {
    const initial = begin();
    const skipped = toggleSkipActiveExercise(initial, initial.activeWorkout!.exercises[1].exerciseId);
    const result = finish(mark(skipped));
    expect(result.history).toHaveLength(1);
    expect(result.history[0].exercises[0].sets).toHaveLength(1);
    expect(savedRecoverySets(result.recoveryItems!)).toBe(21);
    expect(result.recoveryItems!.some((item) => item.exercise.exerciseId === initial.activeWorkout!.exercises[1].exerciseId)).toBe(true);
    expect(result.recoveryItems!.every((item) => item.exercise.skipped === false)).toBe(true);
    expect(result.plans).toEqual(seed().plans);
    expect(weeklyInsights(result.plans, result.history, new Date(saturday))).toMatchObject({ plannedSets: 66, actualSets: 1 });
  });
  it('não cria pendências quando todas as séries são concluídas', () => {
    let state = begin();
    for (const [index, exercise] of state.activeWorkout!.exercises.entries()) {
      for (let i = 0; i < exercise.sets.length; i += 1) state = mark(state, index, i);
    }
    const result = finish(state, saturday);
    expect(result.recoveryItems).toEqual([]);
    expect(result.history[0].exercises.flatMap((exercise) => exercise.sets)).toHaveLength(22);
    expect(() => finish(result)).toThrow('Nenhum treino');
  });
  it('a semana vem do começo da sessão local, mesmo encerrando após meia-noite', () => {
    const sunday = new Date(2026, 9, 25, 23, 59);
    const nextMonday = new Date(2026, 9, 26, 0, 20);
    const started = startWorkoutFromPlan(seed(), seed().plans[0].id, sunday.toISOString()).state;
    const result = finish(started, nextMonday.toISOString());
    expect(result.recoveryItems!.every((item) => item.weekStart === '2026-10-19')).toBe(true);
    expect(localWeekKey(nextMonday)).toBe('2026-10-26');
  });
  it.each(['2026-10-20', '2026-02-30', '2026-13-19', '2026-1-19', '', null])('rejeita chave de semana inválida: %s', (value) => expect(isWeekKey(value)).toBe(false));
  it('calcula segunda-feira local inclusive na virada do ano', () => {
    expect(localWeekKey(new Date(2027, 0, 3, 23, 59))).toBe('2026-12-28');
    expect(localWeekKey(new Date(2027, 0, 4, 0, 0))).toBe('2027-01-04');
    expect(isWeekKey('2026-12-28')).toBe(true);
  });
});

describe('reposição por séries, sem perda nem contagem dupla', () => {
  it('iniciar reserva sem remover; abandonar mantém integralmente a origem', () => {
    const pending = queue();
    const started = startRecoveryWorkout(pending, choices(pending), saturday).state;
    expect(started.recoveryItems).toEqual(pending.recoveryItems);
    expect(started.activeWorkout!.recoveryWeekStart).toBe('2026-10-19');
    expect(started.activeWorkout!.exercises[0].supersetGroup).toBeUndefined();
    expect(() => validateAppState(started)).not.toThrow();
    // The abandon action only clears activeWorkout, leaving the original queue intact.
    expect({ ...mark(started), activeWorkout: null }.recoveryItems).toEqual(pending.recoveryItems);
  });
  it('reposição parcial desconta uma única série e preserva semana, ID e rascunho', () => {
    const pending = queue();
    const original = pending.recoveryItems![0];
    let state = startRecoveryWorkout(pending, choices(pending), saturday).state;
    const exercise = state.activeWorkout!.exercises[0];
    state = updateActiveSet(state, exercise.exerciseId, exercise.sets[1].id, { reps: 8, weight: 42.25, rir: 2 });
    state = finish(mark(state), saturday);
    expect(savedRecoverySets(state.recoveryItems!)).toBe(21);
    const remaining = state.recoveryItems!.find((item) => item.id === original.id)!;
    expect(remaining).toMatchObject({ sourceWorkoutId: original.sourceWorkoutId, sourcePlanId: original.sourcePlanId, weekStart: original.weekStart });
    expect(remaining.exercise.sets[0]).toMatchObject({ id: original.exercise.sets[1].id, setNumber: 2, reps: 8, weight: 42.25, rir: 2, completed: false });
    expect(state.history[0]).toMatchObject({ recoveryWeekStart: original.weekStart, recoverySourcePlanIds: [original.sourcePlanId] });
    const next = startRecoveryWorkout(state, choices(state, 0, 1), new Date(2026, 9, 31, 19).toISOString()).state;
    const ended = finish(mark(next), new Date(2026, 9, 31, 20).toISOString());
    expect(savedRecoverySets(ended.recoveryItems!)).toBe(20);
    expect(ended.history[0].exercises[0].sets[0].setNumber).toBe(2);
    expect(ended.history[0].recoveryWeekStart).toBe('2026-10-19');
    expect(ended.recoveryItems!.every((item) => item.sourcePlanName !== 'Reposição de séries')).toBe(true);
    expect(() => validateAppState(ended)).not.toThrow();
  });
  it('encerrar reposição com zero séries não duplica fila nem histórico', () => {
    const pending = queue();
    const result = finish(startRecoveryWorkout(pending, choices(pending), saturday).state, saturday);
    expect(result.recoveryItems).toEqual(pending.recoveryItems);
    expect(result.history).toEqual([]);
  });
  it('reordenação e exercícios iguais de sessões distintas mantêm a origem correta', () => {
    let state = queue();
    state = finish(startWorkoutFromPlan(state, state.plans[0].id, monday).state);
    const originals = state.recoveryItems!.filter((item) => item.exercise.exerciseId === state.recoveryItems![0].exercise.exerciseId);
    const selection = originals.map((item) => ({ itemId: item.id, setIds: [item.exercise.sets[0].id] }));
    state = startRecoveryWorkout(state, selection, saturday).state;
    expect(new Set(state.activeWorkout!.exercises.map((item) => item.exerciseId)).size).toBe(2);
    state = moveActiveExercise(state, state.activeWorkout!.exercises[0].exerciseId, 1);
    state = deferActiveExercise(state, state.activeWorkout!.exercises[0].exerciseId);
    state = mark(state);
    const performedSource = state.activeWorkout!.exercises[0].sets[0].recoverySetId;
    const result = finish(state, saturday);
    expect(result.recoveryItems!.flatMap((item) => item.exercise.sets).some((set) => set.id === performedSource)).toBe(false);
    expect(savedRecoverySets(result.recoveryItems!)).toBe(43);
    expect(result.history[0].exercises[0].exerciseId).toBe(originals[0].exercise.exerciseId);
    expect(() => validateAppState(result)).not.toThrow();
  });
  it('desconta apenas os selecionados concluídos e permite terminar uma parte do item', () => {
    const pending = queue();
    let state = startRecoveryWorkout(pending, choices(pending, 0, 1), saturday).state;
    state = finish(mark(state), saturday);
    expect(state.recoveryItems![0].exercise.sets).toHaveLength(2);
    expect(savedRecoverySets(state.recoveryItems!)).toBe(21);
  });
  it('remove um item totalmente concluído sem alterar outros e restaura cargas pelo número original', () => {
    const pending = finish(mark(begin()), saturday);
    const item = pending.recoveryItems![0];
    let active = startRecoveryWorkout(pending, choices(pending, 0, 2), saturday).state;
    const exercise = active.activeWorkout!.exercises[0];
    active = updateActiveSet(active, exercise.exerciseId, exercise.sets[0].id, { weight: 42.25, reps: 8 });
    active = mark(mark(active), 0, 1);
    const result = finish(active, saturday);
    expect(result.recoveryItems!.some((entry) => entry.id === item.id)).toBe(false);
    expect(result.recoveryItems).toEqual(pending.recoveryItems!.slice(1));
    const normal = startWorkoutFromPlan(result, result.plans[0].id, saturday).workout;
    expect(normal.exercises[0].sets[1]).toMatchObject({ weight: 42.25, reps: 8 });
    expect(result.history[0].exercises[0].sets.map((set) => set.setNumber)).toEqual([2, 3]);
  });
  it('limpar pendência não inventa histórico e não libera ficha já registrada na semana', () => {
    let state = queue();
    for (const item of [...state.recoveryItems!]) state = discardRecoveryItem(state, item.id);
    expect(state.history).toEqual([]);
    expect(() => queueMissedWorkoutPlan(state, state.plans[0].id, saturday)).toThrow('já foi registrada');
  });
});

describe('seleções, registro manual e capacidade', () => {
  it('registra uma ficha inteira não realizada só uma vez por semana, sem histórico', () => {
    const state = queueMissedWorkoutPlan(seed(), seed().plans[2].id, monday);
    expect(savedRecoverySets(state.recoveryItems!)).toBe(21);
    expect(state.history).toEqual([]);
    expect(() => queueMissedWorkoutPlan(state, state.plans[2].id, saturday)).toThrow('já foi registrada');
    const next = queueMissedWorkoutPlan(state, state.plans[2].id, new Date(2026, 9, 26, 19).toISOString());
    expect(new Set(next.recoveryItems!.map((item) => item.weekStart)).size).toBe(2);
    expect(() => validateAppState(next)).not.toThrow();
  });
  it('não registra ficha ausente se há sessão ativa ou histórico da mesma semana', () => {
    expect(() => queueMissedWorkoutPlan(begin(), seed().plans[0].id, monday)).toThrow('Encerre');
    const recorded = finish(mark(begin()), saturday);
    recorded.recoveryItems = [];
    recorded.queuedMissedPlans = [];
    expect(() => queueMissedWorkoutPlan(recorded, recorded.plans[0].id, saturday)).toThrow('já foi registrada');
  });
  it('rejeita ID inexistente, seleção vazia, semanas misturadas e excesso de séries', () => {
    const state = queue();
    expect(() => chooseRecoveryItems(state, [])).toThrow('Selecione');
    expect(() => chooseRecoveryItems(state, [{ itemId: 'nada', setIds: ['x'] }])).toThrow('disponível');
    expect(() => chooseRecoveryItems(state, [{ itemId: state.recoveryItems![0].id, setIds: [] }])).toThrow('pelo menos');
    expect(() => chooseRecoveryItems(state, state.recoveryItems!.map((item) => ({ itemId: item.id, setIds: item.exercise.sets.map((set) => set.id) })))).toThrow('até 18');
    const mixed = queueMissedWorkoutPlan(state, state.plans[2].id, new Date(2026, 9, 26, 19).toISOString());
    expect(() => chooseRecoveryItems(mixed, [...choices(mixed), ...choices(mixed, mixed.recoveryItems!.length - 1, 1)])).toThrow('uma semana');
    expect(() => startRecoveryWorkout(begin(state), choices(state))).toThrow('Encerre');
  });
  it('deduplica seleção repetida e permite repor parte de um exercício com 20 séries', () => {
    const initial = seed();
    initial.plans[0].exercises = [{ ...initial.plans[0].exercises[0], targetSets: 20 }];
    const state = finish(begin(initial));
    const selection = choices(state, 0, 12);
    expect(chooseRecoveryItems(state, [...selection, ...selection])[0].sets).toHaveLength(12);
    expect(() => chooseRecoveryItems(state, choices(state, 0, 13))).toThrow('até 12');
    let active = startRecoveryWorkout(state, selection).state;
    for (let i = 0; i < 12; i += 1) active = mark(active, 0, i);
    const result = finish(active, saturday);
    expect(savedRecoverySets(result.recoveryItems!)).toBe(8);
    expect(result.recoveryItems![0].exercise.sets[0].setNumber).toBe(13);
  });
  it('soma o limite por exercício mesmo em itens de origens diferentes', () => {
    const initial = seed();
    initial.plans[0].exercises = [{ ...initial.plans[0].exercises[0], targetSets: 7 }];
    let state = finish(begin(initial));
    state = finish(begin(state));
    const selected = state.recoveryItems!.map((item) => ({ itemId: item.id, setIds: item.exercise.sets.map((set) => set.id) }));
    expect(() => chooseRecoveryItems(state, selected)).toThrow('até 12');
  });
  it('não prende uma sessão com fila cheia: permite liberar itens não reservados', () => {
    const sample = queue().recoveryItems![0];
    const items: RecoveryItem[] = Array.from({ length: MAX_SAVED_RECOVERY_ITEMS }, (_, index) => ({ ...sample, id: `item-${index}`, exercise: { ...sample.exercise, sets: [{ ...sample.exercise.sets[0], id: `source-${index}` }] } }));
    const active = begin({ ...seed(), recoveryItems: items });
    expect(() => finish(active)).toThrow('fila está cheia');
    expect(remainingSetCount(active.activeWorkout!)).toBe(22);
    let smaller = active;
    for (const item of items.slice(0, active.activeWorkout!.exercises.length)) smaller = discardRecoveryItem(smaller, item.id);
    expect(() => validateAppState(finish(smaller))).not.toThrow();
    const recovering = startRecoveryWorkout({ ...seed(), recoveryItems: items }, [{ itemId: items[0].id, setIds: [items[0].exercise.sets[0].id] }]).state;
    expect(() => discardRecoveryItem(recovering, items[0].id)).toThrow('reservada');
    expect(discardRecoveryItem(recovering, items[1].id).activeWorkout).toEqual(recovering.activeWorkout);
  });
  it('classifica somente músculos explícitos, sem contar auxiliares', () => {
    const items = queue().recoveryItems!;
    const grouped = recoveryByMuscle(items);
    expect(grouped.reduce((sum, item) => sum + item.sets, 0)).toBe(22);
    expect(recoveryByMuscle([{ ...items[0], exercise: { ...items[0].exercise, muscleGroup: undefined } }])).toEqual([]);
  });
});

describe('backup, validação e persistência das reservas', () => {
  it('aceita estado antigo sem novos campos', () => {
    const state = seed();
    delete state.recoveryItems;
    delete state.queuedMissedPlans;
    expect(() => validateAppState(state)).not.toThrow();
  });
  it.each(['week', 'duplicate-item', 'duplicate-set', 'completed', 'nested', 'ledger'])('rejeita fila corrompida: %s', (kind) => {
    const state = queue();
    const item = state.recoveryItems![0];
    if (kind === 'week') item.weekStart = '2026-10-20';
    if (kind === 'duplicate-item') state.recoveryItems!.push(structuredClone(item));
    if (kind === 'duplicate-set') item.exercise.sets[1].id = item.exercise.sets[0].id;
    if (kind === 'completed') item.exercise.sets[0].completed = true;
    if (kind === 'nested') item.exercise.sets[0].recoveryItemId = 'x';
    if (kind === 'ledger') state.queuedMissedPlans = ['2026-02-30::plan'];
    expect(() => validateAppState(state)).toThrow();
  });
  it.each(['missing', 'forged', 'duplicate', 'identity', 'completion', 'number', 'muscle'])('rejeita reserva corrompida: %s', (kind) => {
    const pending = queue();
    const state = startRecoveryWorkout(pending, [...choices(pending), ...choices(pending, 1, 1)]).state;
    const workout = state.activeWorkout!;
    if (kind === 'missing') state.recoveryItems = [];
    if (kind === 'forged') workout.exercises[0].sets[0].recoverySetId = 'x';
    if (kind === 'duplicate') workout.exercises[0].sets[1].recoverySetId = workout.exercises[0].sets[0].recoverySetId;
    if (kind === 'identity') workout.exercises[1].exerciseId = workout.exercises[0].exerciseId;
    if (kind === 'completion') { workout.exercises[0].sets[0].completed = true; workout.exercises[0].sets[0].reps = 0; }
    if (kind === 'number') workout.exercises[0].sets[0].setNumber = 20;
    if (kind === 'muscle') workout.exercises[0].muscleGroup = 'biceps';
    expect(() => validateAppState(state)).toThrow();
  });
  it('restaura sessão e reserva no reload; backup inclui fila e importação preserva origem', async () => {
    const pending = queue();
    const active = mark(startRecoveryWorkout(pending, choices(pending), saturday).state);
    await saveState(active);
    const reloaded = await loadState();
    expect(reloaded.activeWorkout).toEqual(active.activeWorkout);
    expect(reloaded.recoveryItems).toEqual(pending.recoveryItems);
    const backup = await exportState();
    await saveState(seed());
    const imported = await importState(backup);
    expect(imported.recoveryItems).toEqual(pending.recoveryItems);
    expect(imported.activeWorkout).toEqual(active.activeWorkout);
    const finished = finish(imported, saturday);
    await saveState(finished, 'Antes de encerrar sessão e guardar pendências');
    expect((await readSafetySnapshot())?.value.activeWorkout).toEqual(active.activeWorkout);
    expect(savedRecoverySets((await loadState()).recoveryItems!)).toBe(21);
    const invalid = structuredClone(finished);
    invalid.recoveryItems![0].weekStart = 'falso';
    await expect(importState(invalid)).rejects.toThrow();
    expect((await loadState()).recoveryItems).toEqual(finished.recoveryItems);
  });
  it('uma transação abortada mantém no disco a sessão e todas as pendências anteriores', async () => {
    const pending = queue();
    const active = mark(startRecoveryWorkout(pending, choices(pending), saturday).state);
    await saveState(active);
    // Fail only the next write transaction, not the readonly verification afterwards.
    const transaction = IDBDatabase.prototype.transaction;
    const spy = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args: Parameters<IDBDatabase['transaction']>) {
      const result = transaction.apply(this, args);
      if (args[1] === 'readwrite') queueMicrotask(() => result.abort());
      return result;
    });
    await expect(saveState(finish(active, saturday))).rejects.toThrow();
    spy.mockRestore();
    const restored = await loadState();
    expect(restored.activeWorkout).toEqual(active.activeWorkout);
    expect(restored.recoveryItems).toEqual(pending.recoveryItems);
    expect(restored.history).toEqual([]);
  });
});
