import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib';
import { formatClock, formatWeight } from './format';
import { localWeekKey, recoveryWeekLabel } from './recovery';
import { trainingTimeline } from './trainingTimeline';
import { MUSCLE_LABELS } from './trainingModes';
import type { WeightUnit, WorkoutHistory } from '../types';

const WIDTH = 595.28;
const HEIGHT = 841.89;
const MARGIN = 39;
const CONTENT = WIDTH - MARGIN * 2;
const ink = rgb(.09, .16, .13);
const muted = rgb(.30, .36, .33);
const green = rgb(.10, .33, .23);
const pale = rgb(.92, .96, .94);
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

export async function makeWorkoutHistoryPdf(sessions: readonly WorkoutHistory[], unit: WeightUnit, generatedAt = new Date(), includeCharts = false): Promise<File> {
  if (!sessions.length) throw new Error('Selecione pelo menos um treino.');
  const pdf = await PDFDocument.create();
  pdf.setTitle('MeuTreino - Histórico de treinos');
  pdf.setCreationDate(generatedAt);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const charset = new Set(normal.getCharacterSet());
  const clean = (value: string) => Array.from(value.normalize('NFC'), (ch) => {
    if (ch === '\n') return ch;
    if (/\s/u.test(ch)) return ' ';
    if (charset.has(ch.codePointAt(0)!)) return ch;
    // PDF's standard font covers Portuguese; avoid failing on imported symbols.
    const base = ch.normalize('NFKD').replace(/\p{M}/gu, '');
    return base && Array.from(base).every((part) => charset.has(part.codePointAt(0)!)) ? base : '?';
  }).join('');
  const wrap = (value: string, font: PDFFont, size: number, width = CONTENT) => clean(value).split('\n').flatMap((paragraph) => {
    const lines: string[] = [];
    let line = '';
    for (const word of paragraph.trim().split(/ +/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
      if (line) lines.push(line);
      line = '';
      for (const ch of word) {
        if (line && font.widthOfTextAtSize(line + ch, size) > width) { lines.push(line); line = ''; }
        line += ch;
      }
    }
    return [...lines, line];
  });
  let page = pdf.addPage([WIDTH, HEIGHT]);
  let y = HEIGHT - 43;
  const draw = (value: string, x: number, baseline: number, size = 10, font = normal, color = ink) => {
    if (value) page.drawText(clean(value), { x, y: baseline, size, font, color });
  };
  const header = () => {
    y = HEIGHT - 41;
    draw('MEUTREINO / RELATÓRIO DE TREINOS', MARGIN, y, 9, bold, green);
    y -= 28;
  };
  const nextPage = () => { page = pdf.addPage([WIDTH, HEIGHT]); header(); };
  const space = (height: number) => { if (y - height < 47) nextPage(); };
  const text = (value: string, size = 10, font = normal, color = ink) => {
    for (const line of wrap(value, font, size)) {
      space(size + 5);
      draw(line, MARGIN, y, size, font, color);
      y -= size + 5;
    }
  };
  const tableHead = () => {
    page.drawRectangle({ x: MARGIN, y: y - 6, width: CONTENT, height: 19, color: pale });
    for (const [label, offset] of [['Série', 9], ['Repetições', 75], ['Carga', 174], ['RIR', 272], ['Concluída em', 340]] as const) draw(label, MARGIN + offset, y, 9, bold, green);
    y -= 21;
  };
  const ordered = [...sessions].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const sets = ordered.reduce((n, s) => n + s.exercises.reduce((sum, e) => sum + e.sets.length, 0), 0);
  header();
  text('Histórico de treinos', 26, bold);
  text(`${ordered.length} ${ordered.length === 1 ? 'sessão selecionada' : 'sessões selecionadas'}  |  ${sets} ${sets === 1 ? 'série registrada' : 'séries registradas'}`, 11, bold, green);
  text('Somente sessões selecionadas. RIR é o número de repetições em reserva.', 9, normal, muted);
  text('Carga ou RIR sem registro: —. As séries não concluídas não fazem parte do histórico.', 9, normal, muted);
  y -= 11;
  if (includeCharts) {
    const last = sessions.reduce((latest, session) => Math.max(latest, Date.parse(session.finishedAt)), 0);
    const rows = trainingTimeline(sessions, [], localWeekKey(new Date(last)));
    const unitFactor = unit === 'lb' ? 2.2046226218 : 1;
    const volume = sessions.flatMap((session) => session.exercises.flatMap((exercise) => exercise.sets))
      .reduce((sum, set) => sum + (set.weight ?? 0) * set.reps, 0);
    const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
    text('Indicadores da seleção', 16, bold, green);
    text(`Volume com carga em toda a seleção: ${fmt.format(volume * unitFactor)} ${unit} × reps.`);
    text('Gráficos: oito semanas até a última sessão selecionada. Sem seleção não significa ausência de treino.', 9, normal, muted);
    const chart = (name: string, field: 'sessions' | 'volumeKg', factor = 1) => {
      y -= 10;
      text(name, 12, bold);
      const max = Math.max(1, ...rows.map((row) => row[field]));
      for (const row of rows) {
        const value = row[field];
        draw(`${row.week.slice(8)}/${row.week.slice(5, 7)}`, MARGIN, y, 9);
        page.drawRectangle({ x: MARGIN + 52, y: y - 2, width: 285, height: 8, color: pale });
        if (value > 0) page.drawRectangle({ x: MARGIN + 52, y: y - 2, width: 285 * value / max, height: 8, color: green });
        draw(fmt.format(value * factor), MARGIN + 350, y, 9);
        y -= 16;
      }
    };
    chart('Sessões selecionadas por semana', 'sessions');
    chart(`Volume semanal (${unit} × reps)`, 'volumeKg', unitFactor);
    text('Volume soma carga × repetições; séries sem carga não entram no cálculo.', 9, normal, muted);
    nextPage();
    text('Sessões detalhadas', 18, bold);
  }
  for (const [index, session] of ordered.entries()) {
    space(120);
    text(`${index + 1}. ${session.planName}`, 16, bold, green);
    text(`Início: ${dateTime.format(new Date(session.startedAt))}   |   Fim: ${dateTime.format(new Date(session.finishedAt))}`);
    const sessionSets = session.exercises.flatMap((exercise) => exercise.sets);
    text(`Duração: ${formatClock(session.durationSeconds)}   |   ${session.exercises.length} ${session.exercises.length === 1 ? 'exercício' : 'exercícios'}   |   ${sessionSets.length} ${sessionSets.length === 1 ? 'série' : 'séries'}   |   ${sessionSets.reduce((n, set) => n + set.reps, 0)} reps`);
    if (session.trainingMode) text(`Ficha usada: ${session.trainingMode === 'express' ? 'Express' : 'Completa'}`);
    if (session.plannedSetCount !== undefined) text(`Séries realizadas / planejadas: ${sessionSets.length} / ${session.plannedSetCount}`);
    if (session.recoveryWeekStart) text(`Reposição da semana de ${recoveryWeekLabel(session.recoveryWeekStart)}`);
    if (session.notes?.trim()) text(`Anotações: ${session.notes}`);
    y -= 8;
    for (const exercise of session.exercises) {
      const name = exercise.muscleGroup ? `${exercise.exerciseName} · ${MUSCLE_LABELS[exercise.muscleGroup]}` : exercise.exerciseName;
      space(58);
      text(name, 11, bold);
      if (exercise.restSeconds !== undefined) text(`Descanso da ficha: ${exercise.restSeconds} s`);
      space(40);
      tableHead();
      for (const [row, set] of exercise.sets.entries()) {
        if (y - 17 < 47) {
          nextPage();
          text(`${index + 1}. ${session.planName} (continuação)`, 13, bold, green);
          text(name, 11, bold);
          tableHead();
        }
        if (row % 2 === 0) page.drawRectangle({ x: MARGIN, y: y - 5, width: CONTENT, height: 17, color: rgb(.96, .97, .96) });
        const rir = set.rir === undefined || set.rir === null ? '—' : set.rir === 4 ? '4+' : String(set.rir);
        for (const [value, offset] of [[String(set.setNumber), 9], [String(set.reps), 75], [formatWeight(set.weight, unit), 174], [rir, 272], [dateTime.format(new Date(set.completedAt)), 340]] as const) draw(value, MARGIN + offset, y, 9);
        y -= 17;
      }
      y -= 13;
    }
    y -= 13;
  }
  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    p.drawText('MeuTreino · Gerado no aparelho', { x: MARGIN, y: 26, font: normal, size: 8, color: muted });
    const number = `${index + 1} / ${pages.length}`;
    p.drawText(number, { x: WIDTH - MARGIN - normal.widthOfTextAtSize(number, 8), y: 26, font: normal, size: 8, color: muted });
  });
  const day = `${generatedAt.getFullYear()}-${String(generatedAt.getMonth() + 1).padStart(2, '0')}-${String(generatedAt.getDate()).padStart(2, '0')}`;
  const bytes = await pdf.save();
  return new File([new Uint8Array(bytes)], `MeuTreino-treinos-${day}.pdf`, { type: 'application/pdf' });
}
