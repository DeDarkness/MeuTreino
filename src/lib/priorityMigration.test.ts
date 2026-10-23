import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSeedState, loadState, readSafetySnapshot, saveState, validateAppState } from './database';
import { ELITE_PROTOCOL_VERSION, upgradeEliteProtocol } from './starterPlans';
import { plannedSets, weeklyMuscleVolumes } from './trainingModes';
import { completeActiveSet, finishActiveWorkout, startWorkoutFromPlan } from './workout';

const newIds = ['full-body-a-puxada-neutra', 'full-body-b-rosca-polia', 'full-body-b-triceps-corda'];
const previousState = () => {
  const state = createSeedState();
  state.eliteProtocolVersion = 2;
  state.plans = state.plans.map((plan) => {
    const exercises = plan.exercises.filter((item) => !newIds.includes(item.id));
    const sets = exercises.reduce((sum, item) => sum + item.targetSets, 0);
    return { ...plan, exercises, notes: plan.notes?.replace(/\d+ séries/, `${sets} séries`) };
  });
  return state;
};

afterEach(() => vi.unstubAllGlobals());

describe('prioridade em costas e braços', () => {
  it('acrescenta somente as seis séries combinadas na ficha padrão', () => {
    const state = createSeedState();
    expect(state.plans.map(plannedSets)).toEqual([22, 23, 21]);
    expect(state.plans.map((plan) => plan.exercises.length)).toEqual([10, 11, 10]);
    const additions = state.plans.flatMap((plan) => plan.exercises).filter((item) => newIds.includes(item.id));
    expect(additions).toHaveLength(3);
    expect(additions.map((item) => [item.targetSets, item.minReps, item.targetReps, item.restSeconds, item.targetRirMin]))
      .toEqual([[2, 10, 12, 120, 2], [2, 10, 15, 90, 2], [2, 10, 15, 90, 2]]);
    const volumes = Object.fromEntries(weeklyMuscleVolumes(state.plans).map((item) => [item.muscle, item.sets]));
    expect(volumes).toMatchObject({ costas: 12, biceps: 6, triceps: 6, peito: 8, quadriceps: 9, core: 4 });
  });

  it('migra a versão 2 preservando edições, ordem relativa, histórico e sexta-feira', () => {
    const old = previousState();
    old.plans[0].name = 'Meu A';
    old.plans[0].notes = 'Minha observação pessoal';
    old.plans[0].exercises[0].loadIncrementKg = 1.25;
    const next = upgradeEliteProtocol(old);
    expect(next.eliteProtocolVersion).toBe(ELITE_PROTOCOL_VERSION);
    expect(next.plans[0].name).toBe('Meu A');
    expect(next.plans[0].notes).toBe('Minha observação pessoal');
    expect(next.plans[0].exercises.filter((item) => !newIds.includes(item.id))).toEqual(old.plans[0].exercises);
    expect(next.plans[1].exercises.filter((item) => !newIds.includes(item.id))).toEqual(old.plans[1].exercises);
    expect(next.plans[2]).toBe(old.plans[2]);
    expect(next.history).toBe(old.history);
    expect(next.preferences).toBe(old.preferences);
    expect(old.plans.map(plannedSets)).toEqual([20, 19, 21]);
    expect(next.plans[1].notes).toContain('23 séries');
    expect(validateAppState(next)).toBe(next);
  });

  it('insere a puxada após a remada e braços antes do core nas fichas originais', () => {
    const next = upgradeEliteProtocol(previousState());
    const mondayIds = next.plans[0].exercises.map((item) => item.id);
    const wednesdayIds = next.plans[1].exercises.map((item) => item.id);
    expect(mondayIds.indexOf(newIds[0])).toBe(mondayIds.indexOf('quarta-remada-maquina') + 1);
    expect(wednesdayIds.indexOf(newIds[2])).toBe(wednesdayIds.indexOf(newIds[1]) + 1);
    expect(wednesdayIds.indexOf(newIds[2])).toBeLessThan(wednesdayIds.indexOf('full-body-b-abdomen'));
  });

  it('não duplica acréscimos já presentes por ID ou nome e preserva seus parâmetros', () => {
    const old = previousState();
    const defaults = createSeedState();
    const pull = defaults.plans[0].exercises.find((item) => item.id === newIds[0])!;
    const curl = defaults.plans[1].exercises.find((item) => item.id === newIds[1])!;
    old.plans[0].exercises.push({ ...pull, name: 'Puxada que personalizei', targetSets: 4 });
    old.plans[1].exercises.push({ ...curl, id: 'rosca-manual', name: '  ROSCA DIRETA NA POLIA  ', restSeconds: 100 });
    const next = upgradeEliteProtocol(old);
    expect(next.plans[0].exercises).toBe(old.plans[0].exercises);
    expect(next.plans[0].notes).toContain('24 séries');
    expect(next.plans[0].exercises.filter((item) => item.id === newIds[0])).toHaveLength(1);
    expect(next.plans[1].exercises.some((item) => item.id === newIds[1])).toBe(false);
    expect(next.plans[1].exercises.find((item) => item.id === 'rosca-manual')?.restSeconds).toBe(100);
    expect(next.plans[1].exercises.filter((item) => item.id === newIds[2])).toHaveLength(1);
  });

  it('encadeia a versão 1 até a atual em uma única atualização, incluindo o crunch', () => {
    const old = previousState();
    old.eliteProtocolVersion = 1;
    const core = old.plans[0].exercises.at(-1)!;
    core.id = 'pre-pallof'; core.name = 'Pallof press (antirrotação)';
    core.notes = 'Meta: 10–15 repetições · RIR 2 · cada lado; sem dor';
    const next = upgradeEliteProtocol(old);
    expect(next.eliteProtocolVersion).toBe(ELITE_PROTOCOL_VERSION);
    expect(next.plans.map(plannedSets)).toEqual([22, 23, 21]);
    expect(next.plans[0].exercises.at(-1)!.name).toBe('Crunch abdominal na polia');
    expect(next.plans[0].exercises.at(-1)!.notes).not.toContain('cada lado');
    expect(upgradeEliteProtocol(next)).toBe(next);
  });

  it('aguarda a sessão terminar e mantém a fotografia do treino realizado', () => {
    const old = previousState();
    let active = startWorkoutFromPlan(old, old.plans[0].id).state;
    const first = active.activeWorkout!.exercises[0];
    active = completeActiveSet(active, first.exerciseId, first.sets[0].id);
    expect(upgradeEliteProtocol(active)).toBe(active);
    expect(active.activeWorkout!.exercises.reduce((sum, item) => sum + item.sets.length, 0)).toBe(20);
    const finished = finishActiveWorkout(active);
    const next = upgradeEliteProtocol(finished.state);
    expect(next.history).toBe(finished.state.history);
    expect(next.history[0].exercises[0].sets).toHaveLength(1);
    expect(startWorkoutFromPlan(next, old.plans[0].id).workout.exercises.reduce((sum, item) => sum + item.sets.length, 0)).toBe(22);
  });

  it('não reaplica após edições e não recria fichas apagadas ou altera arquivos pessoais', () => {
    const old = previousState();
    const personal = { ...old.plans[0], id: 'plan-arquivo-pessoal' };
    old.plans = [old.plans[0], old.plans[2], personal];
    const next = upgradeEliteProtocol(old);
    expect(next.plans).toHaveLength(3);
    expect(next.plans[2]).toBe(personal);
    expect(next.plans.some((plan) => plan.id === 'plan-full-body-b')).toBe(false);
    next.plans[0].exercises = next.plans[0].exercises.filter((item) => item.id !== newIds[0]);
    expect(upgradeEliteProtocol(next)).toBe(next);
    expect(next.plans[0].exercises.some((item) => item.id === newIds[0])).toBe(false);
  });

  it('guarda checkpoint anterior antes de atualizar o IndexedDB instalado', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    await saveState(previousState());
    const loaded = await loadState();
    expect(loaded.plans.map(plannedSets)).toEqual([22, 23, 21]);
    const checkpoint = await readSafetySnapshot();
    expect(checkpoint?.value.eliteProtocolVersion).toBe(2);
    expect(checkpoint?.value.plans.map(plannedSets)).toEqual([20, 19, 21]);
  });
});
