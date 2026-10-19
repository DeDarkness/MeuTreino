import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { clearSafetySnapshot, createSeedState, exportSafetySnapshot, importState, loadState, readSafetySnapshot, saveState, validateAppState } from './database';
import { completeActiveSet, finishActiveWorkout, startWorkoutFromPlan, getRestTarget, selectActiveSet } from './workout';

beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

describe('proteção do histórico e compatibilidade', () => {
  it('preserva o estado anterior atomicamente durante uma importação', async () => {
    const previous = createSeedState();
    previous.plans[0].name = 'Minha ficha pessoal';
    await saveState(previous);
    const replacement = createSeedState();
    replacement.preferences.weeklyPlanModes = { 'plan-full-body-b': 'express' };
    replacement.preferences.reduceMotion = true;
    await importState(JSON.stringify({ app: 'MeuTreino', backupVersion: 1, exportedAt: new Date().toISOString(), state: replacement }));
    expect((await loadState()).preferences.reduceMotion).toBe(true);
    expect((await readSafetySnapshot())?.value.plans[0].name).toBe('Minha ficha pessoal');
    const backup = JSON.parse(await exportSafetySnapshot());
    expect(backup.state.plans[0].name).toBe('Minha ficha pessoal');
    expect(backup.app).toBe('MeuTreino');
  });
  it('um arquivo inválido não altera os dados nem a cópia anterior', async () => {
    const previous = await saveState(createSeedState());
    await expect(importState('{nao e json')).rejects.toThrow();
    await expect(importState({ ...previous, preferences: { ...previous.preferences, reduceMotion: 'sim' } })).rejects.toThrow();
    expect((await loadState()).plans).toEqual(previous.plans);
    expect(await readSafetySnapshot()).toBeNull();
  });
  it('faz cópia antes de uma exclusão e pode remover essa cópia explicitamente', async () => {
    const previous = await saveState(createSeedState());
    await saveState({ ...previous, plans: [] }, 'Antes de excluir uma ficha');
    expect((await readSafetySnapshot())?.value.plans).toHaveLength(3);
    await clearSafetySnapshot();
    expect(await readSafetySnapshot()).toBeNull();
  });
  it('aceita backups antigos sem os novos campos opcionais', () => {
    expect(validateAppState(createSeedState()).schemaVersion).toBe(1);
  });
  it.each([0, -1, Infinity, NaN, 101])('rejeita incremento de carga inválido: %s', (loadIncrementKg) => {
    const state = createSeedState();
    state.plans[0].exercises[0].loadIncrementKg = loadIncrementKg;
    expect(() => validateAppState(state)).toThrow();
  });
  it('rejeita modos inválidos sem substituir a preferência atual', () => {
    const state = createSeedState();
    const invalid = { ...state, preferences: { ...state.preferences, weeklyPlanModes: { a: 'qualquer' } } };
    expect(() => validateAppState(invalid)).toThrow();
  });
  it('registra modo e grupo muscular como fotografia da sessão concluída', () => {
    const seed = createSeedState();
    const started = startWorkoutFromPlan(seed, seed.plans[0].id).state;
    const exercise = started.activeWorkout!.exercises[0];
    const completed = completeActiveSet(started, exercise.exerciseId, exercise.sets[0].id);
    const result = finishActiveWorkout(completed).history;
    expect(result.trainingMode).toBe('complete');
    expect(result.exercises[0].muscleGroup).toBe('quadriceps');
  });
  it('não deixa concluir uma série com zero repetições', () => {
    const seed = createSeedState();
    const started = startWorkoutFromPlan(seed, seed.plans[0].id).state;
    const exercise = started.activeWorkout!.exercises[0];
    exercise.sets[0].reps = 0;
    expect(() => completeActiveSet(started, exercise.exerciseId, exercise.sets[0].id)).toThrow('repetição');
  });
  it('editar uma série concluída não muda o aviso para uma série já realizada', () => {
    const seed = createSeedState();
    const started = startWorkoutFromPlan(seed, seed.plans[0].id).state;
    const exercise = started.activeWorkout!.exercises[0];
    const completed = completeActiveSet(started, exercise.exerciseId, exercise.sets[0].id);
    const editing = selectActiveSet(completed, exercise.exerciseId, exercise.sets[0].id);
    expect(getRestTarget(editing.activeWorkout!)?.set.setNumber).toBe(2);
    expect(editing.activeWorkout!.restEndsAt).toBe(completed.activeWorkout!.restEndsAt);
  });
});
