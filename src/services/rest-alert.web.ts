const MAX_TIMEOUT_MS = 2_147_000_000;

let audioContext: AudioContext | null = null;

export type RestAlertPermission =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported';

export type RestAlertEndAt = Date | number | string;

export interface RestAlertScheduleOptions {
  /** Stable application identifier. Scheduling it again replaces the old alert. */
  identifier: string;
  /** Absolute ending time. Numbers are interpreted as Unix time in milliseconds. */
  endAt: RestAlertEndAt;
  title?: string;
  body?: string;
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
  /** Set false for restored/remote timers so the app never prompts outside a user gesture. */
  requestPermission?: boolean;
  data?: Record<string, unknown>;
}

export interface RestAlertScheduleResult {
  identifier: string;
  endAt: Date;
  permission: RestAlertPermission;
  scheduled: boolean;
}

interface PendingRestAlert {
  identifier: string;
  endAt: Date;
  title: string;
  body: string;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  data?: Record<string, unknown>;
  timeoutId?: ReturnType<typeof setTimeout>;
}

const pendingAlerts = new Map<string, PendingRestAlert>();
const visibleNotifications = new Map<string, Notification>();

/**
 * Browser alerts are deliberately page-local; this is not a Web Push service.
 * Keep these limitations visible wherever notification permission is explained.
 */
export const REST_ALERT_LIMITATIONS = [
  'A página precisa continuar aberta; fechar ou recarregar o navegador remove o agendamento em memória.',
  'Abas em segundo plano podem ter timers atrasados pelo navegador.',
  'Notificações exigem HTTPS (ou localhost), suporte do navegador e permissão do usuário.',
  'O navegador normalmente exige que permissão e áudio sejam ativados durante uma ação do usuário.',
  'Políticas de autoplay, economia de bateria ou suspensão do computador podem impedir o som.',
  'Entrega confiável com o navegador fechado exige Service Worker, Web Push e agendamento no servidor.',
] as const;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function normalizeIdentifier(identifier: string): string {
  const normalized = identifier.trim();

  if (!normalized) {
    throw new TypeError('Rest alert identifier must not be empty.');
  }

  return normalized;
}

function normalizeEndAt(endAt: RestAlertEndAt): Date {
  const normalized = endAt instanceof Date ? new Date(endAt.getTime()) : new Date(endAt);

  if (!Number.isFinite(normalized.getTime())) {
    throw new TypeError('Rest alert endAt must be a valid absolute date.');
  }

  return normalized;
}

function notificationConstructor(): typeof Notification | null {
  if (!isBrowser() || !('Notification' in window)) {
    return null;
  }

  return window.Notification;
}

function getAudioContext(): AudioContext | null {
  if (!isBrowser()) {
    return null;
  }

  if (audioContext?.state === 'closed') {
    audioContext = null;
  }

  if (audioContext) {
    return audioContext;
  }

  const browserWindow = window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextConstructor =
    browserWindow.AudioContext ?? browserWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  try {
    audioContext = new AudioContextConstructor();
    return audioContext;
  } catch {
    return null;
  }
}

/**
 * Call synchronously from the click/tap that starts a rest period. It gives the
 * browser a chance to unlock Web Audio before the delayed alert needs it.
 */
export async function primeRestAlertAudio(): Promise<boolean> {
  const context = getAudioContext();
  if (!context) {
    return false;
  }

  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch {
      return false;
    }
  }

  return context.state === 'running';
}

/** Plays a short two-note completion tone using Web Audio. */
export async function playRestAlertFeedback(): Promise<void> {
  const ready = await primeRestAlertAudio();
  const context = getAudioContext();

  if (!ready || !context) {
    return;
  }

  try {
    const startedAt = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, startedAt);
    oscillator.frequency.setValueAtTime(1_174.66, startedAt + 0.27);

    gain.gain.setValueAtTime(0.0001, startedAt);
    gain.gain.exponentialRampToValueAtTime(0.22, startedAt + 0.025);
    gain.gain.setValueAtTime(0.22, startedAt + 0.43);
    gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.55);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startedAt);
    oscillator.stop(startedAt + 0.56);
  } catch {
    // Audio is best-effort because browser autoplay and power policies vary.
  }
}

/** Web has no channel setup; this keeps the native and web service APIs equal. */
export async function initializeRestAlerts(): Promise<void> {}

export async function getRestAlertPermission(): Promise<RestAlertPermission> {
  const NotificationConstructor = notificationConstructor();

  if (!NotificationConstructor) {
    return 'unsupported';
  }

  switch (NotificationConstructor.permission) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'default':
      return 'prompt';
  }
}

/** Must be invoked from a user gesture for consistent browser behavior. */
export async function requestRestAlertPermission(): Promise<RestAlertPermission> {
  const NotificationConstructor = notificationConstructor();
  if (!NotificationConstructor) {
    return 'unsupported';
  }

  const current = await getRestAlertPermission();
  if (current !== 'prompt') {
    return current;
  }

  try {
    const requested = await NotificationConstructor.requestPermission();
    return requested === 'default' ? 'prompt' : requested;
  } catch {
    return 'denied';
  }
}

function armAlert(identifier: string): void {
  const alert = pendingAlerts.get(identifier);
  if (!alert) {
    return;
  }

  const remainingMs = alert.endAt.getTime() - Date.now();
  if (remainingMs <= 0) {
    pendingAlerts.delete(identifier);
    void deliverAlert(alert);
    return;
  }

  alert.timeoutId = setTimeout(
    () => armAlert(identifier),
    Math.min(remainingMs, MAX_TIMEOUT_MS),
  );
}

async function deliverAlert(alert: PendingRestAlert): Promise<void> {
  if (alert.soundEnabled) {
    void playRestAlertFeedback();
  }

  if (alert.vibrationEnabled) {
    try {
      window.navigator.vibrate?.([250, 120, 250]);
    } catch {
      // Browser vibration support and permission are best-effort.
    }
  }

  const NotificationConstructor = notificationConstructor();
  if (!NotificationConstructor || NotificationConstructor.permission !== 'granted') {
    return;
  }

  try {
    const notification = new NotificationConstructor(alert.title, {
      body: alert.body,
      tag: alert.identifier,
      silent: !alert.soundEnabled,
      data: {
        ...alert.data,
        kind: 'workout-rest-finished',
        restAlertIdentifier: alert.identifier,
        endAt: alert.endAt.toISOString(),
      },
    });

    visibleNotifications.get(alert.identifier)?.close();
    visibleNotifications.set(alert.identifier, notification);

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    notification.onclose = () => {
      if (visibleNotifications.get(alert.identifier) === notification) {
        visibleNotifications.delete(alert.identifier);
      }
    };
  } catch {
    // Notification constructors can still fail because of browser/security policy.
  }
}

/**
 * Schedules an in-page alert for an absolute end time. A past endAt is delivered
 * on the next event-loop turn. Reusing the identifier replaces the old alert.
 */
export async function scheduleRestAlert(
  options: RestAlertScheduleOptions,
): Promise<RestAlertScheduleResult> {
  const identifier = normalizeIdentifier(options.identifier);
  const endAt = normalizeEndAt(options.endAt);
  const soundEnabled = options.soundEnabled ?? true;
  const vibrationEnabled = options.vibrationEnabled ?? true;

  if (!isBrowser()) {
    return {
      identifier,
      endAt,
      permission: 'unsupported',
      scheduled: false,
    };
  }

  await cancelRestAlert(identifier);

  // Start resume() before the permission promise yields the original user gesture.
  const audioPrime = soundEnabled ? primeRestAlertAudio() : Promise.resolve(false);
  const permission = options.requestPermission === false
    ? await getRestAlertPermission()
    : await requestRestAlertPermission();
  await audioPrime;

  pendingAlerts.set(identifier, {
    identifier,
    endAt,
    title: options.title ?? 'Descanso concluído',
    body: options.body ?? 'Hora da próxima série.',
    soundEnabled,
    vibrationEnabled,
    data: options.data,
  });
  armAlert(identifier);

  return {
    identifier,
    endAt,
    permission,
    scheduled: true,
  };
}

/** Cancels the in-page timer and closes a visible notification with the same tag. */
export async function cancelRestAlert(identifier: string): Promise<void> {
  const normalized = normalizeIdentifier(identifier);
  const pending = pendingAlerts.get(normalized);

  if (pending?.timeoutId !== undefined) {
    clearTimeout(pending.timeoutId);
  }

  pendingAlerts.delete(normalized);
  visibleNotifications.get(normalized)?.close();
  visibleNotifications.delete(normalized);
}
