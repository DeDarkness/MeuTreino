import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeedState, loadStateVersioned, saveStateVersioned, exportState, listProgressPhotos, addProgressPhoto, deleteProgressPhoto } from './database';
import { applyFullBodyProtocol, createVTaperPlans } from './starterPlans';
import { makeProgressArchive, mergeProgressArchive, readProgressArchive } from './progressArchive';
import { startWorkoutFromPlan } from './workout';
import type { ProgressPhoto } from './progressPhotos';
import type { BodyMeasurement } from '../nutrition/types';
import { emptyNutrition } from '../nutrition/engine';

beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

describe('Full Body V-Taper', () => {
  it.each([[66, [22, 23, 21]], [70, [23, 25, 22]], [74, [24, 26, 24]]] as const)('valida séries da etapa %s', (stage, totals) => {
    const plans = createVTaperPlans(stage);
    expect(plans.map((plan) => plan.exercises.reduce((sum, item) => sum + item.targetSets, 0))).toEqual(totals);
  });

  it('valida ordem, volumes diretos, superséries e séries unilaterais', () => {
    const [a, b, c] = createVTaperPlans(74);
    expect(a.exercises.map((item) => item.id)).toEqual([
      'full-body-a-puxada-neutra', 'terca-hack', 'quarta-remada-maquina', 'segunda-supino-inclinado-halteres', 'sexta-stiff',
      'segunda-elevacao-lateral', 'quarta-rosca-direta-halter', 'sabado-frances-polia', 'vtaper-a-scott', 'vtaper-a-testa',
      'terca-panturrilha', 'full-body-a-abdomen',
    ]);
    expect(b.exercises.map((item) => item.id)).toEqual([
      'terca-leg-press', 'quarta-puxada-alta', 'segunda-supino-reto', 'vtaper-b-peck-deck', 'sexta-cadeira-flexora', 'quinta-desenvolvimento',
      'quinta-fly-reverso', 'b-elevacao-lateral', 'full-body-b-rosca-polia', 'vtaper-b-rosca-inclinada',
      'full-body-b-triceps-corda', 'full-body-b-abdomen', 'b-panturrilha-sentado',
    ]);
    expect(c.exercises.map((item) => item.id)).toEqual([
      'quarta-serrote', 'terca-bulgaro', 'segunda-supino-declinado', 'quarta-pulldown', 'sexta-cadeira-flexora', 'terca-cadeira-extensora',
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
    expect(c.exercises[0]).toMatchObject({ targetSets: 3, notes: expect.stringContaining('ambos os lados') });
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
