import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { clearSafetySnapshot, createSeedState, exportSafetySnapshot, exportState, importState, loadState, loadStateVersioned, readSafetySnapshot, saveState, saveStateVersioned, StorageConflictError, validateAppState } from './database';
import { addRestTime, clearExpiredRest, completeActiveSet, finishActiveWorkout, startWorkoutFromPlan, getRestTarget, selectActiveSet, logActiveSet } from './workout';
import { createWriteQueue } from './writeQueue';

beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('proteção do histórico e compatibilidade', () => {
  it('reverte dados e checkpoint quando uma escrita falha por falta de espaço', async () => {
    const first = await saveState(createSeedState());
    const baseline = await saveStateVersioned({ ...first, preferences: { ...first.preferences, reduceMotion: true } }, { checkpointLabel: 'Checkpoint antigo' });
    const checkpoint = await readSafetySnapshot();
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (value.id === 'app-state') throw new DOMException('Sem espaço', 'QuotaExceededError');
      return put.call(this, value, key);
    });
    await expect(saveStateVersioned(first, { expectedRevision: baseline.revision, checkpointLabel: 'Novo checkpoint' })).rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(await loadStateVersioned()).toEqual(baseline);
    expect(await readSafetySnapshot()).toEqual(checkpoint);
  });

  it('aceita uma única gravação concorrente e rejeita a revisão vencida', async () => {
    const baseline = await loadStateVersioned();
    const writes = ['Minha ficha 1', 'Minha ficha 2'].map((name) => {
      const state = structuredClone(baseline.state);
      state.plans[0].name = name;
      return saveStateVersioned(state, { expectedRevision: baseline.revision, checkpointLabel: 'Antes de editar' });
    });
    const result = await Promise.allSettled(writes);
    const successful = result.filter((item) => item.status === 'fulfilled');
    expect(successful).toHaveLength(1);
    expect(result.find((item) => item.status === 'rejected')?.reason).toBeInstanceOf(StorageConflictError);
    expect(await loadStateVersioned()).toEqual(successful[0].value);
    expect((await readSafetySnapshot())?.value).toEqual(baseline.state);
  });

  it('cancela ações enfileiradas depois de uma falha e permite uma tentativa nova', async () => {
    const queue = createWriteQueue();
    const action = vi.fn(async () => 'confirmado');
    const failure = queue.run(async () => { throw new Error('Sem espaço'); });
    const canceled = queue.run(action);
    expect(queue.busy).toBe(true);
    await expect(failure).rejects.toThrow('Sem espaço');
    await expect(canceled).rejects.toThrow('cancelada');
    await queue.idle();
    expect(action).not.toHaveBeenCalled();
    expect(queue.busy).toBe(false);
    await expect(queue.run(action)).resolves.toBe('confirmado');
  });

  it('recupera uma série de um backup antigo com descanso absoluto e rejeita corrupção do novo', async () => {
    const initial = createSeedState();
    const started = startWorkoutFromPlan(initial, initial.plans[0].id).state;
    const exercise = started.activeWorkout!.exercises[0];
    const set = exercise.sets[0];
    const logged = logActiveSet(started, exercise.exerciseId, set.id, { reps: 9, weight: 25, rir: 2 });
    const oldBackup = { app: 'MeuTreino', backupVersion: 1, exportedAt: new Date().toISOString(), state: logged };
    await importState(JSON.stringify(oldBackup));
    const reopened = await loadStateVersioned();
    const workout = reopened.state.activeWorkout!;
    expect(workout.exercises[0].sets[0]).toMatchObject({ completed: true, reps: 9, weight: 25, rir: 2 });
    expect(logActiveSet(reopened.state, exercise.exerciseId, set.id, { reps: 99 })).toBe(reopened.state);
    const deadline = workout.restEndsAt!;
    expect(deadline).toBe(logged.activeWorkout!.restEndsAt);
    expect(clearExpiredRest(reopened.state, workout.id, deadline, Date.parse(deadline) - 1)).toBe(reopened.state);
    const extended = addRestTime(reopened.state, 15, new Date(Date.parse(deadline) - 1000));
    expect(clearExpiredRest(extended, workout.id, deadline, Date.parse(deadline))).toBe(extended);
    expect(clearExpiredRest(reopened.state, workout.id, deadline, Date.parse(deadline) + 60_000).activeWorkout?.restEndsAt).toBeNull();
    const backup = JSON.parse(await exportState());
    expect(backup.stateSha256).toMatch(/^[a-f0-9]{64}$/);
    backup.state.activeWorkout.exercises[0].sets[0].weight = 99;
    await expect(importState(JSON.stringify(backup))).rejects.toThrow('integridade');
    expect(await loadStateVersioned()).toEqual(reopened);
  });
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
