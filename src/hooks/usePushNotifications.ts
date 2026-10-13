import { useEffect, useSyncExternalStore } from 'react';

import { getPushStatus, preparePushNotifications, retryPushRest, subscribePushStatus } from '../lib/pushNotifications';

export function usePushNotifications() {
  const status = useSyncExternalStore(subscribePushStatus, getPushStatus);
  useEffect(() => {
    void preparePushNotifications();
    const reconnect = () => { if (document.visibilityState === 'visible') void retryPushRest(); };
    window.addEventListener('online', reconnect);
    document.addEventListener('visibilitychange', reconnect);
    return () => {
      window.removeEventListener('online', reconnect);
      document.removeEventListener('visibilitychange', reconnect);
    };
  }, []);
  return status;
}
