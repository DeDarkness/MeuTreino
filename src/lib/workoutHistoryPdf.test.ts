import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { makeWorkoutHistoryPdf } from './workoutHistoryPdf';
import type { WorkoutHistory } from '../types';

const at = new Date(2026, 10, 4, 19);
const iso = at.toISOString();
const session: WorkoutHistory = {
  id: 'qa', planId: 'a', planName: 'Full Body A · revisão', startedAt: iso, finishedAt: iso, durationSeconds: 4031,
  notes: 'Teste sintético: tríceps, extensão, observação. 💪',
  exercises: [{ exerciseId: 'core', exerciseName: 'Abdominal crunch na polia', muscleGroup: 'core', sets: [
    { id: 's1', setNumber: 1, reps: 12, weight: 22.5, rir: 0, completedAt: iso },
    { id: 's2', setNumber: 2, reps: 10, weight: null, rir: 4, completedAt: iso },
  ] }],
};

describe('PDF local do histórico', () => {
  it('gera arquivo PDF válido e com nome local, sem alterar o treino', async () => {
    const source = structuredClone(session);
    const file = await makeWorkoutHistoryPdf([session], 'kg', at);
    expect(file.type).toBe('application/pdf');
    expect(file.name).toBe('MeuTreino-treinos-2026-11-04.pdf');
    const pdf = await PDFDocument.load(await file.arrayBuffer());
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toContain('Histórico');
    expect(session).toEqual(source);
  });

  it('pagina séries e anotações longas sem falhar com caracteres importados', async () => {
    const long = structuredClone(session);
    long.notes = `${'texto longo '.repeat(150)}\n${'x'.repeat(600)}`;
    long.exercises[0].sets = Array.from({ length: 60 }, (_, i) => ({ ...session.exercises[0].sets[i % 2], id: `set-${i}`, setNumber: i + 1 }));
    const file = await makeWorkoutHistoryPdf([session, long], 'lb', at);
    expect((await PDFDocument.load(await file.arrayBuffer())).getPageCount()).toBeGreaterThan(1);
  });

  it('rejeita exportação sem sessões', async () => {
    await expect(makeWorkoutHistoryPdf([], 'kg')).rejects.toThrow('Selecione');
  });
});
