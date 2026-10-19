import { describe, expect, it } from 'vitest';

import type { WorkoutHistory } from '../types';
import { buildExerciseProgress, getLoadSuggestion, getPotentialRecordLabels, getProgressionAdvice, estimateOneRepMax } from './progress';

const history: WorkoutHistory[] = [{
  id: 'history-1',
  planId: 'plan-1',
  planName: 'Treino A',
  startedAt: '2026-09-01T12:00:00.000Z',
  finishedAt: '2026-09-01T13:00:00.000Z',
  durationSeconds: 3600,
  exercises: [{
    exerciseId: 'supino',
    exerciseName: 'Supino reto',
    sets: [
      { id: 'set-1', setNumber: 1, reps: 10, weight: 80, rir: 2, completedAt: '2026-09-01T12:10:00.000Z' },
      { id: 'set-2', setNumber: 2, reps: 10, weight: 80, rir: 2, completedAt: '2026-09-01T12:13:00.000Z' },
      { id: 'set-3', setNumber: 3, reps: 10, weight: 80, rir: 2, completedAt: '2026-09-01T12:16:00.000Z' },
    ],
  }],
}];

describe('evolução do treino', () => {
  it('calcula carga, volume e força estimada por exercício', () => {
    const progress = buildExerciseProgress(history)[0];
    expect(progress).toMatchObject({ maxWeight: 80, maxReps: 10, bestVolume: 2400 });
    expect(progress.bestEstimatedOneRepMax).toBeCloseTo(106.67, 1);
  });

  it('sugere progressão quando todas as séries alcançam o topo da faixa', () => {
    const suggestion = getLoadSuggestion(history, {
      id: 'supino', name: 'Supino reto', targetSets: 3, targetReps: 10, notes: 'Meta: 6–10 repetições',
    }, 'kg');
    expect(suggestion).toMatchObject({ currentWeight: 80, suggestedWeight: 82.5, targetReps: 10 });
  });

  it('usa a meta editada em vez de observações desatualizadas para a progressão', () => {
    expect(getLoadSuggestion(history, {
      id: 'supino', name: 'Supino reto', targetSets: 3, targetReps: 12,
      notes: 'Meta: 6–10 repetições',
    }, 'kg')).toBeNull();
  });

  it('identifica um novo recorde de carga antes de concluir a série', () => {
    expect(getPotentialRecordLabels(history, {
      exerciseId: 'supino', exerciseName: 'Supino reto',
    }, { reps: 8, weight: 85 })).toContain('Maior carga');
  });

  const target = { id: 'supino', name: 'Supino reto', targetSets: 3, targetReps: 10, targetRirMin: 2 };
  it.each([null, undefined, 0, 1])('não recomenda subir sem RIR adequado: %s', (rir) => {
    const copy = structuredClone(history);
    copy[0].exercises[0].sets[1].rir = rir;
    expect(getLoadSuggestion(copy, target, 'kg')).toBeNull();
    expect(getProgressionAdvice(copy, target, 'kg').kind).toBe(rir == null ? 'record-rir' : 'maintain');
  });

  it('não confunde um exercício renomeado para outro equipamento pelo mesmo id', () => {
    expect(getLoadSuggestion(history, { ...target, name: 'Supino no Smith' }, 'kg')).toBeNull();
  });

  it('usa microincrementos para não sugerir 25% de aumento em cargas pequenas', () => {
    const copy = structuredClone(history);
    copy[0].exercises[0].sets.forEach((set) => { set.weight = 10; });
    expect(getLoadSuggestion(copy, target, 'kg')).toMatchObject({ increment: 0.5, suggestedWeight: 10.5, percentage: 5 });
    expect(getLoadSuggestion(copy, { ...target, loadIncrementKg: 2.5 }, 'kg')).toBeNull();
    expect(getLoadSuggestion(copy, { ...target, loadIncrementKg: 0.25 }, 'kg')).toMatchObject({ suggestedWeight: 10.25 });
  });

  it('não recomenda uma carga única para séries com pesos diferentes', () => {
    const copy = structuredClone(history);
    copy[0].exercises[0].sets[1].weight = 75;
    expect(getLoadSuggestion(copy, target, 'kg')).toBeNull();
  });

  it('exige séries suficientes ao alternar de Express para Completo', () => {
    const copy = structuredClone(history);
    copy[0].exercises[0].sets = copy[0].exercises[0].sets.slice(0, 1);
    expect(getLoadSuggestion(copy, target, 'kg')).toBeNull();
  });

  it('não extrapola a estimativa de força com séries de altas repetições', () => {
    expect(estimateOneRepMax(30, 20)).toBeNull();
    expect(estimateOneRepMax(0, 8)).toBeNull();
    expect(estimateOneRepMax(80, 10)).toBeCloseTo(106.67, 1);
  });
});
