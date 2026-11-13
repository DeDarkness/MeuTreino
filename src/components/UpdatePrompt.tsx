import { RefreshCw, WifiOff } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect, useRef, useState } from 'react';

export function UpdatePrompt({ workoutInProgress = false, saving = false, canReload }: { workoutInProgress?: boolean; saving?: boolean; canReload?: () => boolean }) {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const checking = useRef(false);
  const [updateError, setUpdateError] = useState(false);
  useEffect(() => {
    const check = () => {
      const registration = registrationRef.current;
      if (!registration || checking.current || document.visibilityState !== 'visible' || !navigator.onLine) return;
      checking.current = true;
      void registration.update().catch(() => undefined).finally(() => { checking.current = false; });
    };
    const interval = window.setInterval(check, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
    };
  }, []);
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      registrationRef.current = registration;
    },
  });

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="update-prompt" role="status">
      {needRefresh ? <RefreshCw size={19} /> : <WifiOff size={19} />}
      <div>
        <strong>{needRefresh ? 'Atualização disponível' : 'Pronto para usar offline'}</strong>
        <span>{needRefresh ? workoutInProgress ? 'Sua sessão está protegida. Termine o treino para atualizar.' : saving ? 'Aguarde a gravação dos dados.' : updateError ? 'Não foi possível atualizar agora. Tente novamente com internet.' : 'Recarregue para usar a nova versão. Seus registros serão preservados.' : 'O MeuTreino foi salvo neste iPhone.'}</span>
      </div>
      {needRefresh ? (
        <button type="button" disabled={workoutInProgress || saving} onClick={() => {
          if (workoutInProgress || saving || canReload?.() === false) return;
          setUpdateError(false);
          void updateServiceWorker(true).catch(() => setUpdateError(true));
        }}>Atualizar</button>
      ) : (
        <button type="button" aria-label="Fechar" onClick={() => setOfflineReady(false)}>×</button>
      )}
      {needRefresh ? <button className="prompt-close" type="button" aria-label="Agora não" onClick={() => setNeedRefresh(false)}>×</button> : null}
    </div>
  );
}
