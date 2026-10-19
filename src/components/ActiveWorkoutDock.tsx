import { Dumbbell, Plus, SkipForward, Timer } from 'lucide-react';
import { useMemo } from 'react';

import type { ActiveWorkout } from '../types';
import { getRestTarget } from '../lib/workout';
import { useWorkoutClock } from '../hooks/useWorkoutClock';

type ActiveWorkoutDockProps = {
  workout: ActiveWorkout;
  onOpen: () => void;
  onAddRest: (seconds: number) => void;
  onSkipRest: () => void;
  pushRestMessage: string | null;
};

export function ActiveWorkoutDock({ workout, onOpen, onAddRest, onSkipRest, pushRestMessage }: ActiveWorkoutDockProps) {
  const now = useWorkoutClock();
  const restEndMs = workout.restEndsAt ? Date.parse(workout.restEndsAt) : null;
  const isResting = restEndMs !== null && Number.isFinite(restEndMs) && restEndMs > now;
  const remainingSeconds = isResting ? Math.max(0, Math.ceil((restEndMs - now) / 1000)) : 0;
  const target = getRestTarget(workout);
  const exercise = target?.exercise;
  const set = target?.set;
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
          <small>{isResting && pushRestMessage ? pushRestMessage : exercise ? `${exercise.exerciseName} · série ${set?.setNumber ?? 1}` : `${completed}/${total} séries`}</small>
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

function formatRestClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
