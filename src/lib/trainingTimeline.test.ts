import { describe, expect, it } from 'vitest';
import { createSeedState } from './database';
import { isTrainingCycle, trainingTimeline } from './trainingTimeline';
import type { WorkoutHistory } from '../types';

describe('indicadores por semana', () => {
  it('conta sessões e volume reais, com uma presença por ficha e Dia D separado', () => {
    const plans = createSeedState().plans;
    const date = new Date(2026, 10, 4, 19).toISOString();
    const session: WorkoutHistory = {
      id: 'a', planId: plans[0].id, planName: plans[0].name, startedAt: date, finishedAt: date, durationSeconds: 60,
      exercises: [{ exerciseId: 'e', exerciseName: 'Exercício', sets: [
        { id: 's', setNumber: 1, reps: 10, weight: 20, completedAt: date },
        { id: 's2', setNumber: 2, reps: 8, weight: null, completedAt: date },
      ] }],
    };
    const history = [session, { ...session, id: 'a2' }, { ...session, id: 'd', planId: plans[1].id, recoveryWeekStart: '2026-11-02' }];
    expect(trainingTimeline(history, plans, '2026-11-02', 2)).toMatchObject([
      { week: '2026-10-26', sessions: 0 },
      { week: '2026-11-02', sessions: 3, completedPlans: 1, scheduledPlans: 3, sets: 6, weightedSets: 3, volumeKg: 600 },
    ]);
  });

  it('aceita recuperação apenas nas semanas do ciclo e sem repetição', () => {
    const cycle = { startWeek: '2026-11-02', weeks: 2, recoveryWeeks: ['2026-11-09'] };
    expect(isTrainingCycle(cycle)).toBe(true);
    expect(isTrainingCycle({ ...cycle, recoveryWeeks: ['2026-11-16'] })).toBe(false);
    expect(isTrainingCycle({ ...cycle, recoveryWeeks: ['2026-11-09', '2026-11-09'] })).toBe(false);
  });
});
