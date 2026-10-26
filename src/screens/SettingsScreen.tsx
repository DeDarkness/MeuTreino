import { BellRing, Check, Database, Dumbbell, Download, LockKeyhole, Smartphone, Trash2, Upload, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { PushNotificationSettings } from '../components/PushNotificationSettings';
import type { PushStatus } from '../lib/pushNotifications';
import { playRestAlert, primeRestAlertAudio } from '../lib/restAlert';
import { readSafetySnapshot } from '../lib/database';
import { formatDate } from '../lib/format';
import type { Preferences } from '../types';

type SettingsScreenProps = {
  preferences: Preferences;
  isStandalone: boolean;
  storagePersistent: boolean | null;
  onPreferencesChange: (patch: Partial<Preferences>) => void;
  onExport: () => Promise<void>;
  onExportRecovery: () => Promise<void>;
  onImport: (file: File) => Promise<void>;
  onClear: () => Promise<void>;
  onInstallPreSurgicalProtocol: () => Promise<void>;
  onRequestPersistence: () => Promise<boolean>;
  pushStatus: PushStatus;
  onNotificationPermissionChange: () => void;
};

export function SettingsScreen({
  preferences,
  isStandalone,
  storagePersistent,
  onPreferencesChange,
  onExport,
  onExportRecovery,
  onImport,
  onClear,
  onInstallPreSurgicalProtocol,
  onRequestPersistence,
  pushStatus,
  onNotificationPermissionChange,
}: SettingsScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkpoint, setCheckpoint] = useState<{ label: string; createdAt: string } | null>(null);
  useEffect(() => { let active = true; void readSafetySnapshot().then((value) => { if (active) setCheckpoint(value ? { label: value.label, createdAt: value.createdAt } : null); }).catch(() => undefined); return () => { active = false; }; }, [message]);
  const vibrationSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const run = async (action: () => Promise<void>, success: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a ação.');
    } finally { setBusy(false); }
  };

  return (
    <section className="screen" aria-labelledby="settings-title">
      <header className="screen-heading">
        <div>
          <p className="eyebrow">Do seu jeito</p>
          <h1 id="settings-title">Ajustes</h1>
          <p>Preferências e dados salvos neste iPhone.</p>
        </div>
      </header>

      {message ? <div className="toast-message" role="status">{message}<button type="button" onClick={() => setMessage(null)}>×</button></div> : null}

      <SettingsGroup title="Alertas do descanso" icon={<BellRing />}>
        <PushNotificationSettings status={pushStatus} onPermissionChange={onNotificationPermissionChange} />
        <ToggleRow
          label="Som ao terminar"
          description="Toca um aviso reforçado de aproximadamente 3 segundos."
          checked={preferences.soundEnabled}
          onChange={(checked) => onPreferencesChange({ soundEnabled: checked })}
        />
        <ToggleRow
          label="Vibração"
          description={vibrationSupported ? 'Usa o feedback tátil disponível no navegador.' : 'Este navegador não oferece vibração para Web Apps.'}
          checked={preferences.vibrationEnabled}
          onChange={(checked) => onPreferencesChange({ vibrationEnabled: checked })}
          disabled={!vibrationSupported}
        />
        <div className="setting-row stacked">
          <div><strong>Som do aviso</strong><span>Escolha o toque do descanso.</span></div>
          <div className="segmented-control" role="group" aria-label="Som do aviso">
            {(['bell', 'beep'] as const).map((sound) => (
              <button className={preferences.restAlertSound === sound ? 'selected' : ''} type="button" key={sound} aria-pressed={preferences.restAlertSound === sound} onClick={() => onPreferencesChange({ restAlertSound: sound })}>
                {sound === 'bell' ? 'Sino' : 'Beep'}
              </button>
            ))}
          </div>
        </div>
        <button className="setting-action" type="button" onClick={() => {
          primeRestAlertAudio(true);
          playRestAlert(preferences.restAlertSound);
          setMessage('Reproduzindo o aviso de descanso.');
        }}><Volume2 /> <span><strong>Testar som do descanso</strong><small>Reproduz agora o alerta longo selecionado.</small></span></button>
      </SettingsGroup>

      <SettingsGroup title="Padrões do treino" icon={<Smartphone />}>
        <ToggleRow label="Reduzir animações" description="Pausa o wallpaper em vídeo e reduz os movimentos da interface. Também respeita a preferência de acessibilidade do iPhone." checked={preferences.reduceMotion ?? false} onChange={(reduceMotion) => onPreferencesChange({ reduceMotion })} />
        <div className="setting-row stacked">
          <div><strong>Descanso padrão</strong><span>Usado ao adicionar um exercício.</span></div>
          <div className="rest-options" role="group" aria-label="Descanso padrão">
            {[45, 60, 90, 120].map((seconds) => (
              <button className={preferences.defaultRestSeconds === seconds ? 'selected' : ''} type="button" key={seconds} aria-pressed={preferences.defaultRestSeconds === seconds} onClick={() => onPreferencesChange({ defaultRestSeconds: seconds })}>
                {formatRestOption(seconds)}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row stacked">
          <div><strong>Unidade de carga</strong><span>As cargas são convertidas na tela.</span></div>
          <div className="segmented-control" role="group" aria-label="Unidade de carga">
            {(['kg', 'lb'] as const).map((unit) => (
              <button className={preferences.weightUnit === unit ? 'selected' : ''} type="button" key={unit} aria-pressed={preferences.weightUnit === unit} onClick={() => onPreferencesChange({ weightUnit: unit })}>{unit}</button>
            ))}
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Protocolos de treino" icon={<Dumbbell />}>
        <button className="setting-action" type="button" onClick={() => {
          if (window.confirm('Aplicar Full Body pré-cirurgia (22/23/21 séries)? Isso substitui as fichas padrão A/B/C. O histórico e as demais fichas serão preservados. Fichas padrão editadas serão arquivadas como versões pessoais. Recomendamos exportar backup antes.')) {
            void run(onInstallPreSurgicalProtocol, 'Protocolo pré-cirurgia instalado. Fichas e histórico pessoal preservados.');
          }
        }}><Dumbbell /> <span><strong>Aplicar Full Body pré-cirurgia</strong><small>66 séries semanais · A/B/C · prioridade em costas e braços · atualização manual e reversível por backup.</small></span></button>
      </SettingsGroup>

      <SettingsGroup title="Dados neste iPhone" icon={<Database />}>
        <div className="privacy-box"><LockKeyhole /><div><strong>Seus dados neste aparelho</strong><p>Treinos, alimentação, medidas e orientações pessoais ficam somente aqui. Se você ativar os avisos em segundo plano, a Cloudflare recebe apenas a inscrição de notificações e os avisos agendados. Não existe sincronização automática entre dispositivos.</p></div></div>
        <button className="setting-action" type="button" disabled={busy} onClick={() => run(onExport, 'Backup exportado.')}><Download /> <span><strong>Exportar backup completo</strong><small>Inclui treinos, histórico, sessão ativa, reposições, alimentação, perfil e medidas. Salve no app Arquivos. Wallpaper e inscrição Push não são incluídos. O arquivo contém dados pessoais: guarde com cuidado.</small></span></button>
        {checkpoint ? <button className="setting-action" type="button" disabled={busy} onClick={() => run(onExportRecovery, 'Cópia de segurança exportada. Use Importar backup se desejar restaurá-la.')}><Download /><span><strong>Exportar cópia de segurança anterior</strong><small>{checkpoint.label} · {formatDate(checkpoint.createdAt, true)}. Guardada antes de importar, excluir ou trocar fichas.</small></span></button> : null}
        <p className="elite-caption elite-settings-caption">Uma cópia anterior é protegida automaticamente nas operações acima. Ela permanece somente neste aparelho e não substitui um backup no app Arquivos.</p>
        <button className="setting-action" type="button" disabled={busy} onClick={() => fileInputRef.current?.click()}><Upload /> <span><strong>Importar backup</strong><small>Valida o JSON antes de substituir os dados e preserva uma cópia anterior.</small></span></button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file && window.confirm(`Importar “${file.name}”? Os treinos, o histórico e os ajustes atuais serão substituídos.`)) {
              void run(() => onImport(file), 'Backup importado.');
            }
            event.currentTarget.value = '';
          }}
        />
        {storagePersistent === false ? (
          <button className="setting-action" type="button" onClick={() => run(async () => {
            const granted = await onRequestPersistence();
            if (!granted) throw new Error('O iPhone ainda não concedeu armazenamento persistente. O backup continua disponível.');
          }, 'Armazenamento persistente ativado.')}><LockKeyhole /> <span><strong>Proteger armazenamento</strong><small>Solicita ao navegador que preserve os dados locais.</small></span></button>
        ) : storagePersistent ? (
          <div className="persistence-ok"><Check size={17} /> Armazenamento persistente ativo</div>
        ) : null}
        <button className="setting-action danger" type="button" disabled={busy} onClick={() => {
          if (window.confirm('Apagar treinos, histórico, pendências, alimentação, perfil, medidas e ajustes deste iPhone? Esta ação não pode ser desfeita.')) {
            void run(onClear, 'Dados apagados.');
          }
        }}><Trash2 /> <span><strong>Apagar todos os dados</strong><small>Remove treinos, histórico, pendências, alimentação, medidas, perfil, sessão ativa, wallpaper e a cópia de segurança local.</small></span></button>
      </SettingsGroup>

      <SettingsGroup title="Instalação" icon={<Smartphone />}>
        {isStandalone ? (
          <div className="installed-state"><Check /> <div><strong>Instalado no iPhone</strong><p>O MeuTreino está abrindo como Web App.</p></div></div>
        ) : (
          <ol className="install-steps">
            <li>Abra esta página no <strong>Safari</strong>.</li>
            <li>Toque em <strong>Compartilhar</strong>.</li>
            <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
            <li>Ative <strong>Abrir como App</strong> e toque em Adicionar.</li>
          </ol>
        )}
      </SettingsGroup>

      <footer className="app-about"><strong>MeuTreino Elite</strong><span>Versão 8.0.1 · seu treino, seus dados</span></footer>
    </section>
  );
}

function SettingsGroup({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="settings-group"><header><span>{icon}</span><h2>{title}</h2></header><div className="settings-card">{children}</div></section>;
}

function ToggleRow({ label, description, checked, disabled = false, onChange }: { label: string; description: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label className={`setting-row toggle-row${disabled ? ' is-disabled' : ''}`}><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}

function formatRestOption(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}:${remainder.toString().padStart(2, '0')}` : `${minutes} min`;
}
