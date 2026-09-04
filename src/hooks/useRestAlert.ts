import { useEffect, useRef } from 'react';

import { showRestFinishedNotification } from '../lib/notifications';
import { playRestAlert } from '../lib/restAlert';
import type { ActiveWorkout, Preferences } from '../types';

export function useRestAlert(
  workout: ActiveWorkout | null,
  preferences: Preferences | null,
  onRestFinished: () => Promise<void>,
) {
  const alertedRestRef = useRef<string | null>(null);

  useEffect(() => {
    if (!workout?.restEndsAt || !preferences) {
      alertedRestRef.current = null;
      return;
    }
    const restEndsAt = workout.restEndsAt;

    const restEndMs = Date.parse(restEndsAt);
    if (!Number.isFinite(restEndMs)) return;

    const exercise = workout.exercises[workout.currentExerciseIndex];
    const set = exercise?.sets[workout.currentSetIndex];
    let timeout: number | undefined;

    const finishRest = () => {
      if (Date.now() < restEndMs || alertedRestRef.current === restEndsAt) return;
      alertedRestRef.current = restEndsAt;

      if (preferences.soundEnabled) playRestAlert(preferences.restAlertSound);
      if (preferences.vibrationEnabled && 'vibrate' in navigator) {
        navigator.vibrate([260, 120, 260, 120, 420]);
      }
      void showRestFinishedNotification(exercise?.exerciseName ?? 'próxima série', set?.setNumber ?? 1);
      void onRestFinished().catch(() => undefined);
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
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', schedule);
      window.removeEventListener('focus', schedule);
    };
  }, [onRestFinished, preferences, workout]);
}
