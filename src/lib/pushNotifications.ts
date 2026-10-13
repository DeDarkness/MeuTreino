import type { ActiveWorkout } from '../types';
import { PUSH_SERVICE_URL } from './pushConfig';

interface PushConnection {
  deviceId: string;
  token: string;
  enabled: boolean;
  revision: number;
  acknowledgedRestId: string | null;
  serviceUrl: string;
}

export interface PushRest {
  id: string;
  endsAt: string;
  body: string;
  silent: boolean;
}

export interface PushStatus {
  phase: 'unconfigured' | 'unsupported' | 'preparing' | 'disabled' | 'ready' | 'scheduling' | 'scheduled' | 'error';
  enabled: boolean;
  message: string;
}

export interface PushDiagnostics {
  installed: boolean;
  permission: NotificationPermission | 'unsupported';
  subscription: boolean;
  receiverReady: boolean;
  serverConnected: boolean;
  test: { status: string; scheduledFor: string; errorCode: string | null } | null;
  message: string;
}

const STORAGE_KEY = 'meutreino-push-connection-v1';
const listeners = new Set<() => void>();
let connection: PushConnection | null = readConnection();
let prepared: { registration: ServiceWorkerRegistration; publicKey: string } | null = null;
let preparation: Promise<void> | null = null;
let connecting: Promise<void> | null = null;
let lastSnapshot: string | undefined;
let retryTimer: number | undefined;
let retryFailures = 0;
let desiredRest: PushRest | null = null;
let desiredRestInitialized = false;
let status: PushStatus = {
  phase: PUSH_SERVICE_URL ? 'preparing' : 'unconfigured',
  enabled: Boolean(connection?.enabled),
  message: PUSH_SERVICE_URL ? 'Preparando avisos em segundo plano…' : 'Avisos em segundo plano ainda não configurados.',
};

function readConnection(): PushConnection | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!value || typeof value.deviceId !== 'string' || typeof value.token !== 'string'
      || typeof value.enabled !== 'boolean' || !Number.isSafeInteger(value.revision)
      || typeof value.serviceUrl !== 'string') return null;
    return value as PushConnection;
  } catch {
    return null;
  }
}

function saveConnection(): void {
  if (connection) localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
  else localStorage.removeItem(STORAGE_KEY);
}

function updateStatus(phase: PushStatus['phase'], message: string): void {
  status = { phase, message, enabled: Boolean(connection?.enabled) };
  for (const listener of listeners) listener();
}

export const getPushStatus = (): PushStatus => status;
export function subscribePushStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function serviceUrl(): string {
  return PUSH_SERVICE_URL.replace(/\/$/, '');
}

async function api(path: string, options: RequestInit = {}, authenticated = false): Promise<Record<string, unknown>> {
  if (!PUSH_SERVICE_URL) throw new Error('O serviço de avisos ainda não foi publicado.');
  const response = await fetch(`${serviceUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authenticated && connection ? { Authorization: `Bearer ${connection.token}` } : {}),
      ...options.headers,
    },
    cache: 'no-store', signal: AbortSignal.timeout(8000),
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    if (authenticated && connection && (response.status === 401 || response.status === 410)) {
      connection.enabled = false;
      connection.acknowledgedRestId = null;
      saveConnection();
      updateStatus('error', 'Reconectando os avisos. Se necessário, toque em Testar notificações.');
    }
    throw new Error(typeof body.error === 'string' ? body.error : 'Não foi possível agendar o aviso.');
  }
  return body;
}

function supported(): boolean {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function pushReceiverReady(registration: ServiceWorkerRegistration): Promise<boolean> {
  if (!registration.active) return false;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    let finished = false;
    const finish = (ready: boolean) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      channel.port1.close();
      channel.port2.close();
      resolve(ready);
    };
    const timeout = window.setTimeout(() => finish(false), 1500);
    channel.port1.onmessage = (event) => finish(event.data?.type === 'MEUTREINO_PUSH_READY' && event.data.protocol === 2);
    registration.active!.postMessage({ type: 'MEUTREINO_PUSH_CHECK' }, [channel.port2]);
  });
}

async function ensurePushReceiver(registration: ServiceWorkerRegistration): Promise<void> {
  if (await pushReceiverReady(registration)) return;
  updateStatus('preparing', 'Atualizando o recebimento dos avisos no aplicativo…');
  await registration.update();
  const installing = registration.installing ?? registration.waiting;
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  if (installing && installing.state !== 'activated') {
    await new Promise<void>((resolve) => {
      const finish = () => {
        window.clearTimeout(timer);
        installing.removeEventListener('statechange', check);
        resolve();
      };
      const check = () => { if (installing.state === 'activated' || installing.state === 'redundant') finish(); };
      const timer = window.setTimeout(finish, 5000);
      installing.addEventListener('statechange', check);
      check();
    });
  }
  if (!await pushReceiverReady(registration)) throw new Error('A atualização dos avisos ainda não está ativa. Feche e abra o MeuTreino novamente.');
}

export function preparePushNotifications(): Promise<void> {
  if (preparation) return preparation;
  if (!PUSH_SERVICE_URL) return Promise.resolve();
  if (!supported()) {
    updateStatus('unsupported', 'No iPhone, abra o MeuTreino pelo ícone da Tela de Início para ativar os avisos.');
    return Promise.resolve();
  }
  preparation = (async () => {
    try {
      const [registration, config] = await Promise.all([
        Promise.race([
          navigator.serviceWorker.ready,
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Reabra o app instalado para preparar os avisos.')), 6000)),
        ]),
        api('/v1/config'),
      ]);
      if (typeof config.publicKey !== 'string') throw new Error('O serviço de avisos ainda está sendo preparado.');
      await ensurePushReceiver(registration);
      prepared = { registration, publicKey: config.publicKey };
      const subscription = await registration.pushManager.getSubscription();
      if (Notification.permission === 'granted' && subscription) {
        // Reconnect existing subscriptions automatically, including old disabled preferences.
        // Never ask for permission or create a subscription without a user gesture.
        await connectSubscription(subscription);
      } else {
        if (connection) {
          connection.enabled = false;
          connection.acknowledgedRestId = null;
          saveConnection();
        }
        updateStatus('disabled', Notification.permission === 'denied'
          ? 'Os avisos foram bloqueados no iPhone. Permita-os em Ajustes → Notificações → MeuTreino.'
          : 'Avisos ligados por padrão. Toque em Testar notificações para autorizar e conectar o iPhone.');
      }
      if (connection?.enabled && desiredRestInitialized) void sendRest(desiredRest, true);
    } catch (cause) {
      preparation = null;
      updateStatus('error', navigator.onLine ? errorMessage(cause) : 'Sem conexão. Os avisos em segundo plano precisam de internet.');
    }
  })();
  return preparation;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Não foi possível conectar os avisos.';
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function publicKeyBytes(publicKey: string): Uint8Array<ArrayBuffer> {
  const binary = atob(publicKey.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function connectSubscription(subscription: PushSubscription): Promise<void> {
  if (connecting) return connecting;
  connecting = (async () => {
    if (!connection || connection.serviceUrl !== serviceUrl()) {
      connection = { deviceId: crypto.randomUUID(), token: randomToken(), enabled: false, revision: 0, acknowledgedRestId: null, serviceUrl: serviceUrl() };
    }
    saveConnection();
    const registered = await api(`/v1/devices/${connection.deviceId}`, { method: 'PUT', body: JSON.stringify(subscription.toJSON()) }, true);
    if (registered.subscribed !== true) throw new Error('O serviço não confirmou a conexão deste aparelho.');
    const wasEnabled = connection.enabled;
    connection.enabled = true;
    saveConnection();
    if (!wasEnabled) lastSnapshot = undefined;
    if (!wasEnabled || !['scheduling', 'scheduled'].includes(status.phase)) updateStatus('ready', 'Notificações ativas automaticamente neste aparelho.');
  })().finally(() => { connecting = null; });
  return connecting;
}

export async function enablePushNotifications(): Promise<void> {
  if (!supported()) throw new Error('Abra o MeuTreino pelo ícone instalado na Tela de Início para permitir os avisos.');
  if (Notification.permission === 'denied') throw new Error('Permita os avisos em Ajustes → Notificações → MeuTreino.');
  // Invoke the permission API synchronously from the tap. Asking via subscribe
  // alone can fail without a prompt on some iPhone permission states.
  const permissionPromise = Notification.permission === 'default'
    ? Notification.requestPermission()
    : null;
  if (permissionPromise) {
    updateStatus('preparing', 'Aguardando a autorização de notificações do iPhone…');
    try {
      const permission = await permissionPromise;
      if (permission !== 'granted') throw new Error(permission === 'denied'
        ? 'A permissão foi bloqueada. Permita os avisos em Ajustes → Notificações → MeuTreino.'
        : 'A autorização não foi concluída. Toque em Testar notificações e aceite os avisos.');
    } catch (cause) {
      updateStatus('error', errorMessage(cause));
      throw cause;
    }
  }
  if (!prepared) {
    await preparePushNotifications();
    if (!prepared) throw new Error(status.message);
  }
  try {
    updateStatus('preparing', 'Conectando os avisos deste aparelho…');
    const subscription = await prepared.registration.pushManager.subscribe({
      userVisibleOnly: true, applicationServerKey: publicKeyBytes(prepared.publicKey),
    });
    await connectSubscription(subscription);
    if (desiredRestInitialized) await sendRest(desiredRest, true);
  } catch (cause) {
    updateStatus('error', errorMessage(cause));
    throw cause;
  }
}

export function getPushRest(workout: ActiveWorkout | null, soundEnabled: boolean, now = Date.now()): PushRest | null {
  if (!workout?.restEndsAt || Date.parse(workout.restEndsAt) <= now || !Number.isFinite(Date.parse(workout.restEndsAt))) return null;
  const exercise = workout.exercises[workout.currentExerciseIndex];
  const set = exercise?.sets[workout.currentSetIndex];
  return {
    id: `${workout.id}/${workout.restEndsAt}`, endsAt: workout.restEndsAt,
    body: `Próxima: ${exercise?.exerciseName ?? 'próxima série'} · Série ${set?.setNumber ?? 1}`.slice(0, 240),
    silent: !soundEnabled,
  };
}

export function isPushRestScheduled(workoutId: string, restEndsAt: string): boolean {
  return Boolean(connection?.enabled && connection.acknowledgedRestId === `${workoutId}/${restEndsAt}`);
}

export async function syncPushRest(workout: ActiveWorkout | null, soundEnabled: boolean, force = false): Promise<void> {
  desiredRestInitialized = true;
  const nextRest = getPushRest(workout, soundEnabled);
  if (JSON.stringify(nextRest) !== JSON.stringify(desiredRest)) retryFailures = 0;
  desiredRest = nextRest;
  await sendRest(desiredRest, force);
}

async function sendRest(rest: PushRest | null, force = false): Promise<void> {
  if (!connection?.enabled || !PUSH_SERVICE_URL || !prepared) return;
  const snapshot = JSON.stringify(rest);
  if (!force && snapshot === lastSnapshot) return;
  lastSnapshot = snapshot;
  connection.revision += 1;
  const revision = connection.revision;
  // A failed reschedule must not keep claiming that the new deadline is confirmed.
  if (rest) connection.acknowledgedRestId = null;
  saveConnection();
  window.clearTimeout(retryTimer);
  updateStatus('scheduling', rest ? 'Agendando aviso em segundo plano…' : 'Cancelando o aviso anterior…');
  try {
    const result = await api(`/v1/devices/${connection.deviceId}/rest`, {
      method: 'PUT', body: JSON.stringify({ revision, rest }), keepalive: true,
    }, true);
    if (!connection?.enabled || connection.revision !== revision) return;
    connection.acknowledgedRestId = typeof result.restId === 'string' ? result.restId : null;
    retryFailures = 0;
    saveConnection();
    updateStatus(result.scheduled ? 'scheduled' : 'ready', result.scheduled ? 'Aviso agendado para o fim deste descanso.' : 'Avisos em segundo plano ativados.');
  } catch (cause) {
    if (!connection?.enabled || connection.revision !== revision) return;
    lastSnapshot = undefined;
    updateStatus('error', navigator.onLine ? `${errorMessage(cause)} O aviso em segundo plano não foi confirmado.` : 'Sem conexão. O aviso em segundo plano não foi confirmado.');
    if (navigator.onLine && ++retryFailures <= 2) retryTimer = window.setTimeout(() => { void retryPushRest(); }, 5000);
  }
}

export async function retryPushRest(): Promise<void> {
  if (!connection?.enabled || !prepared || Notification.permission !== 'granted') {
    preparation = null;
    await preparePushNotifications();
    return;
  }
  // Reuse the latest desired state; never revive an older in-flight request.
  const rest = desiredRest && Date.parse(desiredRest.endsAt) > Date.now() ? desiredRest : null;
  await sendRest(rest, true);
}

export async function testPushNotification(): Promise<void> {
  // One tap authorizes, reconnects and schedules the test; no separate on/off setting.
  await enablePushNotifications();
  if (!connection?.enabled) throw new Error('Não foi possível conectar os avisos. Tente testar novamente.');
  if (!prepared || !await pushReceiverReady(prepared.registration)) throw new Error('O recebimento dos avisos ainda está sendo atualizado. Reabra o MeuTreino e tente novamente.');
  if (Notification.permission !== 'granted') throw new Error('Autorize as notificações do iPhone antes de testar.');
  const result = await api(`/v1/devices/${connection.deviceId}/test`, { method: 'POST' }, true);
  if (result.scheduled !== true) throw new Error('O serviço não confirmou o agendamento do teste.');
}

export async function getPushDiagnostics(): Promise<PushDiagnostics> {
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  const report: PushDiagnostics = {
    installed: Boolean(standaloneNavigator.standalone) || Boolean(window.matchMedia?.('(display-mode: standalone)').matches),
    permission: 'Notification' in window ? Notification.permission : 'unsupported',
    subscription: false, receiverReady: false, serverConnected: false, test: null,
    message: 'Os avisos ainda não foram conectados neste aparelho.',
  };
  try {
    const registration = prepared?.registration ?? (navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null);
    report.receiverReady = registration ? await pushReceiverReady(registration) : false;
    report.subscription = Boolean(await registration?.pushManager?.getSubscription());
    if (report.permission !== 'granted') {
      report.message = report.permission === 'denied'
        ? 'O iPhone bloqueou os avisos. Libere-os em Ajustes → Notificações → MeuTreino.'
        : 'A autorização do iPhone ainda não foi concedida. Toque em Testar notificações.';
    } else if (!report.subscription) {
      report.message = 'A permissão está concedida, mas falta conectar as notificações. Toque em Testar notificações.';
    }
    if (connection && report.subscription) {
      const remote = await api(`/v1/devices/${connection.deviceId}/status`, { method: 'GET' }, true);
      report.serverConnected = remote.subscribed === true;
      report.test = remote.testDelivery as PushDiagnostics['test'] ?? null;
      report.message = report.serverConnected ? 'O iPhone está conectado ao serviço de avisos.' : 'A inscrição no serviço expirou. Toque em Testar notificações para reconectar.';
    }
  } catch (cause) {
    report.message = errorMessage(cause);
  }
  return report;
}
