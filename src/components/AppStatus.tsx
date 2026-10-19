import { useSyncExternalStore } from 'react';
import { CheckCircle2, LoaderCircle, WifiOff } from 'lucide-react';

const subscribe = (listener: () => void) => {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener); };
};
export function AppStatus({ saving, hasError }: { saving: boolean; hasError: boolean }) {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  return <div className={`elite-app-status${!online ? ' is-offline' : ''}`} role="status">
    {saving ? <LoaderCircle size={13} /> : !online ? <WifiOff size={13} /> : <CheckCircle2 size={13} />}
    <span>{saving ? 'Salvando no aparelho…' : hasError ? 'Há um aviso que precisa da sua atenção' : online ? 'Dados no aparelho · sem conta' : 'Offline · registro de treino disponível'}</span>
    {!online ? <small>Avisos em segundo plano precisam de internet.</small> : null}
  </div>;
}
