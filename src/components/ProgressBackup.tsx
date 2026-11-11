import { useRef, useState } from 'react';
import { BackupFileButtons } from './BackupFileButtons';
import { makeProgressArchive, readProgressArchive } from '../lib/progressArchive';
import type { AppState } from '../types';
import type { ProgressPhoto } from '../lib/progressPhotos';
import '../nutrition/nutrition.css';

type Preview = Awaited<ReturnType<typeof readProgressArchive>>;

export function ProgressBackup({ exportJson, onRestore }: {
  exportJson: () => Promise<string>;
  onRestore: (state: AppState, photos: ProgressPhoto[], merge: boolean) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [withImages, setWithImages] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [prepared, setPrepared] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setNotice('');
    try { await action(); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Não foi possível concluir.'); }
    finally { setBusy(false); }
  };

  return <section className="nutrition-screen nutrition-card" aria-label="Backup com fotografias">
    <h2>Backup ZIP</h2>
    <label className="history-report-option"><input type="checkbox" checked={withImages} disabled={busy} onChange={(event) => { setWithImages(event.target.checked); setPrepared(null); }} /> Incluir arquivos das fotos</label>
    <p className="elite-caption">O ZIP contém dados privados. Guarde em um local de sua escolha.</p>
    <div className="history-export-buttons">
      <button className="button button-secondary" type="button" disabled={busy} onClick={() => void run(async () => setPrepared(await makeProgressArchive(await exportJson(), withImages)))}>Preparar backup ZIP</button>
      <button className="button button-secondary" type="button" disabled={busy} onClick={() => input.current?.click()}>Abrir backup ZIP</button>
    </div>
    <input ref={input} type="file" accept=".zip,application/zip" hidden onChange={(event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) { setPreview(null); void run(async () => setPreview(await readProgressArchive(file))); }
    }} />
    {prepared ? <BackupFileButtons file={prepared} /> : null}
    {preview ? <div className="history-selection">
      <p>{preview.state.plans.length} fichas · {preview.state.history.length} sessões · {preview.state.nutrition?.measurements.length ?? 0} avaliações · {preview.photos.length} arquivos de fotos de {preview.metadataCount} registradas</p>
      <button className="button button-primary" type="button" disabled={busy} onClick={() => void run(async () => {
        await onRestore(preview.state, preview.photos, true);
        setPreview(null);
        setNotice('Registros ausentes adicionados ao aparelho.');
      })}>Adicionar registros ausentes</button>
      <button className="button button-secondary" type="button" disabled={busy} onClick={() => {
        if (!window.confirm('Restaurar os dados do ZIP? Os registros e ajustes do app serão substituídos. O estado atual ficará na cópia de segurança local e fotos já salvas serão mantidas.')) return;
        void run(async () => {
          await onRestore(preview.state, preview.photos, false);
          setPreview(null);
          setNotice('Backup restaurado.');
        });
      }}>Restaurar estado do ZIP</button>
    </div> : null}
    {notice ? <p role="status">{notice}</p> : null}
  </section>;
}
