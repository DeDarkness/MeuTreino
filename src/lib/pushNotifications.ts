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

const STORAGE_KEY = 'meutreino-push-connection-v1';
const listeners = new Set<() => void>();
let connection: PushConnection | null = readConnection();
let prepared: { registration: ServiceWorkerRegistration; publicKey: string } | null = null;
let preparation: Promise<void> | null = null;
let lastSnapshot: string | undefined;
let retryTimer: number | undefined;
let retryFailures = 0;
let desiredRest: PushRest | null = null;
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
      updateStatus('error', 'Ative os avisos novamente para reconectar este aparelho.');
    }
    throw new Error(typeof body.error === 'string' ? body.error : 'Não foi possível agendar o aviso.');
  }
  return body;
}

function supported(): boolean {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
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
      prepared = { registration, publicKey: config.publicKey };
      if (connection?.serviceUrl !== serviceUrl() && connection) {
        connection.enabled = false;
        saveConnection();
      }
      if (connection?.enabled && (!await registration.pushManager.getSubscription() || Notification.permission !== 'granted')) {
        connection.enabled = false;
        saveConnection();
      }
      if (!connection?.enabled || !['scheduling', 'scheduled', 'error'].includes(status.phase)) {
        updateStatus(connection?.enabled ? 'ready' : 'disabled', connection?.enabled ? 'Avisos em segundo plano ativados.' : 'Ative os avisos para receber o fim do descanso com a tela bloqueada.');
      }
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

export async function enablePushNotifications(): Promise<void> {
  if (!prepared) {
    await preparePushNotifications();
    if (!prepared) throw new Error(status.message);
    // A second tap preserves the direct user gesture required by iPhone.
    throw new Error('Tudo pronto. Toque em ativar novamente para autorizar no iPhone.');
  }
  if (Notification.permission === 'denied') throw new Error('Permita os avisos em Ajustes → Notificações → MeuTreino.');
  // Invoke subscribe before any network wait, directly from the user's tap.
  const subscriptionPromise = prepared.registration.pushManager.subscribe({
    userVisibleOnly: true, applicationServerKey: publicKeyBytes(prepared.publicKey),
  });
  updateStatus('preparing', 'Conectando os avisos deste aparelho…');
  try {
    const subscription = await subscriptionPromise;
    if (!connection || connection.serviceUrl !== serviceUrl()) {
      connection = { deviceId: crypto.randomUUID(), token: randomToken(), enabled: false, revision: 0, acknowledgedRestId: null, serviceUrl: serviceUrl() };
    }
    // Persist the capability before sending, so a failed connection can be retried safely.
    saveConnection();
    await api(`/v1/devices/${connection.deviceId}`, { method: 'PUT', body: JSON.stringify(subscription.toJSON()) }, true);
    connection.enabled = true;
    saveConnection();
    lastSnapshot = undefined;
    updateStatus('ready', 'Avisos em segundo plano ativados.');
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
  const nextRest = getPushRest(workout, soundEnabled);
  if (JSON.stringify(nextRest) !== JSON.stringify(desiredRest)) retryFailures = 0;
  desiredRest = nextRest;
  await sendRest(desiredRest, force);
}

async function sendRest(rest: PushRest | null, force = false): Promise<void> {
  if (!connection?.enabled || !PUSH_SERVICE_URL) return;
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
  if (!connection?.enabled) {
    await preparePushNotifications();
    return;
  }
  // Reuse the latest desired state; never revive an older in-flight request.
  const rest = desiredRest && Date.parse(desiredRest.endsAt) > Date.now() ? desiredRest : null;
  await sendRest(rest, true);
}

export async function testPushNotification(): Promise<void> {
  if (!connection?.enabled) throw new Error('Ative os avisos em segundo plano primeiro.');
  await api(`/v1/devices/${connection.deviceId}/test`, { method: 'POST' }, true);
}

export async function disablePushNotifications(): Promise<void> {
  const registration = prepared?.registration ?? await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription && !await subscription.unsubscribe()) throw new Error('Não foi possível desativar os avisos neste aparelho.');
  if (connection) {
    connection.enabled = false;
    connection.acknowledgedRestId = null;
    saveConnection();
    // Unsubscribe already prevents delivery even if this cleanup needs internet later.
    try { await api(`/v1/devices/${connection.deviceId}`, { method: 'DELETE' }, true); } catch { /* The push provider will reject the retired subscription. */ }
  }
  window.clearTimeout(retryTimer);
  lastSnapshot = undefined;
  updateStatus('disabled', 'Avisos em segundo plano desativados neste aparelho.');
}
