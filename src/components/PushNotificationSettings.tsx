import { BellOff, BellRing, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import {
  disablePushNotifications,
  enablePushNotifications,
  retryPushRest,
  syncPushRest,
  testPushNotification,
  type PushStatus,
} from '../lib/pushNotifications';
import type { ActiveWorkout } from '../types';

export function PushNotificationSettings({ status, workout, soundEnabled, onPermissionChange }: {
  status: PushStatus;
  workout: ActiveWorkout | null;
  soundEnabled: boolean;
  onPermissionChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const run = async (operation: () => Promise<void>, success?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await operation();
      if (success) setMessage(success);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Não foi possível concluir a ação.');
    } finally {
      onPermissionChange();
      setBusy(false);
    }
  };
  const unavailable = status.phase === 'unconfigured' || status.phase === 'unsupported';
  return (
    <div className="push-settings">
      <div className={`push-settings__status${status.phase === 'error' ? ' is-error' : ''}`} role="status">
        {status.enabled && status.phase !== 'error' ? <CheckCircle2 size={19} /> : <BellRing size={19} />}
        <div><strong>Avisos com a tela bloqueada</strong><p>{status.message}</p></div>
      </div>
      {!unavailable && !status.enabled ? (
        <button className="setting-action" type="button" disabled={busy || status.phase === 'preparing'} onClick={() => void run(async () => {
          await enablePushNotifications();
          await syncPushRest(workout, soundEnabled, true);
        }, 'Avisos ativados neste aparelho.')}><BellRing /><span><strong>{busy ? 'Ativando…' : 'Ativar avisos em segundo plano'}</strong><small>Permita os avisos quando o iPhone perguntar.</small></span></button>
      ) : null}
      {status.enabled ? (
        <>
          <button className="setting-action" type="button" disabled={busy} onClick={() => void run(testPushNotification, 'Teste agendado para daqui a 10 segundos. Bloqueie a tela ou abra outro aplicativo.')}><BellRing /><span><strong>Testar com a tela bloqueada</strong><small>Envia um aviso em 10 segundos, sem alterar seu descanso.</small></span></button>
          <button className="setting-action" type="button" disabled={busy} onClick={() => void run(disablePushNotifications, 'Avisos em segundo plano desativados.')}><BellOff /><span><strong>Desativar avisos em segundo plano</strong><small>O som dentro do app continua disponível.</small></span></button>
        </>
      ) : null}
      {status.phase === 'error' ? (
        <button className="setting-action" type="button" disabled={busy} onClick={() => void run(retryPushRest)}><RefreshCw /><span><strong>Tentar conectar novamente</strong><small>Verifique a conexão com a internet.</small></span></button>
      ) : null}
      {message ? <p className="push-settings__message" role="status">{message}</p> : null}
      <p className="settings-note"><Info size={16} /> O aviso em segundo plano usa internet e pode atrasar. O som desse aviso segue os ajustes do iPhone; o toque escolhido abaixo é usado com o app aberto.</p>
    </div>
  );
}
