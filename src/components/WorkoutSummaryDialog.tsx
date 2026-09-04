import { Check, Clock3, Dumbbell, Share2, Sparkles, Target, TrendingUp, Trophy, X, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';

import { formatDuration, formatWeight } from '../lib/format';
import { getPotentialRecordLabels } from '../lib/progress';
import type { WeightUnit, WorkoutHistory } from '../types';
import './workout-summary.css';

type WorkoutSummaryDialogProps = {
  workout: WorkoutHistory;
  previousHistory: WorkoutHistory[];
  weightUnit: WeightUnit;
  onClose: () => void;
  onViewProgress: () => void;
};

export function WorkoutSummaryDialog({
  workout,
  previousHistory,
  weightUnit,
  onClose,
  onViewProgress,
}: WorkoutSummaryDialogProps) {
  const [shared, setShared] = useState(false);
  const summary = useMemo(() => buildSummary(workout, previousHistory), [previousHistory, workout]);

  const share = async () => {
    const text = workoutShareText(workout, summary, weightUnit);
    try {
      if (navigator.share) await navigator.share({ title: `MeuTreino · ${workout.planName}`, text });
      else await navigator.clipboard.writeText(text);
      setShared(true);
    } catch {
      // Closing the iOS share sheet is not an app error.
    }
  };

  return (
    <div className="workout-summary-backdrop" role="presentation">
      <section className="workout-summary-dialog" role="dialog" aria-modal="true" aria-labelledby="workout-summary-title">
        <div className="workout-summary-confetti" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
        <button className="workout-summary-close" type="button" aria-label="Fechar resumo" onClick={onClose}><X /></button>
        <div className="workout-summary-hero">
          <span><Trophy aria-hidden="true" /></span>
          <p>TREINO FINALIZADO</p>
          <h2 id="workout-summary-title">Mandou muito bem!</h2>
          <strong>{workout.planName}</strong>
        </div>

        <div className="workout-summary-stats">
          <SummaryStat icon={<Clock3 />} value={formatDuration(workout.durationSeconds)} label="duração" />
          <SummaryStat icon={<Dumbbell />} value={String(summary.totalSets)} label="séries" />
          <SummaryStat icon={<Target />} value={String(summary.totalReps)} label="repetições" />
          <SummaryStat icon={<Zap />} value={formatWeight(summary.volume || null, weightUnit)} label="volume" />
        </div>

        {summary.records.length ? (
          <div className="workout-summary-records">
            <div><Sparkles aria-hidden="true" /><strong>{summary.records.length} {summary.records.length === 1 ? 'recorde novo' : 'recordes novos'}</strong></div>
            {summary.records.slice(0, 4).map((record) => (
              <span key={record.exerciseName}><Trophy aria-hidden="true" /> <strong>{record.exerciseName}</strong> · {record.labels.join(' e ')}</span>
            ))}
          </div>
        ) : null}

        <div className="workout-summary-insights">
          <div>
            <TrendingUp aria-hidden="true" />
            <span>Volume vs. treino anterior</span>
            <strong>{summary.volumeDelta === null ? 'Primeiro registro' : formatDelta(summary.volumeDelta, weightUnit)}</strong>
          </div>
          <div>
            <Target aria-hidden="true" />
            <span>RIR médio</span>
            <strong>{summary.averageRir === null ? 'Não informado' : summary.averageRir.toFixed(1)}</strong>
          </div>
        </div>

        {workout.notes ? <p className="workout-summary-note">“{workout.notes}”</p> : null}

        <div className="workout-summary-actions">
          <button className="is-primary" type="button" onClick={onViewProgress}><TrendingUp size={19} /> Ver minha evolução</button>
          <button type="button" onClick={() => void share()}>{shared ? <Check size={19} /> : <Share2 size={19} />} {shared ? 'Resumo copiado' : 'Compartilhar resumo'}</button>
        </div>
      </section>
    </div>
  );
}

function SummaryStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <article><span>{icon}</span><strong>{value}</strong><small>{label}</small></article>;
}

function buildSummary(workout: WorkoutHistory, previousHistory: WorkoutHistory[]) {
  const sets = workout.exercises.flatMap((exercise) => exercise.sets);
  const volume = sets.reduce((sum, set) => sum + (set.weight ?? 0) * set.reps, 0);
  const rirValues = sets.flatMap((set) => set.rir === null || set.rir === undefined ? [] : [set.rir]);
  const records = workout.exercises.flatMap((exercise) => {
    const labels = new Set(exercise.sets.flatMap((set) => getPotentialRecordLabels(previousHistory, exercise, set)));
    return labels.size ? [{ exerciseName: exercise.exerciseName, labels: [...labels] }] : [];
  });
  const previous = [...previousHistory]
    .filter((item) => item.planId === workout.planId || item.planName === workout.planName)
    .sort((left, right) => Date.parse(right.finishedAt) - Date.parse(left.finishedAt))[0];
  const previousVolume = previous?.exercises.flatMap((exercise) => exercise.sets)
    .reduce((sum, set) => sum + (set.weight ?? 0) * set.reps, 0);
  return {
    totalSets: sets.length,
    totalReps: sets.reduce((sum, set) => sum + set.reps, 0),
    volume,
    averageRir: rirValues.length ? rirValues.reduce((sum, value) => sum + value, 0) / rirValues.length : null,
    records,
    volumeDelta: previousVolume === undefined ? null : volume - previousVolume,
  };
}

function workoutShareText(workout: WorkoutHistory, summary: ReturnType<typeof buildSummary>, unit: WeightUnit) {
  const recordText = summary.records.length ? `\n🏆 ${summary.records.length} novo(s) recorde(s)` : '';
  return `🏋️ ${workout.planName} concluído\n⏱ ${formatDuration(workout.durationSeconds)} · ${summary.totalSets} séries · ${summary.totalReps} reps\n⚡ Volume: ${formatWeight(summary.volume || null, unit)}${recordText}\nRegistrado no MeuTreino`;
}

function formatDelta(value: number, unit: WeightUnit) {
  if (value === 0) return 'Mesmo volume';
  return `${value > 0 ? '+' : '−'}${formatWeight(Math.abs(value), unit)}`;
}
