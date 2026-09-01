import { RefreshCw, WifiOff } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      window.setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="update-prompt" role="status">
      {needRefresh ? <RefreshCw size={19} /> : <WifiOff size={19} />}
      <div>
        <strong>{needRefresh ? 'Atualização disponível' : 'Pronto para usar offline'}</strong>
        <span>{needRefresh ? 'Recarregue para usar a nova versão.' : 'O MeuTreino foi salvo neste iPhone.'}</span>
      </div>
      {needRefresh ? (
        <button type="button" onClick={() => void updateServiceWorker(true)}>Atualizar</button>
      ) : (
        <button type="button" aria-label="Fechar" onClick={() => setOfflineReady(false)}>×</button>
      )}
      {needRefresh ? <button className="prompt-close" type="button" aria-label="Agora não" onClick={() => setNeedRefresh(false)}>×</button> : null}
    </div>
  );
}
