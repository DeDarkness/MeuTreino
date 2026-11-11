import { useEffect, useMemo, useState } from 'react';
import { formatDate, formatWeight } from '../lib/format';
import { buildExerciseProgress } from '../lib/progress';
import { listProgressPhotos } from '../lib/database';
import type { ProgressPhoto } from '../lib/progressPhotos';
import type { BodyMeasurement } from '../nutrition/types';
import { dateLabel, display } from '../nutrition/uiHelpers';
import type { WeightUnit, WorkoutHistory, WorkoutPlan } from '../types';
import { ProgressPhotoImage } from './ProgressPhotoImage';
import './vtaper-dashboard.css';

export function VTaperDashboard({ history, plans, unit, measurements, showPhoto, onOpen }: {
  history: WorkoutHistory[];
  plans: WorkoutPlan[];
  unit: WeightUnit;
  measurements: BodyMeasurement[];
  showPhoto: boolean;
  onOpen: () => void;
}) {
  const back = useMemo(() => {
    const ids = new Set(plans.flatMap((plan) => plan.exercises.filter((item) => item.muscleGroup === 'costas').map((item) => item.id)));
    const progress = buildExerciseProgress(history.map((item) => ({ ...item, exercises: item.exercises.filter((exercise) =>
      exercise.muscleGroup === 'costas' || (exercise.muscleGroup === undefined && ids.has(exercise.exerciseId))) })));
    return [/(puxada|pulldown)/i, /remada/i].flatMap((pattern) => progress
      .filter((exercise) => pattern.test(exercise.exerciseName))
      .sort((a, b) => (b.sessions.at(-1)?.finishedAt ?? '').localeCompare(a.sessions.at(-1)?.finishedAt ?? ''))
      .slice(0, 1));
  }, [history, plans]);
  const body = [...measurements].sort((a, b) => b.date.localeCompare(a.date) || (b.measuredAt ?? '').localeCompare(a.measuredAt ?? ''));
  const metrics = [
    ['Peso', body.find((item) => item.weightKg != null)?.weightKg, 'kg'],
    ['Cintura', body.find((item) => item.waistCm != null)?.waistCm, 'cm'],
    ['Ombros', body.find((item) => item.shoulderCm != null)?.shoulderCm, 'cm'],
    ['Braço direito contraído', body.find((item) => item.rightArmFlexedCm != null)?.rightArmFlexedCm, 'cm'],
    ['Braço esquerdo contraído', body.find((item) => item.leftArmFlexedCm != null)?.leftArmFlexedCm, 'cm'],
  ] as const;
  return <section className="training-timeline vtaper-dashboard" aria-labelledby="vtaper-dashboard-title">
    <h2 id="vtaper-dashboard-title">Costas e medidas</h2>
    {back.length ? <ul>{back.map((exercise) => {
      const latest = exercise.sessions.at(-1)!;
      const previous = exercise.sessions.at(-2);
      return <li key={exercise.key}>
        <strong>{exercise.exerciseName}</strong>
        <span>{formatDate(latest.finishedAt)} · {latest.maxWeight == null ? `${latest.maxReps} reps registradas` : formatWeight(latest.maxWeight, unit)}</span>
        {previous?.maxWeight != null && latest.maxWeight != null ? <small>Anterior {formatWeight(previous.maxWeight, unit)} · Melhor {formatWeight(exercise.maxWeight, unit)}</small> : null}
      </li>;
    })}</ul> : <p className="elite-caption">As cargas de puxadas e remadas aparecem após o primeiro registro.</p>}
    {body[0] ? <>
      <p className="elite-caption">Última avaliação em {dateLabel(body[0].date)}. Cada indicador usa seu registro mais recente.</p>
      <dl>{metrics.filter(([, value]) => value != null).map(([label, value, suffix]) => <div key={label}><dt>{label}</dt><dd>{display(value)} {suffix}</dd></div>)}</dl>
    </> : null}
    {showPhoto ? <LatestProgressPhoto /> : null}
    <button className="button button-secondary button-wide" type="button" onClick={onOpen}>Abrir evolução corporal</button>
  </section>;
}

function LatestProgressPhoto() {
  const [photo, setPhoto] = useState<ProgressPhoto>();
  useEffect(() => {
    let cancelled = false;
    void listProgressPhotos().then((photos) => {
      if (!cancelled) setPhoto(photos.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0]);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  return photo ? <div className="vtaper-home-photo"><ProgressPhotoImage blob={photo.thumbnail} alt={`Foto de evolução de ${dateLabel(photo.date)}`} /></div> : null;
}
