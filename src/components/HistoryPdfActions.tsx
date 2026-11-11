import { Download, FileText, Share2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { downloadLocalFile, shareLocalFile } from '../lib/localFiles';
import type { WeightUnit, WorkoutHistory } from '../types';

export function HistoryPdfActions({ sessions, weightUnit, includeCharts, onChartsChange }: {
  sessions: WorkoutHistory[];
  weightUnit: WeightUnit;
  includeCharts: boolean;
  onChartsChange: (checked: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);

  const prepare = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      const { makeWorkoutHistoryPdf } = await import('../lib/workoutHistoryPdf');
      setFile(await makeWorkoutHistoryPdf(sessions, weightUnit, new Date(), includeCharts));
    } catch {
      setMessage('Não foi possível preparar o PDF. Tente selecionar menos sessões e gerar novamente.');
    } finally { lock.current = false; setBusy(false); }
  };

  const share = async () => {
    if (!file || lock.current) return;
    lock.current = true;
    setMessage('');
    try {
      await shareLocalFile(file);
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === 'AbortError')) setMessage('Não foi possível abrir o compartilhamento. Use Baixar PDF e envie o arquivo pelo WhatsApp.');
    } finally { lock.current = false; }
  };

  const download = () => {
    if (!file) return;
    try { downloadLocalFile(file); }
    catch { setMessage('Não foi possível iniciar o download. Tente compartilhar o arquivo.'); }
  };

  return <div className="history-pdf-actions" aria-busy={busy}>
    <label className="history-report-option"><input type="checkbox" checked={includeCharts} disabled={busy} onChange={(event) => { onChartsChange(event.target.checked); setFile(null); setMessage(''); }} /> Incluir gráficos e indicadores</label>
    {file ? <>
      <p className="elite-caption" role="status">PDF pronto: {sessions.length} {sessions.length === 1 ? 'sessão' : 'sessões'}. Escolha WhatsApp na folha de compartilhamento, ou baixe o arquivo.</p>
      <div className="history-export-buttons">
        <button className="button button-primary" type="button" onClick={() => void share()}><Share2 size={18} /> Compartilhar PDF</button>
        <button className="button button-secondary" type="button" onClick={download}><Download size={18} /> Baixar PDF</button>
      </div>
    </> : <button className="button button-primary button-wide" type="button" disabled={busy || !sessions.length} onClick={() => void prepare()}><FileText size={18} /> {busy ? 'Preparando PDF…' : 'Preparar PDF'}</button>}
    {message ? <p className="elite-caption" role="status">{message}</p> : null}
  </div>;
}
