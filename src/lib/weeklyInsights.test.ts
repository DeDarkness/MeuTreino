import { describe, expect, it } from 'vitest';
import { createWeeklyWorkoutPlans } from './starterPlans';
import { startOfLocalWeek, weeklyInsights, searchText } from './weeklyInsights';
import type { WorkoutHistory } from '../types';

const plans = createWeeklyWorkoutPlans();
const monday = new Date(2026, 9, 19, 12);
const session = (finishedAt: Date): WorkoutHistory => ({ id: 'history-test', planId: plans[0].id, planName: plans[0].name,
  startedAt: finishedAt.toISOString(), finishedAt: finishedAt.toISOString(), durationSeconds: 60, trainingMode: 'express',
  exercises: [{ exerciseId: 'terca-hack', exerciseName: plans[0].exercises[0].name, muscleGroup: 'quadriceps',
    sets: [{ id: 's1', setNumber: 1, reps: 10, weight: 50, rir: 2, completedAt: finishedAt.toISOString() }] }],
});

describe('semana planejada e volume realizado', () => {
  it('planeja apenas as 66 séries normais e preserva registros Express antigos', () => {
    const data = weeklyInsights(plans, [session(monday)], monday);
    expect(data.plannedSets).toBe(66);
    expect(data.actualSets).toBe(1);
    expect(data.rows.find((row) => row.muscle === 'peito')?.planned).toBe(8);
  });
  it('separa semanas por limites locais e não inclui a semana seguinte', () => {
    const sunday = session(new Date(2026, 9, 18, 23, 59));
    const nextMonday = session(new Date(2026, 9, 26));
    const data = weeklyInsights(plans, [sunday, session(monday), nextMonday], monday);
    expect(data.sessions).toHaveLength(1);
    expect(data.actualSets).toBe(1);
    expect(startOfLocalWeek(new Date(2026, 9, 25)).getDate()).toBe(19);
  });
  it('mantém o músculo registrado mesmo depois de editar a ficha', () => {
    const edited = structuredClone(plans);
    edited[0].exercises[0].muscleGroup = 'gluteos';
    const data = weeklyInsights(edited, [session(monday)], monday);
    expect(data.rows.find((row) => row.muscle === 'quadriceps')?.actual).toBe(1);
    expect(data.rows.find((row) => row.muscle === 'gluteos')?.actual ?? 0).toBe(0);
  });
  it('não inventa classificação para exercícios antigos sem correspondência', () => {
    const old = session(monday);
    old.exercises[0].muscleGroup = undefined;
    old.exercises[0].exerciseName = 'Exercício excluído';
    const data = weeklyInsights(plans, [old], monday);
    expect(data.unclassifiedSets).toBe(1);
    expect(data.actualSets).toBe(1);
  });
  it('não duplica o planejamento por causa de fichas arquivadas', () => {
    expect(weeklyInsights([...plans, { ...plans[0], id: 'plan-arquivo-old' }], [], monday).plannedSets).toBe(66);
  });
  it('permite buscas sem acentos ou diferença de maiúsculas', () => {
    expect(searchText('  Tríceps FRÂNCÊS ')).toBe('triceps frances');
  });
});
