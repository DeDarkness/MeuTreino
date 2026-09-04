import { Dumbbell, Plus, SkipForward, Timer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { ActiveWorkout } from '../types';

type ActiveWorkoutDockProps = {
  workout: ActiveWorkout;
  onOpen: () => void;
  onAddRest: (seconds: number) => void;
  onSkipRest: () => void;
};

export function ActiveWorkoutDock({ workout, onOpen, onAddRest, onSkipRest }: ActiveWorkoutDockProps) {
  const now = useCurrentTime();
  const restEndMs = workout.restEndsAt ? Date.parse(workout.restEndsAt) : null;
  const isResting = restEndMs !== null && Number.isFinite(restEndMs) && restEndMs > now;
  const remainingSeconds = isResting ? Math.max(0, Math.ceil((restEndMs - now) / 1000)) : 0;
  const exercise = workout.exercises[workout.currentExerciseIndex];
  const set = exercise?.sets[workout.currentSetIndex];
  const { completed, total } = useMemo(() => ({
    completed: workout.exercises.reduce((sum, item) => sum + (item.skipped ? 0 : item.sets.filter((candidate) => candidate.completed).length), 0),
    total: workout.exercises.reduce((sum, item) => sum + (item.skipped ? 0 : item.sets.length), 0),
  }), [workout.exercises]);

  return (
    <aside className={`workout-dock${isResting ? ' is-resting' : ''}`} aria-label={isResting ? 'Descanso em andamento' : 'Treino em andamento'}>
      <button className="workout-dock__main" type="button" onClick={onOpen}>
        <span className="workout-dock__icon">{isResting ? <Timer /> : <Dumbbell />}</span>
        <span className="workout-dock__copy">
          <strong>{isResting ? 'Descanso rolando' : workout.planName}</strong>
          <small>{exercise ? `${exercise.exerciseName} · série ${set?.setNumber ?? 1}` : `${completed}/${total} séries`}</small>
        </span>
        {isResting ? <time>{formatRestClock(remainingSeconds)}</time> : <span className="workout-dock__progress">{completed}/{total}</span>}
      </button>
      {isResting ? (
        <div className="workout-dock__actions">
          <button type="button" aria-label="Adicionar 15 segundos" onClick={() => onAddRest(15)}><Plus size={18} />15s</button>
          <button type="button" aria-label="Pular descanso" onClick={onSkipRest}><SkipForward size={18} /></button>
        </div>
      ) : null}
    </aside>
  );
}

function useCurrentTime() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const interval = window.setInterval(update, 250);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return now;
}

function formatRestClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
