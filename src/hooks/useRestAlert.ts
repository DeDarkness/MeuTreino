import { useEffect, useRef } from 'react';

import { showRestFinishedNotification } from '../lib/notifications';
import { playRestAlert } from '../lib/restAlert';
import { isPushRestScheduled } from '../lib/pushNotifications';
import { getRestTarget } from '../lib/workout';
import type { ActiveWorkout, Preferences } from '../types';

export function useRestAlert(
  workout: ActiveWorkout | null,
  preferences: Preferences | null,
  onRestFinished: (workoutId: string, deadline: string) => Promise<void>,
) {
  const alertedRestRef = useRef<string | null>(null);
  const clearingRef = useRef<string | null>(null);

  useEffect(() => {
    if (!workout?.restEndsAt || !preferences) {
      alertedRestRef.current = null;
      clearingRef.current = null;
      return;
    }
    const restEndsAt = workout.restEndsAt;

    const restEndMs = Date.parse(restEndsAt);
    if (!Number.isFinite(restEndMs)) return;

    const target = getRestTarget(workout);
    const key = `${workout.id}:${restEndsAt}`;
    let timeout: number | undefined;

    const finishRest = () => {
      if (Date.now() < restEndMs || clearingRef.current === key) return;
      const remoteScheduled = isPushRestScheduled(workout.id, restEndsAt);
      // If iOS keeps this hidden tab alive briefly, don't cancel its remote alarm
      // before the service delivers it. Reconcile the session when it is visible.
      if (remoteScheduled && document.visibilityState !== 'visible') return;
      if (alertedRestRef.current !== key) {
        alertedRestRef.current = key;
        const alertNow = document.visibilityState === 'visible' && Date.now() - restEndMs < 3000;
        if (preferences.soundEnabled && alertNow) playRestAlert(preferences.restAlertSound);
        if (preferences.vibrationEnabled && alertNow && 'vibrate' in navigator) navigator.vibrate([260, 120, 260, 120, 420]);
        if (!remoteScheduled) void showRestFinishedNotification(target?.exercise.exerciseName ?? 'próxima série', target?.set.setNumber ?? 1);
      }
      clearingRef.current = key;
      void onRestFinished(workout.id, restEndsAt).catch(() => {
        if (clearingRef.current === key) clearingRef.current = null;
      });
    };

    const schedule = () => {
      window.clearTimeout(timeout);
      const remaining = restEndMs - Date.now();
      if (remaining <= 0) {
        finishRest();
        return;
      }
      timeout = window.setTimeout(finishRest, remaining + 25);
    };

    schedule();
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('focus', schedule);
    window.addEventListener('pageshow', schedule);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', schedule);
      window.removeEventListener('focus', schedule);
      window.removeEventListener('pageshow', schedule);
    };
  }, [onRestFinished, preferences, workout]);
}
