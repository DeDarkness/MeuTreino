import { useState } from 'react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import './recovery.css';

export type ActionConfirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
};

export function ActionDialog({ action, onClose }: { action: ActionConfirmation; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialogFocus(() => { if (!busy) onClose(); });
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try { await action.onConfirm(); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar. Tente novamente.'); }
    finally { setBusy(false); }
  };
  return <div className="recovery-dialog-backdrop">
    <section className="recovery-dialog" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="action-title" aria-describedby="action-description" aria-busy={busy}>
      <p className="eyebrow">VOCÊ NO CONTROLE</p>
      <h2 id="action-title">{action.title}</h2>
      <p id="action-description">{action.message}</p>
      {error ? <p className="recovery-error" role="alert">{error}</p> : null}
      <button className="button button-primary button-wide" type="button" disabled={busy} onClick={() => void confirm()}>{busy ? 'Salvando…' : action.confirmLabel}</button>
      <button className="button button-secondary button-wide" type="button" disabled={busy} onClick={onClose}>Voltar</button>
    </section>
  </div>;
}
