import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Dumbbell,
  Link2,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react';

import { useNumericDraft } from '../hooks/useNumericDraft';
import type { ActiveWorkout, Exercise, WorkoutPlan } from '../types';
import './plans-screen.css';

export interface PlansScreenProps {
  plans: WorkoutPlan[];
  activeWorkout: ActiveWorkout | null;
  defaultRestSeconds: number;
  onStart: (plan: WorkoutPlan) => void;
  onSave: (plan: WorkoutPlan) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

type EditorState = {
  id: string;
  name: string;
  notes: string;
  exercises: Exercise[];
  createdAt: string;
};

const newExercise = (defaultRestSeconds: number): Exercise => ({
  id: crypto.randomUUID(),
  name: '',
  targetSets: 3,
  targetReps: 10,
  restSeconds: defaultRestSeconds,
  notes: '',
});

const newEditorState = (defaultRestSeconds: number): EditorState => ({
  id: crypto.randomUUID(),
  name: '',
  notes: '',
  exercises: [newExercise(defaultRestSeconds)],
  createdAt: new Date().toISOString(),
});

const planEditorState = (plan: WorkoutPlan): EditorState => ({
  id: plan.id,
  name: plan.name,
  notes: plan.notes ?? '',
  exercises: plan.exercises.map((exercise) => ({ ...exercise })),
  createdAt: plan.createdAt,
});

function formatRest(seconds: number) {
  if (seconds === 0) return 'sem descanso';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}min ${remainder}s` : `${minutes}min`;
}

export function PlansScreen({
  plans,
  activeWorkout,
  defaultRestSeconds,
  onStart,
  onSave,
  onDelete,
  onDuplicate,
}: PlansScreenProps) {
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkoutPlan | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const closeEditor = useCallback(() => {
    if (editorDirty && !window.confirm('Descartar as alterações não salvas deste treino?')) return;
    setEditor(null);
    setEditorDirty(false);
  }, [editorDirty]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (deleteTarget) setDeleteTarget(null);
      else if (editor) closeEditor();
      else if (selectedPlan) setSelectedPlan(null);
      else setOpenMenuId(null);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [closeEditor, deleteTarget, editor, selectedPlan]);

  const exerciseCount = useMemo(
    () => plans.reduce((total, plan) => total + plan.exercises.length, 0),
    [plans],
  );

  const openCreate = () => {
    setOpenMenuId(null);
    setEditorDirty(false);
    setEditor(newEditorState(defaultRestSeconds));
  };

  const openEdit = (plan: WorkoutPlan) => {
    setOpenMenuId(null);
    setSelectedPlan(null);
    setEditorDirty(false);
    setEditor(planEditorState(plan));
  };

  const requestDelete = (plan: WorkoutPlan) => {
    if (activeWorkout?.planId === plan.id) {
      window.alert('Finalize ou abandone o treino em andamento antes de excluir esta ficha.');
      return;
    }
    setOpenMenuId(null);
    setSelectedPlan(null);
    setDeleteTarget(plan);
  };

  return (
    <section className="plans-screen" aria-labelledby="plans-title">
      <header className="plans-header">
        <div>
          <p className="plans-eyebrow">SUAS FICHAS</p>
          <h1 id="plans-title">Treinos</h1>
          <p>{plans.length} {plans.length === 1 ? 'treino salvo' : 'treinos salvos'} · {exerciseCount} exercícios</p>
        </div>
      </header>

      {plans.length === 0 ? (
        <div className="plans-empty">
          <span className="plans-empty-icon" aria-hidden="true"><Dumbbell size={34} /></span>
          <h2>Monte seu primeiro treino</h2>
          <p>Adicione exercícios, séries, repetições e o tempo de descanso.</p>
          <button className="plans-primary-button" type="button" onClick={openCreate}>
            <Plus size={20} /> Criar treino
          </button>
        </div>
      ) : (
        <div className="plans-list">
          {plans.map((plan) => {
            const isActive = activeWorkout?.planId === plan.id;
            const totalSets = plan.exercises.reduce((total, exercise) => total + exercise.targetSets, 0);
            return (
              <article className={`plan-card${isActive ? ' is-active' : ''}`} key={plan.id}>
                <button className="plan-card-main" type="button" onClick={() => setSelectedPlan(plan)}>
                  <span className="plan-card-icon" aria-hidden="true"><Dumbbell size={23} /></span>
                  <span className="plan-card-copy">
                    <span className="plan-card-title-row">
                      <strong>{plan.name}</strong>
                      {isActive ? <span className="plan-live-badge">EM ANDAMENTO</span> : null}
                    </span>
                    {plan.notes ? <span className="plan-card-notes">{plan.notes}</span> : null}
                    <span className="plan-card-meta">{plan.exercises.length} exercícios · {totalSets} séries</span>
                  </span>
                  <ChevronRight className="plan-card-chevron" size={21} aria-hidden="true" />
                </button>

                <div className="plan-card-menu-wrap">
                  <button
                    className="plans-icon-button"
                    type="button"
                    aria-label={`Mais opções para ${plan.name}`}
                    aria-expanded={openMenuId === plan.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenuId((current) => current === plan.id ? null : plan.id);
                    }}
                  >
                    <MoreVertical size={21} />
                  </button>
                  {openMenuId === plan.id ? (
                    <div className="plan-card-menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => openEdit(plan)}><Pencil size={18} /> Editar</button>
                      <button type="button" role="menuitem" onClick={() => { setOpenMenuId(null); onDuplicate(plan.id); }}><Copy size={18} /> Duplicar</button>
                      <button className="is-danger" type="button" role="menuitem" disabled={isActive} title={isActive ? 'Finalize o treino em andamento antes de excluir' : undefined} onClick={() => requestDelete(plan)}><Trash2 size={18} /> Excluir</button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <button className="plans-fab" type="button" onClick={openCreate} aria-label="Criar novo treino">
        <Plus size={24} /> <span>Novo treino</span>
      </button>

      {selectedPlan ? (
        <PlanDetailDialog
          plan={selectedPlan}
          activeWorkout={activeWorkout}
          onClose={() => setSelectedPlan(null)}
          onEdit={() => openEdit(selectedPlan)}
          onDelete={() => requestDelete(selectedPlan)}
          onDuplicate={() => { onDuplicate(selectedPlan.id); setSelectedPlan(null); }}
          onStart={() => { onStart(selectedPlan); setSelectedPlan(null); }}
        />
      ) : null}

      {editor ? (
        <PlanEditorDialog
          state={editor}
          defaultRestSeconds={defaultRestSeconds}
          onChange={(next) => { setEditor(next); setEditorDirty(true); }}
          onClose={closeEditor}
          onSave={(plan) => { onSave(plan); setEditorDirty(false); setEditor(null); }}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDeleteDialog
          plan={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}
        />
      ) : null}
    </section>
  );
}

function PlanDetailDialog({
  plan,
  activeWorkout,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
  onStart,
}: {
  plan: WorkoutPlan;
  activeWorkout: ActiveWorkout | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onStart: () => void;
}) {
  const sameActivePlan = activeWorkout?.planId === plan.id;
  const anotherWorkoutIsActive = Boolean(activeWorkout && !sameActivePlan);

  return (
    <DialogShell title={plan.name} onClose={onClose}>
      <div className="plan-detail-summary">
        <span className="plan-detail-icon" aria-hidden="true"><Dumbbell size={28} /></span>
        <div>
          <p>{plan.exercises.length} exercícios</p>
          {plan.notes ? <span>{plan.notes}</span> : <span>Ficha pronta para começar.</span>}
        </div>
      </div>

      <div className="plan-detail-list">
        {plan.exercises.map((exercise, index) => (
          <article className="plan-detail-exercise" key={exercise.id}>
            <span className="plan-detail-number">{index + 1}</span>
            <div>
              <h3>{exercise.name}</h3>
              <p>{exercise.targetSets} séries · {exercise.targetReps} reps · {formatRest(exercise.restSeconds)}</p>
              {exercise.supersetGroup ? <span className="plan-superset-badge"><Link2 size={13} /> Supersérie {exercise.supersetGroup}</span> : null}
              {exercise.notes ? <span>{exercise.notes}</span> : null}
            </div>
          </article>
        ))}
      </div>

      {anotherWorkoutIsActive ? (
        <p className="plans-inline-warning">Finalize o treino em andamento antes de começar outra ficha.</p>
      ) : null}

      <div className="plan-detail-secondary-actions">
        <button type="button" onClick={onEdit}><Pencil size={18} /> Editar</button>
        <button type="button" onClick={onDuplicate}><Copy size={18} /> Duplicar</button>
        <button className="is-danger" type="button" onClick={onDelete}><Trash2 size={18} /> Excluir</button>
      </div>

      <div className="plans-dialog-sticky-footer">
        <button
          className="plans-primary-button"
          type="button"
          onClick={onStart}
          disabled={anotherWorkoutIsActive}
        >
          <Play size={20} fill="currentColor" /> {sameActivePlan ? 'Editar cargas e repetições' : 'Começar treino'}
        </button>
      </div>
    </DialogShell>
  );
}

function PlanEditorDialog({
  state,
  defaultRestSeconds,
  onChange,
  onClose,
  onSave,
}: {
  state: EditorState;
  defaultRestSeconds: number;
  onChange: (state: EditorState) => void;
  onClose: () => void;
  onSave: (plan: WorkoutPlan) => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  const valid = state.name.trim().length > 0
    && state.exercises.length > 0
    && state.exercises.every((exercise) => exercise.name.trim().length > 0);

  const updateExercise = (id: string, patch: Partial<Exercise>) => {
    onChange({
      ...state,
      exercises: state.exercises.map((exercise) => exercise.id === id ? { ...exercise, ...patch } : exercise),
    });
  };

  const moveExercise = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= state.exercises.length) return;
    const exercises = [...state.exercises];
    [exercises[index], exercises[destination]] = [exercises[destination], exercises[index]];
    onChange({ ...state, exercises });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    const updatedAt = new Date().toISOString();
    onSave({
      id: state.id,
      name: state.name.trim(),
      ...(state.notes.trim() ? { notes: state.notes.trim() } : {}),
      exercises: state.exercises.map((exercise) => ({
        ...exercise,
        name: exercise.name.trim(),
        ...(exercise.notes?.trim() ? { notes: exercise.notes.trim() } : { notes: undefined }),
        ...(exercise.supersetGroup?.trim() ? { supersetGroup: exercise.supersetGroup.trim() } : { supersetGroup: undefined }),
      })),
      createdAt: state.createdAt,
      updatedAt,
    });
  };

  return (
    <DialogShell title={state.name.trim() ? `Editar ${state.name}` : 'Novo treino'} onClose={onClose} wide>
      <form className="plan-editor" id="plan-editor-form" onSubmit={submit} noValidate>
        <label className="plans-field">
          <span>Nome do treino</span>
          <input
            autoFocus
            value={state.name}
            onChange={(event) => onChange({ ...state, name: event.target.value })}
            placeholder="Ex.: Peito e tríceps"
            aria-invalid={submitted && !state.name.trim()}
          />
          {submitted && !state.name.trim() ? <small>Informe o nome do treino.</small> : null}
        </label>

        <label className="plans-field">
          <span>Observações <em>opcional</em></span>
          <textarea
            rows={2}
            value={state.notes}
            onChange={(event) => onChange({ ...state, notes: event.target.value })}
            placeholder="Objetivo ou orientação geral"
          />
        </label>

        <div className="plan-editor-section-heading">
          <div><span>EXERCÍCIOS</span><small>{state.exercises.length}/20</small></div>
        </div>

        <div className="plan-editor-exercises">
          {state.exercises.map((exercise, index) => (
            <ExerciseEditor
              key={exercise.id}
              exercise={exercise}
              index={index}
              total={state.exercises.length}
              invalid={submitted && !exercise.name.trim()}
              onChange={(patch) => updateExercise(exercise.id, patch)}
              onMove={(direction) => moveExercise(index, direction)}
              onRemove={() => onChange({
                ...state,
                exercises: state.exercises.filter((item) => item.id !== exercise.id),
              })}
            />
          ))}
        </div>

        {state.exercises.length < 20 ? (
          <button
            className="plans-secondary-button plan-add-exercise"
            type="button"
            onClick={() => onChange({
              ...state,
              exercises: [...state.exercises, newExercise(defaultRestSeconds)],
            })}
          >
            <Plus size={20} /> Adicionar exercício
          </button>
        ) : null}

        {submitted && !valid ? <p className="plans-form-error">Preencha o nome do treino e de todos os exercícios.</p> : null}
      </form>

      <div className="plans-dialog-sticky-footer plans-editor-footer">
        <button className="plans-secondary-button" type="button" onClick={onClose}>Cancelar</button>
        <button className="plans-primary-button" type="submit" form="plan-editor-form">
          <Save size={20} /> Salvar treino
        </button>
      </div>
    </DialogShell>
  );
}

function ExerciseEditor({
  exercise,
  index,
  total,
  invalid,
  onChange,
  onMove,
  onRemove,
}: {
  exercise: Exercise;
  index: number;
  total: number;
  invalid: boolean;
  onChange: (patch: Partial<Exercise>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <fieldset className="plan-exercise-editor">
      <legend>Exercício {index + 1}</legend>
      <div className="plan-exercise-toolbar">
        <span>{index + 1}</span>
        <div>
          <button type="button" aria-label="Mover para cima" disabled={index === 0} onClick={() => onMove(-1)}><ChevronUp size={20} /></button>
          <button type="button" aria-label="Mover para baixo" disabled={index === total - 1} onClick={() => onMove(1)}><ChevronDown size={20} /></button>
          <button className="is-danger" type="button" aria-label="Excluir exercício" disabled={total === 1} onClick={onRemove}><Trash2 size={19} /></button>
        </div>
      </div>

      <label className="plans-field">
        <span>Nome</span>
        <input
          value={exercise.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Ex.: Supino reto"
          aria-invalid={invalid}
        />
        {invalid ? <small>Informe o nome do exercício.</small> : null}
      </label>

      <div className="plan-exercise-numbers">
        <NumberField label="Séries" value={exercise.targetSets} min={1} max={20} onChange={(targetSets) => onChange({ targetSets })} />
        <NumberField label="Reps" value={exercise.targetReps} min={1} max={999} onChange={(targetReps) => onChange({ targetReps })} />
        <NumberField label="Descanso (s)" value={exercise.restSeconds} min={0} max={1800} step={15} onChange={(restSeconds) => onChange({ restSeconds })} />
      </div>

      <label className="plans-field plans-superset-field">
        <span>Supersérie <em>opcional</em></span>
        <div>
          <Link2 aria-hidden="true" size={18} />
          <select value={exercise.supersetGroup ?? ''} onChange={(event) => onChange({ supersetGroup: event.target.value || undefined })}>
            <option value="">Exercício normal</option>
            <option value="A">Grupo A</option>
            <option value="B">Grupo B</option>
            <option value="C">Grupo C</option>
            <option value="D">Grupo D</option>
          </select>
        </div>
        <small>Use o mesmo grupo em dois exercícios para alternar as séries.</small>
      </label>

      <label className="plans-field">
        <span>Observações <em>opcional</em></span>
        <textarea
          rows={2}
          value={exercise.notes ?? ''}
          onChange={(event) => onChange({ notes: event.target.value })}
          placeholder="Técnica, equipamento ou ajuste"
        />
      </label>
    </fieldset>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const labelId = useId();
  const numeric = useNumericDraft({ value, min, max, step, integer: true, onChange });
  return (
    <div className="plans-number-field">
      <span id={labelId}>{label}</span>
      <div>
        <button type="button" aria-label={`Diminuir ${label}`} disabled={value <= min} onClick={numeric.decrement}>−</button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={numeric.draft}
          onFocus={numeric.onFocus}
          onBlur={numeric.onBlur}
          onChange={(event) => numeric.onDraftChange(event.target.value)}
          aria-labelledby={labelId}
        />
        <button type="button" aria-label={`Aumentar ${label}`} disabled={value >= max} onClick={numeric.increment}>+</button>
      </div>
    </div>
  );
}

function ConfirmDeleteDialog({ plan, onCancel, onConfirm }: { plan: WorkoutPlan; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="plans-dialog-backdrop plans-confirm-backdrop" role="presentation" onMouseDown={onCancel}>
      <section className="plans-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-plan-title" onMouseDown={stopPropagation}>
        <span className="plans-confirm-icon" aria-hidden="true"><Trash2 size={26} /></span>
        <h2 id="delete-plan-title">Excluir treino?</h2>
        <p>“{plan.name}” será removido. O histórico já registrado não será afetado.</p>
        <div>
          <button className="plans-secondary-button" type="button" onClick={onCancel}>Cancelar</button>
          <button className="plans-danger-button" type="button" onClick={onConfirm}><Trash2 size={19} /> Excluir</button>
        </div>
      </section>
    </div>
  );
}

function DialogShell({
  title,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog || dialog.contains(document.activeElement)) return;
      dialog.querySelector<HTMLElement>('input, textarea, button, [tabindex]:not([tabindex="-1"])')?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      previousFocus?.focus();
    };
  }, []);

  const trapFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [])].filter((element) => !element.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="plans-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className={`plans-dialog${wide ? ' is-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={stopPropagation}
        onKeyDown={trapFocus}
      >
        <header className="plans-dialog-header">
          <h2>{title}</h2>
          <button className="plans-icon-button" type="button" aria-label="Fechar" onClick={onClose}><X size={23} /></button>
        </header>
        <div className="plans-dialog-content">{children}</div>
      </section>
    </div>
  );
}

function stopPropagation(event: MouseEvent) {
  event.stopPropagation();
}

export default PlansScreen;
