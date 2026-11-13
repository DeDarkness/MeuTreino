import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeedState, loadStateVersioned, saveStateVersioned, exportState, listProgressPhotos, addProgressPhoto, deleteProgressPhoto, readSafetySnapshot } from './database';
import { applyFullBodyProtocol, createVTaperPlans, createWeeklyWorkoutPlans, upgradeEliteProtocol } from './starterPlans';
import { makeProgressArchive, mergeProgressArchive, readProgressArchive } from './progressArchive';
import { startWorkoutFromPlan } from './workout';
import type { ProgressPhoto } from './progressPhotos';
import type { BodyMeasurement } from '../nutrition/types';
import { emptyNutrition } from '../nutrition/engine';

beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

describe('Full Body V-Taper', () => {
  it.each([3, 4])('ativa 74 séries para a ficha original salva na versão de protocolo %s', async (version) => {
    const before = createSeedState();
    before.eliteProtocolVersion = version;
    before.preferences.soundEnabled = false;
    const custom = { ...before.plans[0], id: 'ficha-pessoal', name: 'Treino pessoal' };
    before.plans.push(custom);
    await saveStateVersioned(before);
    const { state, revision } = await loadStateVersioned();
    expect(state.plans.slice(0, 3).map((plan) => plan.exercises.reduce((sum, item) => sum + item.targetSets, 0))).toEqual([24, 26, 24]);
    expect(state.plans[0].exercises[1].name).toBe('Remada curvada com barra');
    expect(state.plans[2].exercises[0].name).toBe('Remada baixa na polia com corda');
    expect(state.plans[3]).toEqual(custom);
    expect(state.preferences).toEqual(before.preferences);
    expect((await readSafetySnapshot())?.value.plans).toEqual(before.plans);
    expect((await loadStateVersioned()).revision).toBe(revision);
  });

  it('mantém a etapa de 70 séries e fichas padrão personalizadas', () => {
    const original = createSeedState();
    original.eliteProtocolVersion = 4;
    original.plans[1].notes = 'Minha anotação';
    expect(upgradeEliteProtocol(original).plans).toEqual(original.plans);
    const transition = applyFullBodyProtocol(createSeedState(), 70);
    transition.eliteProtocolVersion = 4;
    expect(upgradeEliteProtocol(transition).plans).toEqual(transition.plans);
  });

  it('abre a ficha completa em uma instalação nova', async () => {
    const { state } = await loadStateVersioned();
    expect(state.plans.flatMap((plan) => plan.exercises).reduce((sum, item) => sum + item.targetSets, 0)).toBe(74);
  });

  it.each([[66, [22, 23, 21]], [70, [23, 25, 22]], [74, [24, 26, 24]]] as const)('valida séries da etapa %s', (stage, totals) => {
    const plans = createVTaperPlans(stage);
    expect(plans.map((plan) => plan.exercises.reduce((sum, item) => sum + item.targetSets, 0))).toEqual(totals);
  });

  it('valida ordem, volumes diretos, superséries e séries unilaterais', () => {
    const [a, b, c] = createVTaperPlans(74);
    expect(a.exercises.map((item) => item.id)).toEqual([
      'full-body-a-puxada-neutra', 'vtaper-a-remada-curvada-barra', 'terca-hack', 'segunda-supino-inclinado-halteres', 'sexta-stiff',
      'segunda-elevacao-lateral', 'quarta-rosca-direta-halter', 'sabado-frances-polia', 'vtaper-a-scott', 'vtaper-a-testa',
      'terca-panturrilha', 'full-body-a-abdomen',
    ]);
    expect(b.exercises.map((item) => item.id)).toEqual([
      'terca-leg-press', 'quarta-puxada-alta', 'segunda-supino-reto', 'vtaper-b-peck-deck', 'sexta-cadeira-flexora', 'quinta-desenvolvimento',
      'quinta-fly-reverso', 'b-elevacao-lateral', 'full-body-b-rosca-polia', 'vtaper-b-rosca-inclinada',
      'full-body-b-triceps-corda', 'full-body-b-abdomen', 'b-panturrilha-sentado',
    ]);
    expect(c.exercises.map((item) => item.id)).toEqual([
      'vtaper-c-remada-baixa-corda', 'terca-bulgaro', 'segunda-supino-declinado', 'vtaper-c-pulldown-inclinado', 'sexta-cadeira-flexora', 'terca-cadeira-extensora',
      'vtaper-c-inverso', 'quinta-elevacao-lateral-polia', 'sabado-martelo', 'sabado-barra-w', 'vtaper-c-rosca-unilateral',
      'vtaper-c-testa-polia', 'sexta-panturrilha',
    ]);
    const byMuscle = new Map<string, number>();
    for (const { muscleGroup, targetSets } of [a, b, c].flatMap((plan) => plan.exercises)) {
      const key = muscleGroup ?? '';
      byMuscle.set(key, (byMuscle.get(key) ?? 0) + targetSets);
    }
    expect(Object.fromEntries(byMuscle)).toEqual({
      costas: 12, peito: 10, biceps: 9, triceps: 8, ombros: 7, deltoide_posterior: 3, quadriceps: 9,
      posterior: 6, panturrilhas: 6, core: 4,
    });
    expect(a.exercises.slice(6, 8).map((item) => item.supersetGroup)).toEqual(['A', 'A']);
    expect(c.exercises.slice(8, 10).map((item) => item.supersetGroup)).toEqual(['C', 'C']);
    expect(a.exercises[1]).toMatchObject({ targetSets: 2, minReps: 8, targetReps: 12, restSeconds: 120, targetRirMin: 2, targetRirMax: 2, notes: expect.stringContaining('120 a 150 s') });
    expect(a.exercises[4]).toEqual(createWeeklyWorkoutPlans().flatMap((plan) => plan.exercises).find((item) => item.id === 'sexta-stiff'));
    expect(c.exercises[0]).toMatchObject({ targetSets: 3, minReps: 8, targetReps: 12, restSeconds: 120, targetRirMin: 2, targetRirMax: 2, notes: expect.stringContaining('banco reto') });
    expect(c.exercises[3]).toMatchObject({ targetSets: 2, minReps: 10, targetReps: 15, restSeconds: 90, targetRirMin: 1, targetRirMax: 2, notes: expect.stringContaining('45°') });
  });

  it('atualiza as fichas V-Taper gravadas e preserva as sessões e as cargas antigas', async () => {
    const before = createSeedState();
    const [a, b, c] = createVTaperPlans(74);
    const [baseA, , baseC] = createWeeklyWorkoutPlans();
    const oldRow = baseA.exercises.find((item) => item.id === 'quarta-remada-maquina')!;
    const oldCRow = baseC.exercises.find((item) => item.id === 'quarta-serrote')!;
    const oldPulldown = baseC.exercises.find((item) => item.id === 'quarta-pulldown')!;
    const customHack = { ...a.exercises[2], loadIncrementKg: 5 };
    before.eliteProtocolVersion = 3;
    before.plans = [
      { ...a, exercises: [a.exercises[0], customHack, oldRow, ...a.exercises.slice(3)] },
      b,
      { ...c, exercises: [oldCRow, c.exercises[1], c.exercises[2], oldPulldown, ...c.exercises.slice(4)] },
    ];
    before.history = [{
      id: 'treino-teste', planId: a.id, planName: a.name, startedAt: a.createdAt, finishedAt: a.createdAt, durationSeconds: 3600,
      exercises: [{ exerciseId: oldRow.id, exerciseName: oldRow.name, sets: [{ id: 'serie-teste', setNumber: 1, reps: 10, weight: 45, rir: 2, completedAt: a.createdAt }] }],
    }];
    const active = startWorkoutFromPlan(before, a.id).state;
    expect(upgradeEliteProtocol(active)).toBe(active);
    const saved = await saveStateVersioned(before);
    const { state } = await loadStateVersioned();
    expect(state.history).toEqual(saved.state.history);
    expect(state.preferences).toEqual(saved.state.preferences);
    expect(state.recoveryItems).toEqual(saved.state.recoveryItems);
    expect(state.plans[0].exercises[2]).toEqual(customHack);
    expect(state.plans[1]).toEqual(b);
    expect(state.plans[2].exercises).toEqual(c.exercises);
    expect((await readSafetySnapshot())?.value.plans).toEqual(saved.state.plans);
    expect(upgradeEliteProtocol(state)).toBe(state);
    expect(startWorkoutFromPlan(state, a.id).workout.exercises[1].sets[0].weight).toBeNull();
  });

  it('preserva ficha editada, histórico e pendências ao trocar manualmente', () => {
    const state = createSeedState();
    state.plans[0].name = 'Minha ficha pessoal';
    const active = startWorkoutFromPlan(state, state.plans[0].id).state;
    expect(() => applyFullBodyProtocol(active, 74)).toThrow('sessão atual');
    const applied = applyFullBodyProtocol(state, 74);
    expect(applied.plans[3].name).toContain('Minha ficha pessoal');
    expect(applied.history).toBe(state.history);
    expect(applied.recoveryItems).toBe(state.recoveryItems);
    const returned = applyFullBodyProtocol(applied, 66);
    expect(returned.plans).toHaveLength(4);
    expect(returned.plans[0].exercises[0].id).toBe('terca-hack');
  });
});

const date = '2026-11-11';
const at = `${date}T12:00:00.000Z`;
const assessment: BodyMeasurement = {
  id: 'legacy-id', date, weightKg: 97.6, waistCm: null, hipCm: null, armCm: 36.5,
  chestCm: null, thighCm: null, calfCm: null, bodyFat: null, method: '', notes: '',
};
const binary = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
const photo: ProgressPhoto = {
  id: '3d366df0-41fb-4a81-9b36-51233b1cc26b', date, pose: 'front', notes: '', measurementId: assessment.id,
  createdAt: at, updatedAt: at, width: 2, height: 2, image: binary, thumbnail: binary,
};

describe('backup e dados corporais offline', () => {
  it('migra o IndexedDB v2 sem substituir seu histórico, sessão ativa ou medidas', async () => {
    const base = createSeedState(at);
    const training = startWorkoutFromPlan(base, base.plans[0].id, at).state;
    const saved = { ...training, nutrition: { ...emptyNutrition(), measurements: [assessment] } };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('meutreino', 2);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('state', { keyPath: 'id' }).add({ id: 'app-state', value: saved });
        request.result.createObjectStore('wallpaper', { keyPath: 'id' });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { request.result.close(); resolve(); };
    });
    const loaded = await loadStateVersioned();
    expect(loaded.state).toEqual(saved);
    expect(await listProgressPhotos()).toEqual([]);
  });

  it('preserva a medida legada, permite duas avaliações no mesmo dia e restaura fotos num banco vazio', async () => {
    const base = await loadStateVersioned();
    const nutrition = { ...emptyNutrition(), measurements: [assessment, { ...assessment, id: 'assessment-2', weightKg: null, shoulderCm: 120, measuredAt: at }] };
    await saveStateVersioned({ ...base.state, nutrition }, { expectedRevision: base.revision });
    await addProgressPhoto(photo);
    const archive = await makeProgressArchive(await exportState(), true);
    const preview = await readProgressArchive(archive);
    expect(preview.state.nutrition?.measurements).toEqual(nutrition.measurements);
    expect(preview.photos).toHaveLength(1);

    vi.stubGlobal('indexedDB', new IDBFactory());
    const empty = await loadStateVersioned();
    const saved = await saveStateVersioned(preview.state, { expectedRevision: empty.revision, addPhotos: preview.photos });
    await saveStateVersioned(saved.state, { expectedRevision: saved.revision, addPhotos: preview.photos });
    expect((await listProgressPhotos()).map((item) => item.id)).toEqual([photo.id]);
    expect((await loadStateVersioned()).state.nutrition?.measurements).toEqual(nutrition.measurements);
    await deleteProgressPhoto(photo.id);
    expect(await listProgressPhotos()).toEqual([]);
  });

  it('preserva registros locais de mesmo ID durante a importação aditiva', () => {
    const current = createSeedState();
    current.nutrition = { ...emptyNutrition(), measurements: [assessment] };
    const imported = { ...current, nutrition: { ...current.nutrition, measurements: [
      { ...assessment, weightKg: 100 }, { ...assessment, id: 'second' },
    ] } };
    expect(mergeProgressArchive(current, imported).nutrition?.measurements).toEqual([assessment, { ...assessment, id: 'second' }]);
  });
});
