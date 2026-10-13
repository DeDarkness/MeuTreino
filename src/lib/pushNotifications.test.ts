import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSeedState } from './database';
import { startWorkoutFromPlan } from './workout';

vi.mock('./pushConfig', () => ({ PUSH_SERVICE_URL: 'https://meutreino-push.example' }));

const key = 'B' + 'A'.repeat(86);
const subscription = { toJSON: () => ({ endpoint: 'https://web.push.apple.com/example', keys: { p256dh: key, auth: 'A'.repeat(22) } }) };
const subscribe = vi.fn(async () => subscription);
const fetcher = vi.fn();

beforeEach(() => {
  vi.resetModules();
  fetcher.mockReset();
  subscribe.mockClear();
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  vi.stubGlobal('Notification', { permission: 'granted' });
  vi.stubGlobal('window', { isSecureContext: true, Notification: {}, PushManager: {}, setTimeout, clearTimeout });
  vi.stubGlobal('navigator', { onLine: true, serviceWorker: { ready: Promise.resolve({
    active: { postMessage: (_message: unknown, ports: MessagePort[]) => ports[0].postMessage({ type: 'MEUTREINO_PUSH_READY', protocol: 2 }) },
    pushManager: { subscribe, getSubscription: async () => subscription },
  }) } });
  vi.stubGlobal('fetch', fetcher);
  fetcher.mockImplementation(async (url: string) => Response.json(url.endsWith('/config') ? { publicKey: key } : { subscribed: true }));
});

afterEach(() => { vi.unstubAllGlobals(); });

async function enabledPush() {
  const push = await import('./pushNotifications');
  await push.preparePushNotifications();
  await push.enablePushNotifications();
  return push;
}

function restingWorkout() {
  const { workout } = startWorkoutFromPlan(createSeedState(), 'plan-full-body-a');
  workout.restEndsAt = new Date(Date.now() + 120_000).toISOString();
  return workout;
}

describe('confirmação dos avisos no aparelho', () => {
  it('fica ativo automaticamente com uma inscrição já autorizada, sem novo pedido de permissão', async () => {
    const requestPermission = vi.fn();
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission });
    const push = await import('./pushNotifications');
    await push.preparePushNotifications();
    expect(push.getPushStatus().enabled).toBe(true);
    expect(subscribe).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(fetcher.mock.calls.some(([, options]) => options.method === 'PUT')).toBe(true);
  });

  it('reconecta a preferência antiga desativada quando a inscrição continua autorizada', async () => {
    localStorage.setItem('meutreino-push-connection-v1', JSON.stringify({
      deviceId: crypto.randomUUID(), token: 'A'.repeat(43), enabled: false,
      revision: 12, acknowledgedRestId: null, serviceUrl: 'https://meutreino-push.example',
    }));
    const push = await import('./pushNotifications');
    await push.preparePushNotifications();
    expect(push.getPushStatus().enabled).toBe(true);
    expect(JSON.parse(localStorage.getItem('meutreino-push-connection-v1')!).revision).toBe(12);
  });

  it('um único teste pede permissão, conecta e agenda sem botão separado de ativação', async () => {
    const notification = {
      permission: 'default',
      requestPermission: vi.fn(async () => { notification.permission = 'granted'; return 'granted'; }),
    };
    vi.stubGlobal('Notification', notification);
    fetcher.mockImplementation(async (url: string) => Response.json(url.endsWith('/config')
      ? { publicKey: key } : url.endsWith('/test') ? { scheduled: true } : { subscribed: true }));
    const push = await import('./pushNotifications');
    await push.preparePushNotifications();
    expect(notification.requestPermission).not.toHaveBeenCalled();
    await push.testPushNotification();
    expect(notification.requestPermission).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/test'))).toHaveLength(1);
    expect(push.getPushStatus().enabled).toBe(true);
  });

  it('solicita a permissão explicitamente antes de conectar uma nova inscrição', async () => {
    const notification = {
      permission: 'default',
      requestPermission: vi.fn(async () => { notification.permission = 'granted'; return 'granted'; }),
    };
    vi.stubGlobal('Notification', notification);
    const push = await import('./pushNotifications');
    await push.preparePushNotifications();
    subscribe.mockClear();
    await push.enablePushNotifications();
    expect(notification.requestPermission).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledOnce();
    expect(notification.requestPermission.mock.invocationCallOrder[0]).toBeLessThan(subscribe.mock.invocationCallOrder[0]);
    expect(push.getPushStatus().enabled).toBe(true);
  });

  it('não conecta avisos quando o iPhone não concede a permissão', async () => {
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn(async () => 'denied') });
    const push = await import('./pushNotifications');
    await push.preparePushNotifications();
    subscribe.mockClear();
    await expect(push.enablePushNotifications()).rejects.toThrow('bloqueada');
    expect(subscribe).not.toHaveBeenCalled();
    expect(push.getPushStatus().enabled).toBe(false);
  });

  it('mostra autorização e resultado do serviço sem confundir envio com recebimento', async () => {
    const push = await enabledPush();
    fetcher.mockResolvedValue(Response.json({ subscribed: true, testDelivery: { status: 'accepted', scheduledFor: new Date().toISOString(), errorCode: null } }));
    const report = await push.getPushDiagnostics();
    expect(report.permission).toBe('granted');
    expect(report.subscription).toBe(true);
    expect(report.serverConnected).toBe(true);
    expect(report.test?.status).toBe('accepted');
  });

  it('confirma somente o horário efetivamente aceito pelo serviço', async () => {
    const push = await enabledPush();
    const workout = restingWorkout();
    fetcher.mockImplementation(async (_url: string, options: RequestInit) => {
      const { rest, revision } = JSON.parse(options.body as string);
      return Response.json({ scheduled: Boolean(rest), restId: rest?.id ?? null, revision });
    });
    await push.syncPushRest(workout, true);
    expect(push.isPushRestScheduled(workout.id, workout.restEndsAt!)).toBe(true);
    expect(push.getPushStatus().phase).toBe('scheduled');
    await push.syncPushRest(null, true);
    expect(push.isPushRestScheduled(workout.id, workout.restEndsAt!)).toBe(false);
  });

  it('uma resposta atrasada não restaura a confirmação de um aviso cancelado', async () => {
    const push = await enabledPush();
    const workout = restingWorkout();
    let acceptOld!: (response: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise<Response>((resolve) => { acceptOld = resolve; }));
    const scheduling = push.syncPushRest(workout, true);
    fetcher.mockResolvedValueOnce(Response.json({ scheduled: false, restId: null }));
    await push.syncPushRest(null, true);
    acceptOld(Response.json({ scheduled: true, restId: `${workout.id}/${workout.restEndsAt}` }));
    await scheduling;
    expect(push.isPushRestScheduled(workout.id, workout.restEndsAt!)).toBe(false);
    expect(push.getPushStatus().phase).toBe('ready');
  });

  it('mostra a falha de conexão sem afirmar que o aviso está agendado', async () => {
    const push = await enabledPush();
    const workout = restingWorkout();
    vi.stubGlobal('navigator', { onLine: false });
    fetcher.mockRejectedValue(new TypeError('Failed to fetch'));
    await push.syncPushRest(workout, true);
    expect(push.getPushStatus().message).toContain('não foi confirmado');
    expect(push.isPushRestScheduled(workout.id, workout.restEndsAt!)).toBe(false);
  });
});
