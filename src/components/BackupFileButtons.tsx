import { useState } from 'react';
import { downloadLocalFile, shareLocalFile } from '../lib/localFiles';
import '../screens/history-export.css';

export function BackupFileButtons({ file }: { file: File }) {
  const [message, setMessage] = useState('');
  const format = file.name.endsWith('.zip') ? 'ZIP' : 'JSON';
  return <div className="history-pdf-actions">
    <p className="elite-caption">{file.name} · contém dados pessoais. Guarde em um local privado.</p>
    <div className="history-export-buttons">
      <button className="button button-primary" type="button" onClick={() => {
        setMessage('');
        void shareLocalFile(file).catch((cause: unknown) => {
          if (!(cause instanceof Error && cause.name === 'AbortError')) setMessage(`Não foi possível compartilhar. Use Baixar ${format}.`);
        });
      }}>Compartilhar {format}</button>
      <button className="button button-secondary" type="button" onClick={() => {
        try { downloadLocalFile(file); setMessage('Download solicitado. Confira no app Arquivos.'); }
        catch { setMessage('Não foi possível iniciar o download.'); }
      }}>Baixar {format}</button>
    </div>
    {message ? <p role="status">{message}</p> : null}
  </div>;
}
