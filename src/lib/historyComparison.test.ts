import { describe, expect, it } from 'vitest';
import { compareHistoryExercises, comparisonGroup, fullBodyDay } from './historyComparison';
import type { WorkoutHistory } from '../types';

const date = '2026-11-09T18:00:00.000Z';
const session: WorkoutHistory = {
  id: 'a', planId: 'plan-full-body-a', planName: 'Minha segunda', startedAt: date, finishedAt: date, durationSeconds: 900,
  exercises: [
    { exerciseId: 'supino', exerciseName: 'Supino com halteres', sets: [] },
    { exerciseId: 'remada', exerciseName: 'Remada máquina', sets: [] },
  ],
};

describe('histórico comparável', () => {
  it('reconhece ficha renomeada pelo ID e títulos legados exatos', () => {
    const legacy = { ...session, planId: null, planName: 'Full Body A' };
    expect(fullBodyDay(session)?.workout).toBe('A');
    expect(fullBodyDay(legacy)?.workout).toBe('A');
    expect(fullBodyDay({ ...legacy, planId: 'plan-full-body-b' })?.workout).toBe('B');
    expect(comparisonGroup(legacy)).toBe(comparisonGroup(session));
    expect(fullBodyDay({ ...legacy, planName: 'Full Body A alternativo' })).toBeNull();
  });

  it('separa reposição e Express da ficha normal', () => {
    const recovery = { ...session, recoveryWeekStart: '2026-11-09' };
    const express = { ...session, trainingMode: 'express' as const };
    expect(fullBodyDay(recovery)).toBeNull();
    expect(fullBodyDay(express)).toBeNull();
    expect(comparisonGroup(recovery)).not.toBe(comparisonGroup(session));
    expect(comparisonGroup(express)).not.toBe(comparisonGroup(session));
  });

  it('alinha o mesmo nome com novo ID e separa equipamento diferente com ID antigo', () => {
    const changed = { ...session, exercises: [
      { ...session.exercises[0], exerciseName: 'Supino Smith' },
      { ...session.exercises[1], exerciseId: 'remada-2', exerciseName: 'Remada maquina' },
    ] };
    const original = structuredClone(changed);
    expect(compareHistoryExercises(session, changed)).toEqual([
      { first: session.exercises[0], second: undefined },
      { first: session.exercises[1], second: changed.exercises[1] },
      { second: changed.exercises[0] },
    ]);
    expect(changed).toEqual(original);
  });
});
