export type RestNotificationPermission = NotificationPermission | 'unsupported';

export function getRestNotificationPermission(): RestNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestRestNotificationPermission(): Promise<RestNotificationPermission> {
  if (getRestNotificationPermission() === 'unsupported') return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await showAppNotification('Avisos ativados', 'O MeuTreino avisará quando o descanso terminar.', 'meutreino-notificacoes');
    }
    return permission;
  } catch {
    return getRestNotificationPermission();
  }
}

export async function showRestFinishedNotification(
  exerciseName: string,
  setNumber: number,
): Promise<boolean> {
  return showAppNotification(
    'Descanso finalizado',
    `Próxima: ${exerciseName} · Série ${setNumber}`,
    'meutreino-descanso',
  );
}

async function showAppNotification(title: string, body: string, tag: string): Promise<boolean> {
  if (getRestNotificationPermission() !== 'granted' || !('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const icon = new URL(`${import.meta.env.BASE_URL}icons/icon-192.png`, window.location.origin).href;
    await registration.showNotification(title, {
      body,
      icon,
      badge: icon,
      tag,
    });
    return true;
  } catch {
    return false;
  }
}
