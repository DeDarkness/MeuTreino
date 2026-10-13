import { DurableObject } from 'cloudflare:workers';
import { Buffer } from 'node:buffer';
import webpush, { type PushSubscription } from 'web-push';

export interface Env {
  DEVICES: DurableObjectNamespace<PushDevice>;
  API_LIMITER: RateLimit;
  ALLOWED_ORIGINS: string;
  APP_URL: string;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}

interface PendingAlert {
  id: string;
  endsAt: number;
  expiresAt: number;
  body: string;
  silent: boolean;
  kind: 'rest' | 'test';
  attempts: number;
}

interface DeviceRecord {
  tokenHash: string;
  subscription: PushSubscription | null;
  revision: number;
  rest: PendingAlert | null;
  test: PendingAlert | null;
}

const MAX_BODY_BYTES = 8192;
const ALERT_TTL_SECONDS = 60;
const MAX_REST_MS = 6 * 60 * 60 * 1000;

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validSubscription(value: unknown): value is PushSubscription {
  if (!isRecord(value) || typeof value.endpoint !== 'string' || value.endpoint.length > 4096 || !isRecord(value.keys)) return false;
  try {
    const endpoint = new URL(value.endpoint);
    const host = endpoint.hostname;
    const allowedHost = host.endsWith('.push.apple.com') || host === 'fcm.googleapis.com'
      || host.endsWith('.notify.windows.com') || host === 'updates.push.services.mozilla.com';
    if (endpoint.protocol !== 'https:' || endpoint.port || endpoint.username || endpoint.password || !allowedHost) return false;
    const { p256dh, auth } = value.keys;
    if (typeof p256dh !== 'string' || typeof auth !== 'string') return false;
    if (!/^[\w-]{86,88}$/.test(p256dh) || !/^[\w-]{22,24}$/.test(auth)) return false;
    const key = Buffer.from(p256dh, 'base64url');
    return key.length === 65 && key[0] === 4 && Buffer.from(auth, 'base64url').length === 16;
  } catch {
    return false;
  }
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Buffer.from(digest).toString('hex');
}

async function readBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('Use JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Pedido vazio.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error('Pedido muito grande.');
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function makeAlert(value: unknown, now: number): PendingAlert | null {
  if (value === null) return null;
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0 || value.id.length > 160
    || typeof value.endsAt !== 'string' || typeof value.body !== 'string' || value.body.length > 240
    || typeof value.silent !== 'boolean') throw new Error('Descanso inválido.');
  const endsAt = Date.parse(value.endsAt);
  if (!Number.isFinite(endsAt) || endsAt > now + MAX_REST_MS) throw new Error('Horário de descanso inválido.');
  if (endsAt <= now) return null;
  return { id: value.id, endsAt, expiresAt: endsAt + ALERT_TTL_SECONDS * 1000, body: value.body, silent: value.silent, kind: 'rest', attempts: 0 };
}

export class PushDevice extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    // Serialize writes and sends so a delayed request cannot restore a cancelled rest.
    return this.ctx.blockConcurrencyWhile(async () => {
      const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
      if (!/^[\w-]{43}$/.test(token)) return json({ error: 'Credencial inválida.' }, 401);
      const hash = await tokenHash(token);
      const stored = await this.ctx.storage.get<DeviceRecord>('device');
      if (stored && stored.tokenHash !== hash) return json({ error: 'Aparelho não autorizado.' }, 401);
      const path = new URL(request.url).pathname;

      const isDevicePath = !path.endsWith('/rest') && !path.endsWith('/test');
      if (request.method === 'PUT' && isDevicePath) {
        const body = await readBody(request);
        if (!validSubscription(body)) return json({ error: 'Inscrição de notificações inválida.' }, 400);
        const record: DeviceRecord = stored
          ? { ...stored, subscription: body, rest: null, test: null }
          : { tokenHash: hash, subscription: body, revision: 0, rest: null, test: null };
        await this.ctx.storage.put('device', record);
        await this.ctx.storage.deleteAlarm();
        return json({ subscribed: true });
      }
      if (!stored?.subscription) return json({ error: 'Ative os avisos novamente neste aparelho.' }, 410);
      if (request.method === 'DELETE' && isDevicePath) {
        await this.ctx.storage.put('device', { ...stored, subscription: null, rest: null, test: null });
        await this.ctx.storage.deleteAlarm();
        return json({ disabled: true });
      }
      if (request.method === 'PUT' && path.endsWith('/rest')) {
        const body = await readBody(request);
        if (!isRecord(body) || !Number.isSafeInteger(body.revision) || Number(body.revision) < 1) return json({ error: 'Revisão inválida.' }, 400);
        const revision = Number(body.revision);
        if (revision < stored.revision) return json({ error: 'Pedido substituído por um descanso mais recente.' }, 409);
        if (revision === stored.revision) return json({ scheduled: Boolean(stored.rest), restId: stored.rest?.id ?? null, revision });
        const rest = makeAlert(body.rest, Date.now());
        const record = { ...stored, revision, rest };
        await this.ctx.storage.put('device', record);
        await this.setNextAlarm(record);
        return json({ scheduled: Boolean(rest), restId: rest?.id ?? null, revision });
      }
      if (request.method === 'POST' && path.endsWith('/test')) {
        const now = Date.now();
        if (stored.test && stored.test.endsAt > now) return json({ error: 'Um teste já está agendado.' }, 409);
        const test: PendingAlert = {
          id: `test-${crypto.randomUUID()}`, endsAt: now + 10_000, expiresAt: now + 70_000,
          body: 'O aviso em segundo plano chegou. Volte ao MeuTreino para continuar.',
          silent: false, kind: 'test', attempts: 0,
        };
        const record = { ...stored, test };
        await this.ctx.storage.put('device', record);
        await this.setNextAlarm(record);
        return json({ scheduled: true, delaySeconds: 10 });
      }
      return json({ error: 'Operação não encontrada.' }, 404);
    });
  }

  private async setNextAlarm(record: DeviceRecord): Promise<void> {
    const deadlines = [record.rest?.endsAt, record.test?.endsAt].filter((time): time is number => time !== undefined);
    if (deadlines.length) await this.ctx.storage.setAlarm(Math.min(...deadlines));
    else await this.ctx.storage.deleteAlarm();
  }

  async alarm(): Promise<void> {
    await this.ctx.blockConcurrencyWhile(async () => {
      const record = await this.ctx.storage.get<DeviceRecord>('device');
      if (!record?.subscription) return;
      const subscription = record.subscription;
      for (const slot of ['rest', 'test'] as const) {
        const alert = record[slot];
        if (!alert || alert.endsAt > Date.now()) continue;
        if (alert.expiresAt <= Date.now()) {
          record[slot] = null;
          continue;
        }
        try {
          const details = webpush.generateRequestDetails(subscription, JSON.stringify({
            id: alert.id, kind: alert.kind,
            title: alert.kind === 'test' ? 'Teste do MeuTreino' : 'Descanso finalizado',
            body: alert.body, silent: alert.silent,
          }), {
            vapidDetails: { subject: this.env.VAPID_SUBJECT, publicKey: this.env.VAPID_PUBLIC_KEY, privateKey: this.env.VAPID_PRIVATE_KEY },
            TTL: Math.max(1, Math.ceil((alert.expiresAt - Date.now()) / 1000)),
            urgency: 'high', topic: alert.kind === 'test' ? 'meutreino-teste' : 'meutreino-descanso',
            contentEncoding: 'aes128gcm',
          });
          const response = await fetch(details.endpoint, {
            method: 'POST', headers: details.headers,
            body: details.body ? new Uint8Array(details.body) : undefined,
            signal: AbortSignal.timeout(8000), redirect: 'error',
          });
          if (response.status === 404 || response.status === 410) {
            record.subscription = null;
            record.rest = null;
            record.test = null;
            break;
          }
          if (!response.ok) throw new Error('O provedor não aceitou o aviso.');
          record[slot] = null;
        } catch {
          // Short, bounded retries: never send a stale gym-rest alert hours later.
          alert.attempts += 1;
          if (alert.attempts >= 4 || alert.expiresAt <= Date.now() + 5000) record[slot] = null;
          else alert.endsAt = Date.now() + 5000;
        }
      }
      await this.ctx.storage.put('device', record);
      await this.setNextAlarm(record);
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') return json({ ok: true, configured: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) });
    const origin = request.headers.get('origin') ?? '';
    if (!env.ALLOWED_ORIGINS.split(',').includes(origin)) return json({ error: 'Origem não autorizada.' }, 403);
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    let response: Response;
    try {
      if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) response = json({ error: 'O serviço ainda está sendo preparado.' }, 503);
      else if (url.pathname === '/v1/config' && request.method === 'GET') response = json({ publicKey: env.VAPID_PUBLIC_KEY });
      else {
        const match = url.pathname.match(/^\/v1\/devices\/([a-f0-9-]{36})(?:\/(rest|test))?$/);
        if (!match) response = json({ error: 'Operação não encontrada.' }, 404);
        else if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) response = json({ error: 'Pedido muito grande.' }, 413);
        else if (!(await env.API_LIMITER.limit({ key: `meutreino:${request.headers.get('cf-connecting-ip') ?? 'local'}` })).success) response = json({ error: 'Aguarde um minuto e tente novamente.' }, 429);
        else response = await env.DEVICES.getByName(match[1]).fetch(request);
      }
    } catch {
      response = json({ error: 'Não foi possível processar o aviso.' }, 400);
    }
    const result = new Response(response.body, response);
    for (const [key, value] of Object.entries(headers)) result.headers.set(key, value);
    return result;
  },
} satisfies ExportedHandler<Env>;
