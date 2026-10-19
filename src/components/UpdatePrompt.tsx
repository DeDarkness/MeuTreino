import { RefreshCw, WifiOff } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect, useRef } from 'react';

export function UpdatePrompt({ workoutInProgress = false }: { workoutInProgress?: boolean }) {
  const interval = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearInterval(interval.current), []);
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      window.clearInterval(interval.current);
      interval.current = window.setInterval(() => { void registration.update().catch(() => undefined); }, 60 * 60 * 1000);
    },
  });

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="update-prompt" role="status">
      {needRefresh ? <RefreshCw size={19} /> : <WifiOff size={19} />}
      <div>
        <strong>{needRefresh ? 'Atualização disponível' : 'Pronto para usar offline'}</strong>
        <span>{needRefresh ? workoutInProgress ? 'Sua sessão está protegida. Termine o treino para atualizar.' : 'Recarregue para usar a nova versão. Seus registros serão preservados.' : 'O MeuTreino foi salvo neste iPhone.'}</span>
      </div>
      {needRefresh ? (
        <button type="button" disabled={workoutInProgress} onClick={() => void updateServiceWorker(true)}>Atualizar</button>
      ) : (
        <button type="button" aria-label="Fechar" onClick={() => setOfflineReady(false)}>×</button>
      )}
      {needRefresh ? <button className="prompt-close" type="button" aria-label="Agora não" onClick={() => setNeedRefresh(false)}>×</button> : null}
    </div>
  );
}
