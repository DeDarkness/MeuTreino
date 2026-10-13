import { BellOff, BellRing, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  disablePushNotifications,
  enablePushNotifications,
  getPushDiagnostics,
  retryPushRest,
  syncPushRest,
  testPushNotification,
  type PushStatus,
  type PushDiagnostics,
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
  const [diagnostics, setDiagnostics] = useState<PushDiagnostics | null>(null);
  const [testRequestedAt, setTestRequestedAt] = useState<number | null>(null);
  useEffect(() => {
    if (testRequestedAt === null) return;
    let cancelled = false;
    const inspect = () => {
      if (document.visibilityState !== 'visible' || Date.now() - testRequestedAt < 12_000) return;
      void getPushDiagnostics().then((report) => { if (!cancelled) setDiagnostics(report); });
    };
    const timer = window.setTimeout(inspect, Math.max(0, testRequestedAt + 12_000 - Date.now()));
    document.addEventListener('visibilitychange', inspect);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', inspect);
    };
  }, [testRequestedAt]);
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
          <button className="setting-action" type="button" disabled={busy} onClick={() => void run(async () => {
            await testPushNotification();
            setDiagnostics(null);
            setTestRequestedAt(Date.now());
          }, 'O serviço confirmou o teste para daqui a 10 segundos. Bloqueie a tela ou abra outro aplicativo. Ao voltar, veja o resultado abaixo.')}><BellRing /><span><strong>Testar com a tela bloqueada</strong><small>Envia um aviso em 10 segundos, sem alterar seu descanso.</small></span></button>
          <button className="setting-action" type="button" disabled={busy} onClick={() => void run(disablePushNotifications, 'Avisos em segundo plano desativados.')}><BellOff /><span><strong>Desativar avisos em segundo plano</strong><small>O som dentro do app continua disponível.</small></span></button>
        </>
      ) : null}
      {status.phase === 'error' ? (
        <button className="setting-action" type="button" disabled={busy} onClick={() => void run(retryPushRest)}><RefreshCw /><span><strong>Tentar conectar novamente</strong><small>Verifique a conexão com a internet.</small></span></button>
      ) : null}
      {message ? <p className="push-settings__message" role="status">{message}</p> : null}
      <button className="setting-action" type="button" disabled={busy} onClick={() => void run(async () => {
        setDiagnostics(await getPushDiagnostics());
      })}><Info /><span><strong>Verificar avisos</strong><small>Confira a permissão, a conexão e o resultado do último teste.</small></span></button>
      {diagnostics ? (
        <div className="push-diagnostics" role="status">
          <dl>
            <div><dt>Instalado na Tela de Início</dt><dd>{diagnostics.installed ? 'Sim' : 'Não'}</dd></div>
            <div><dt>Permissão do iPhone</dt><dd>{permissionLabel(diagnostics.permission)}</dd></div>
            <div><dt>Inscrição de avisos no aparelho</dt><dd>{diagnostics.subscription ? 'Conectada' : 'Não conectada'}</dd></div>
            <div><dt>Recebimento no aplicativo</dt><dd>{diagnostics.receiverReady ? 'Atualizado' : 'Aguardando atualização'}</dd></div>
            <div><dt>Conexão com o serviço</dt><dd>{diagnostics.serverConnected ? 'Confirmada' : 'Não confirmada'}</dd></div>
            <div><dt>Último teste</dt><dd>{testLabel(diagnostics.test)}</dd></div>
          </dl>
          <p>{diagnostics.message}</p>
        </div>
      ) : null}
      <p className="settings-note"><Info size={16} /> O aviso em segundo plano usa internet e pode atrasar. O som desse aviso segue os ajustes do iPhone; o toque escolhido abaixo é usado com o app aberto.</p>
    </div>
  );
}

function permissionLabel(permission: PushDiagnostics['permission']) {
  return { granted: 'Autorizada', denied: 'Bloqueada nos Ajustes', default: 'Ainda não autorizada', unsupported: 'Indisponível neste modo' }[permission];
}

function testLabel(test: PushDiagnostics['test']) {
  if (!test) return 'Nenhum teste registrado';
  if (test.status === 'accepted') return 'Enviado ao sistema do iPhone';
  if (test.status === 'scheduled') return 'Agendado, aguardando envio';
  if (test.status === 'cancelled') return 'Cancelado ao desativar os avisos';
  if (test.status === 'expired') return 'Expirou antes de ser enviado';
  return `${test.status === 'retrying' ? 'Tentando enviar novamente' : 'Falha no envio'}${test.errorCode ? ` (${test.errorCode})` : ''}`;
}
