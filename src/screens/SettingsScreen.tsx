import { BellRing, Check, Database, Download, Info, LockKeyhole, Smartphone, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import type { RestNotificationPermission } from '../lib/notifications';
import type { Preferences } from '../types';

type SettingsScreenProps = {
  preferences: Preferences;
  isStandalone: boolean;
  storagePersistent: boolean | null;
  onPreferencesChange: (patch: Partial<Preferences>) => void;
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<void>;
  onClear: () => Promise<void>;
  onRequestPersistence: () => Promise<boolean>;
  notificationPermission: RestNotificationPermission;
  onRequestNotifications: () => Promise<RestNotificationPermission>;
};

export function SettingsScreen({
  preferences,
  isStandalone,
  storagePersistent,
  onPreferencesChange,
  onExport,
  onImport,
  onClear,
  onRequestPersistence,
  notificationPermission,
  onRequestNotifications,
}: SettingsScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const vibrationSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const run = async (action: () => Promise<void>, success: string) => {
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a ação.');
    }
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
        {notificationPermission === 'granted' ? (
          <div className="installed-state"><Check /><div><strong>Notificações autorizadas</strong><p>O iPhone pode mostrar o aviso quando o descanso terminar.</p></div></div>
        ) : notificationPermission === 'default' ? (
          <button className="setting-action" type="button" onClick={() => void (async () => {
            const permission = await onRequestNotifications();
            setMessage(permission === 'granted' ? 'Notificações ativadas.' : 'A permissão de notificações não foi concedida.');
          })()}><BellRing /> <span><strong>Ativar notificações</strong><small>O iPhone perguntará se você aceita receber os avisos.</small></span></button>
        ) : (
          <p className="settings-note"><Info size={16} /> {notificationPermission === 'denied' ? 'As notificações estão bloqueadas. Ative-as em Ajustes → Notificações → MeuTreino.' : 'Instale o MeuTreino na Tela de Início para permitir notificações no iPhone.'}</p>
        )}
        <ToggleRow
          label="Som ao terminar"
          description="Toca um aviso quando o contador chega a zero."
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
        <p className="settings-note"><Info size={16} /> A tela poderá apagar normalmente. Como o cronômetro é local, o iOS pode atrasar o aviso caso suspenda o Web App com a tela bloqueada.</p>
      </SettingsGroup>

      <SettingsGroup title="Padrões do treino" icon={<Smartphone />}>
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

      <SettingsGroup title="Dados neste iPhone" icon={<Database />}>
        <div className="privacy-box"><LockKeyhole /><div><strong>Local e privado</strong><p>Treinos e histórico ficam somente neste aparelho. Nenhum login ou servidor é usado.</p></div></div>
        <button className="setting-action" type="button" onClick={() => run(onExport, 'Backup exportado.')}><Download /> <span><strong>Exportar backup</strong><small>Salve uma cópia em JSON no app Arquivos.</small></span></button>
        <button className="setting-action" type="button" onClick={() => fileInputRef.current?.click()}><Upload /> <span><strong>Importar backup</strong><small>Substitui os dados atuais por um backup válido.</small></span></button>
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
        <button className="setting-action danger" type="button" onClick={() => {
          if (window.confirm('Apagar todos os treinos, histórico e ajustes deste iPhone? Esta ação não pode ser desfeita.')) {
            void run(onClear, 'Dados apagados.');
          }
        }}><Trash2 /> <span><strong>Apagar todos os dados</strong><small>Remove treinos, histórico e sessão ativa.</small></span></button>
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

      <footer className="app-about"><strong>MeuTreino</strong><span>Versão 3.0 · PWA pessoal e offline</span></footer>
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
