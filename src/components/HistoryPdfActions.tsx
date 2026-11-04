import { Download, FileText, Share2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { WeightUnit, WorkoutHistory } from '../types';

export function HistoryPdfActions({ sessions, weightUnit }: { sessions: WorkoutHistory[]; weightUnit: WeightUnit }) {
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
      setFile(await makeWorkoutHistoryPdf(sessions, weightUnit));
    } catch {
      setMessage('Não foi possível preparar o PDF. Tente selecionar menos sessões e gerar novamente.');
    } finally { lock.current = false; setBusy(false); }
  };

  const share = async () => {
    if (!file || lock.current) return;
    lock.current = true;
    setMessage('');
    try {
      const data = { files: [file] };
      if (!navigator.share || !navigator.canShare?.(data)) {
        setMessage('Compartilhamento direto indisponível aqui. Baixe o PDF e envie como documento no WhatsApp.');
        return;
      }
      // The file already exists; invoke sharing in the tap, before any await.
      await navigator.share(data);
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === 'AbortError')) setMessage('Não foi possível abrir o compartilhamento. Use Baixar PDF e envie o arquivo pelo WhatsApp.');
    } finally { lock.current = false; }
  };

  const download = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return <div className="history-pdf-actions" aria-busy={busy}>
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
