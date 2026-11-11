import { isWeekKey, localWeekKey } from './recovery';
import { FULL_BODY_DAYS } from './starterPlans';
import type { AppState, WorkoutHistory, WorkoutPlan } from '../types';

export const MAX_CYCLE_WEEKS = 16;

export function offsetWeek(week: string, distance: number) {
  const date = new Date(`${week}T12:00:00`);
  date.setDate(date.getDate() + distance * 7);
  return localWeekKey(date);
}

export function isTrainingCycle(value: unknown): value is NonNullable<AppState['trainingCycle']> {
  if (!value || typeof value !== 'object') return false;
  const cycle = value as Record<string, unknown>;
  if (!isWeekKey(cycle.startWeek) || typeof cycle.weeks !== 'number' || !Number.isInteger(cycle.weeks) || cycle.weeks < 1 || cycle.weeks > MAX_CYCLE_WEEKS || !Array.isArray(cycle.recoveryWeeks)) return false;
  const end = offsetWeek(cycle.startWeek, cycle.weeks);
  return cycle.recoveryWeeks.length <= cycle.weeks && new Set(cycle.recoveryWeeks).size === cycle.recoveryWeeks.length
    && cycle.recoveryWeeks.every((week) => isWeekKey(week) && week >= (cycle.startWeek as string) && week < end);
}

export function trainingTimeline(history: readonly WorkoutHistory[], plans: readonly WorkoutPlan[], endWeek: string, count = 8) {
  const planIds = new Set(plans.filter((plan) => FULL_BODY_DAYS.some((day) => day.planId === plan.id)).map((plan) => plan.id));
  const weeks = Array.from({ length: count }, (_, i) => ({
    week: offsetWeek(endWeek, i - count + 1), sessions: 0, sets: 0, weightedSets: 0, volumeKg: 0, scheduledPlans: planIds.size, completedPlans: 0,
  }));
  const byWeek = new Map(weeks.map((row) => [row.week, row]));
  const completed = new Map<string, Set<string>>();
  for (const session of history) {
    const sets = session.exercises.flatMap((exercise) => exercise.sets.filter((set) => set.reps > 0));
    if (!sets.length) continue;
    const finished = byWeek.get(localWeekKey(new Date(session.finishedAt)));
    if (finished) {
      finished.sessions++;
      finished.sets += sets.length;
      for (const set of sets) if (set.weight !== null && set.weight > 0) { finished.weightedSets++; finished.volumeKg += set.weight * set.reps; }
    }
    if (!session.planId || !planIds.has(session.planId) || session.recoveryWeekStart || session.trainingMode === 'express') continue;
    const origin = localWeekKey(new Date(session.startedAt));
    const row = byWeek.get(origin);
    if (!row) continue;
    const ids = completed.get(origin) ?? new Set<string>();
    ids.add(session.planId);
    completed.set(origin, ids);
    row.completedPlans = ids.size;
  }
  return weeks;
}
