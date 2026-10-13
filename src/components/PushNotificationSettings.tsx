import { BellRing, CheckCircle2, Info } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getPushDiagnostics, testPushNotification, type PushStatus, type PushDiagnostics } from '../lib/pushNotifications';

export function PushNotificationSettings({ status, onPermissionChange }: {
  status: PushStatus;
  onPermissionChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<PushDiagnostics | null>(null);
  const [testRequestedAt, setTestRequestedAt] = useState<number | null>(null);

  useEffect(() => {
    if (testRequestedAt === null) return;
    let cancelled = false;
    let inspecting = false;
    let timer: number | undefined;
    const inspect = async () => {
      if (cancelled || inspecting || document.visibilityState !== 'visible') return;
      if (Date.now() - testRequestedAt < 12_000) {
        timer = window.setTimeout(() => void inspect(), testRequestedAt + 12_000 - Date.now());
        return;
      }
      inspecting = true;
      try {
        const report = await getPushDiagnostics();
        if (cancelled) return;
        setDiagnostics(report);
        const waiting = !report.test || ['scheduled', 'retrying'].includes(report.test.status);
        if (waiting && Date.now() - testRequestedAt < 90_000) {
          timer = window.setTimeout(() => void inspect(), 5000);
        } else {
          setPending(false);
        }
      } finally {
        inspecting = false;
      }
    };
    const onVisibility = () => { window.clearTimeout(timer); void inspect(); };
    timer = window.setTimeout(() => void inspect(), Math.max(0, testRequestedAt + 12_000 - Date.now()));
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [testRequestedAt]);

  const test = async () => {
    setBusy(true);
    setMessage(null);
    setDiagnostics(null);
    setTestRequestedAt(null);
    try {
      await testPushNotification();
      setTestRequestedAt(Date.now());
      setPending(true);
      setMessage('Teste agendado para daqui a 10 segundos. Bloqueie a tela ou abra outro aplicativo. O resultado aparece automaticamente quando você voltar.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Não foi possível testar. Confira a conexão e tente novamente.');
      setPending(false);
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
      <button className="setting-action" type="button" disabled={unavailable || busy || pending || status.phase === 'preparing'} onClick={() => void test()}>
        <BellRing /><span><strong>{busy ? 'Preparando teste…' : pending ? 'Aguardando resultado…' : 'Testar notificações'}</strong><small>Autoriza e conecta, se necessário. Envia um aviso em 10 segundos.</small></span>
      </button>
      {message && !diagnostics ? <p className="push-settings__message" role="status">{message}</p> : null}
      {diagnostics ? (
        <div className="push-diagnostics" role="status">
          <strong>{testLabel(diagnostics.test)}</strong>
          <p>{diagnostics.message}</p>
          <details>
            <summary>Detalhes do teste</summary>
            <dl>
              <div><dt>Instalado na Tela de Início</dt><dd>{diagnostics.installed ? 'Sim' : 'Não'}</dd></div>
              <div><dt>Permissão do iPhone</dt><dd>{permissionLabel(diagnostics.permission)}</dd></div>
              <div><dt>Inscrição no aparelho</dt><dd>{diagnostics.subscription ? 'Conectada' : 'Não conectada'}</dd></div>
              <div><dt>Recebimento no aplicativo</dt><dd>{diagnostics.receiverReady ? 'Atualizado' : 'Aguardando atualização'}</dd></div>
              <div><dt>Conexão com o serviço</dt><dd>{diagnostics.serverConnected ? 'Confirmada' : 'Não confirmada'}</dd></div>
            </dl>
          </details>
        </div>
      ) : null}
      <p className="settings-note"><Info size={16} /> Sempre ativos após sua autorização, sem chave liga/desliga no app. Para bloquear, use os Ajustes do iPhone. Precisam de internet; o som da notificação segue os ajustes do iPhone.</p>
    </div>
  );
}

function permissionLabel(permission: PushDiagnostics['permission']) {
  return { granted: 'Autorizada', denied: 'Bloqueada nos Ajustes', default: 'Ainda não autorizada', unsupported: 'Indisponível neste modo' }[permission];
}

function testLabel(test: PushDiagnostics['test']) {
  if (!test) return 'Resultado do teste ainda indisponível';
  if (test.status === 'accepted') return 'Teste enviado ao sistema do iPhone';
  if (test.status === 'scheduled') return 'Teste agendado, aguardando envio';
  if (test.status === 'cancelled') return 'Teste cancelado';
  if (test.status === 'expired') return 'O teste expirou antes de ser enviado';
  return `${test.status === 'retrying' ? 'Tentando enviar novamente' : 'Falha no envio'}${test.errorCode ? ` (${test.errorCode})` : ''}`;
}
