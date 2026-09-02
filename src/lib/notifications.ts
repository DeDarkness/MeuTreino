export type RestNotificationPermission = NotificationPermission | 'unsupported';

export function getRestNotificationPermission(): RestNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestRestNotificationPermission(): Promise<RestNotificationPermission> {
  if (getRestNotificationPermission() === 'unsupported') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return getRestNotificationPermission();
  }
}

export async function showRestFinishedNotification(
  exerciseName: string,
  setNumber: number,
): Promise<boolean> {
  if (getRestNotificationPermission() !== 'granted' || !('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const icon = new URL(`${import.meta.env.BASE_URL}icons/icon-192.png`, window.location.origin).href;
    await registration.showNotification('Descanso finalizado', {
      body: `Próxima: ${exerciseName} · Série ${setNumber}`,
      icon,
      badge: icon,
      tag: 'meutreino-descanso',
    });
    return true;
  } catch {
    return false;
  }
}
