import { ChevronLeft, ChevronRight, Target, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { formatDate } from '../lib/format';
import { canUseExpress, MUSCLE_LABELS, type TrainingMode } from '../lib/trainingModes';
import { startOfLocalWeek, weeklyInsights } from '../lib/weeklyInsights';
import type { Preferences, WorkoutHistory, WorkoutPlan } from '../types';

export function WeeklyDashboard({ plans, history, modes = {}, onModesChange }: {
  plans: WorkoutPlan[];
  history: WorkoutHistory[];
  modes?: Preferences['weeklyPlanModes'];
  onModesChange: (modes: Record<string, TrainingMode>) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const date = startOfLocalWeek();
  date.setDate(date.getDate() + offset * 7);
  const end = new Date(date);
  end.setDate(end.getDate() + 6);
  const data = weeklyInsights(plans, history, modes, date);
  return (
    <section className="elite-dashboard" aria-labelledby="weekly-dashboard-title">
      <div className="elite-section-top"><div><span className="eyebrow">TREINE COM INTENÇÃO</span><h2 id="weekly-dashboard-title">Sua semana, em foco</h2></div><Target aria-hidden="true" /></div>
      <div className="elite-week-navigation">
        <button type="button" aria-label="Semana anterior" onClick={() => setOffset(offset - 1)}><ChevronLeft size={19} /></button>
        <span>{offset === 0 ? 'Esta semana' : `${formatDate(date.toISOString())} — ${formatDate(end.toISOString())}`}</span>
        <button type="button" aria-label="Próxima semana" disabled={offset === 0} onClick={() => setOffset(offset + 1)}><ChevronRight size={19} /></button>
      </div>
      <div className="elite-week-metrics">
        <div><strong>{data.sessions.length}<small>/{data.programmed.length || '—'}</small></strong><span>sessões registradas</span></div>
        <div><strong>{data.actualSets}<small>/{data.plannedSets}</small></strong><span>séries realizadas / plano</span></div>
      </div>
      <p className="elite-caption">Realizado: registros da semana selecionada. Plano: sua configuração atual, não uma meta clínica.</p>
      <button type="button" className="elite-expand" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}><TrendingUp size={17} />{expanded ? 'Recolher planejamento e músculos' : 'Planejamento e volume por músculo'}<ChevronRight size={16} /></button>
      {expanded ? <>
        <div className="elite-plan-modes" role="group" aria-label="Planejamento da semana">
          {data.programmed.map((plan) => <div key={plan.id}><span>{plan.name}</span>{canUseExpress(plan) ? <div className="elite-mode-buttons">
            {(['complete', 'express'] as const).map((mode) => <button key={mode} type="button" aria-pressed={(modes[plan.id] ?? 'complete') === mode} onClick={() => onModesChange({ ...modes, [plan.id]: mode })}>{mode === 'complete' ? 'Completo' : 'Express'}</button>)}
          </div> : <small>Ficha personalizada</small>}</div>)}
        </div>
        <div className="elite-volume-heading"><span>Músculo dominante</span><span>Feito / plano</span></div>
        {data.rows.map((row) => <div className="elite-volume-comparison" key={row.muscle}>
          <span>{MUSCLE_LABELS[row.muscle]}</span><strong>{row.actual}<small> / {row.planned}</small></strong>
          <div className="elite-volume-meter"><i style={{ width: `${Math.min(100, row.actual / Math.max(1, row.planned) * 100)}%` }} /></div>
        </div>)}
        {data.unclassifiedSets > 0 ? <p className="elite-caption">{data.unclassifiedSets} séries antigas ou sem músculo identificado entram no total, mas não são atribuídas por suposição.</p> : null}
        <p className="elite-caption">Séries de trabalho, sem duplicar músculos auxiliares. Trabalho de glúteos em compostos não é contado à parte. Mudar o planejamento não altera suas fichas nem o histórico.</p>
      </> : null}
    </section>
  );
}
