import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REST_ALERT_KIND = 'workout-rest-finished';
const SOUND_VIBRATE_CHANNEL_ID = 'rest-timer-sound-vibrate-v2';
const SOUND_ONLY_CHANNEL_ID = 'rest-timer-sound-v2';
const SILENT_VIBRATE_CHANNEL_ID = 'rest-timer-vibrate-v2';
const SILENT_CHANNEL_ID = 'rest-timer-silent-v2';
const VIBRATION_PATTERN = [0, 250, 120, 250];

let initializationPromise: Promise<void> | null = null;

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

/**
 * Native delivery is ultimately controlled by the operating system.
 * Keep these limitations visible wherever notification permission is explained.
 */
export const REST_ALERT_LIMITATIONS = [
  'O alerta exige permissão de notificações do sistema.',
  'Modo Silencioso, Foco/Não Perturbe e os Ajustes do iPhone podem impedir som ou vibração.',
  'Feedback háptico depende do aparelho, das configurações do sistema e do modo de economia de energia.',
] as const;

type NativePermissionStatus = Awaited<
  ReturnType<typeof Notifications.getPermissionsAsync>
>;

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

function mapPermission(status: NativePermissionStatus): RestAlertPermission {
  if (Platform.OS === 'ios' && status.ios) {
    switch (status.ios.status) {
      case Notifications.IosAuthorizationStatus.AUTHORIZED:
      case Notifications.IosAuthorizationStatus.PROVISIONAL:
      case Notifications.IosAuthorizationStatus.EPHEMERAL:
        return 'granted';
      case Notifications.IosAuthorizationStatus.DENIED:
        return 'denied';
      case Notifications.IosAuthorizationStatus.NOT_DETERMINED:
        return 'prompt';
    }
  }

  switch (status.status) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'undetermined':
      return 'prompt';
    default:
      return 'unsupported';
  }
}

function isRestAlert(notification: Notifications.Notification): boolean {
  return notification.request.content.data?.kind === REST_ALERT_KIND;
}

function shouldPlayNotificationSound(notification: Notifications.Notification): boolean {
  return notification.request.content.data?.soundEnabled !== false;
}

function shouldVibrateNotification(notification: Notifications.Notification): boolean {
  return notification.request.content.data?.vibrationEnabled !== false;
}

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  const sharedChannelOptions = {
    description: 'Avisos quando o tempo de descanso termina.',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: false,
  };

  await Promise.all([
    Notifications.setNotificationChannelAsync(SOUND_VIBRATE_CHANNEL_ID, {
      ...sharedChannelOptions,
      name: 'Fim do descanso (som e vibração)',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: VIBRATION_PATTERN,
    }),
    Notifications.setNotificationChannelAsync(SOUND_ONLY_CHANNEL_ID, {
      ...sharedChannelOptions,
      name: 'Fim do descanso (som)',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      enableVibrate: false,
      vibrationPattern: null,
    }),
    Notifications.setNotificationChannelAsync(SILENT_VIBRATE_CHANNEL_ID, {
      ...sharedChannelOptions,
      name: 'Fim do descanso (vibração)',
      importance: Notifications.AndroidImportance.HIGH,
      sound: null,
      enableVibrate: true,
      vibrationPattern: VIBRATION_PATTERN,
    }),
    Notifications.setNotificationChannelAsync(SILENT_CHANNEL_ID, {
      ...sharedChannelOptions,
      name: 'Fim do descanso (silencioso)',
      importance: Notifications.AndroidImportance.HIGH,
      sound: null,
      enableVibrate: false,
      vibrationPattern: null,
    }),
  ]);
}

/**
 * Installs the foreground presentation policy and creates the Android channels.
 * It is safe to call repeatedly; scheduleRestAlert also calls it automatically.
 */
export function initializeRestAlerts(): Promise<void> {
  if (initializationPromise) {
    return initializationPromise;
  }

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: isRestAlert(notification)
        ? shouldPlayNotificationSound(notification)
        : true,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });

  Notifications.addNotificationReceivedListener((notification) => {
    if (isRestAlert(notification) && shouldVibrateNotification(notification)) {
      void playRestAlertFeedback();
    }
  });

  initializationPromise = ensureAndroidChannels().catch((error: unknown) => {
    initializationPromise = null;
    throw error;
  });

  return initializationPromise;
}

export async function getRestAlertPermission(): Promise<RestAlertPermission> {
  await initializeRestAlerts();
  return mapPermission(await Notifications.getPermissionsAsync());
}

/**
 * Call from a user action when possible. Android 13 requires a channel to exist
 * before its notification permission prompt can be displayed.
 */
export async function requestRestAlertPermission(): Promise<RestAlertPermission> {
  await initializeRestAlerts();

  const current = mapPermission(await Notifications.getPermissionsAsync());
  if (current !== 'prompt') {
    return current;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });

  return mapPermission(requested);
}

/**
 * Native audio is emitted by the scheduled notification. This method adds the
 * success haptic used when the alert is received while the app is foregrounded.
 */
export async function playRestAlertFeedback(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Haptics are optional and may be unavailable on a device or simulator.
  }
}

/** Native notification audio needs no browser-style priming. */
export async function primeRestAlertAudio(): Promise<boolean> {
  return true;
}

/**
 * Schedules a one-off local notification for an absolute end time. If endAt is
 * already past, the notification is presented immediately.
 */
export async function scheduleRestAlert(
  options: RestAlertScheduleOptions,
): Promise<RestAlertScheduleResult> {
  const identifier = normalizeIdentifier(options.identifier);
  const endAt = normalizeEndAt(options.endAt);
  const soundEnabled = options.soundEnabled ?? true;
  const vibrationEnabled = options.vibrationEnabled ?? true;

  await initializeRestAlerts();
  await cancelRestAlert(identifier);

  const permission = options.requestPermission === false
    ? await getRestAlertPermission()
    : await requestRestAlertPermission();
  if (permission !== 'granted') {
    return {
      identifier,
      endAt,
      permission,
      scheduled: false,
    };
  }

  const channelId = soundEnabled
    ? vibrationEnabled ? SOUND_VIBRATE_CHANNEL_ID : SOUND_ONLY_CHANNEL_ID
    : vibrationEnabled ? SILENT_VIBRATE_CHANNEL_ID : SILENT_CHANNEL_ID;
  const isPast = endAt.getTime() <= Date.now();
  const trigger: Notifications.NotificationTriggerInput = isPast
    ? Platform.OS === 'android'
      ? { channelId }
      : null
    : {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: endAt,
        ...(Platform.OS === 'android' ? { channelId } : {}),
      };

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: options.title ?? 'Descanso concluído',
      body: options.body ?? 'Hora da próxima série.',
      sound: soundEnabled ? 'default' : false,
      vibrate: vibrationEnabled ? VIBRATION_PATTERN : [],
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: {
        ...options.data,
        kind: REST_ALERT_KIND,
        restAlertIdentifier: identifier,
        endAt: endAt.toISOString(),
        soundEnabled,
        vibrationEnabled,
      },
    },
    trigger,
  });

  return {
    identifier,
    endAt,
    permission,
    scheduled: true,
  };
}

/** Cancels a pending alert and dismisses the same alert if already delivered. */
export async function cancelRestAlert(identifier: string): Promise<void> {
  const normalized = normalizeIdentifier(identifier);

  await Notifications.cancelScheduledNotificationAsync(normalized);

  try {
    await Notifications.dismissNotificationAsync(normalized);
  } catch {
    // Dismissing an identifier that was never delivered is intentionally idempotent.
  }
}
