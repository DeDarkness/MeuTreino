import { describe, expect, it } from 'vitest';

import type { WorkoutHistory } from '../types';
import { buildExerciseProgress, getLoadSuggestion, getPotentialRecordLabels } from './progress';

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
      { id: 'set-1', setNumber: 1, reps: 10, weight: 80, completedAt: '2026-09-01T12:10:00.000Z' },
      { id: 'set-2', setNumber: 2, reps: 10, weight: 80, completedAt: '2026-09-01T12:13:00.000Z' },
      { id: 'set-3', setNumber: 3, reps: 10, weight: 80, completedAt: '2026-09-01T12:16:00.000Z' },
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

  it('identifica um novo recorde de carga antes de concluir a série', () => {
    expect(getPotentialRecordLabels(history, {
      exerciseId: 'supino', exerciseName: 'Supino reto',
    }, { reps: 8, weight: 85 })).toContain('Maior carga');
  });
});
