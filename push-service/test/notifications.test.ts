import { env } from 'cloudflare:workers';
import { runInDurableObject, reset } from 'cloudflare:test';
import { randomBytes, createECDH } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import worker, { type Env, type PushDevice } from '../src';

const bindings = env as unknown as Env;
const origin = 'https://dedarkness.github.io';
const token = randomBytes(32).toString('base64url');
const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
const subscription = {
  endpoint: 'https://web.push.apple.com/test-endpoint',
  keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') },
};

function request(id: string, method: string, suffix = '', body?: unknown, bearer = token) {
  return worker.fetch(new Request(`https://push.example/v1/devices/${id}${suffix}`, {
    method,
    headers: { Origin: origin, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), bindings);
}

function rest(id = 'rest-1') {
  return { id, endsAt: new Date(Date.now() + 120_000).toISOString(), body: 'Próxima: Supino · Série 2', silent: false };
}

type StoredDevice = { rest: { id: string; endsAt: number; expiresAt: number; attempts: number } | null; test: { id: string } | null; subscription: unknown };
const readDevice = (id: string) => runInDurableObject(bindings.DEVICES.getByName(id), async (_instance: PushDevice, state) => state.storage.get<StoredDevice>('device'));

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe('serviço de avisos em segundo plano', () => {
  it('bloqueia outras origens e endpoints que não pertencem a provedores de push', async () => {
    const unauthorized = await worker.fetch(new Request('https://push.example/v1/config', { headers: { Origin: 'https://outro.example' } }), bindings);
    expect(unauthorized.status).toBe(403);
    const invalid = await request(crypto.randomUUID(), 'PUT', '', { ...subscription, endpoint: 'https://127.0.0.1/private' });
    expect(invalid.status).toBe(400);
  });

  it('protege a inscrição com uma credencial exclusiva do aparelho', async () => {
    const id = crypto.randomUUID();
    expect((await request(id, 'PUT', '', subscription)).status).toBe(200);
    const stolen = await request(id, 'PUT', '/rest', { revision: 1, rest: rest() }, randomBytes(32).toString('base64url'));
    expect(stolen.status).toBe(401);
  });

  it('um reagendamento antigo não pode restaurar o descanso cancelado', async () => {
    const id = crypto.randomUUID();
    await request(id, 'PUT', '', subscription);
    await request(id, 'PUT', '/rest', { revision: 2, rest: rest() });
    await request(id, 'PUT', '/rest', { revision: 3, rest: null });
    expect((await request(id, 'PUT', '/rest', { revision: 1, rest: rest('old') })).status).toBe(409);
    expect((await readDevice(id))?.rest).toBeNull();
    expect(await runInDurableObject(bindings.DEVICES.getByName(id), (_instance, state) => state.storage.getAlarm())).toBeNull();
  });

  it('o teste de 10 segundos não substitui o descanso em andamento', async () => {
    const id = crypto.randomUUID();
    await request(id, 'PUT', '', subscription);
    await request(id, 'PUT', '/rest', { revision: 1, rest: rest() });
    await request(id, 'POST', '/test');
    const stored = await readDevice(id);
    expect(stored?.rest?.id).toBe('rest-1');
    expect(stored?.test?.id).toMatch(/^test-/);
  });

  it('gera um Web Push cifrado no runtime real da Cloudflare e não repete o envio bem-sucedido', async () => {
    const id = crypto.randomUUID();
    await request(id, 'PUT', '', subscription);
    await request(id, 'PUT', '/rest', { revision: 1, rest: rest() });
    const send = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
    await runInDurableObject(bindings.DEVICES.getByName(id), async (instance: PushDevice, state) => {
      const stored = (await state.storage.get<StoredDevice>('device'))!;
      stored.rest!.endsAt = Date.now() - 1;
      await state.storage.put('device', stored);
      await instance.alarm();
      await instance.alarm();
    });
    expect(send).toHaveBeenCalledTimes(1);
    const options = send.mock.calls[0][1]!;
    expect(options.headers).toMatchObject({ 'Content-Encoding': 'aes128gcm', Urgency: 'high' });
    expect((options.body as Uint8Array).byteLength).toBeGreaterThan(100);
    expect((await readDevice(id))?.rest).toBeNull();
  });

  it('descarta avisos expirados e remove inscrições rejeitadas pelo provedor', async () => {
    const id = crypto.randomUUID();
    await request(id, 'PUT', '', subscription);
    await request(id, 'PUT', '/rest', { revision: 1, rest: rest() });
    const send = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 410 }));
    await runInDurableObject(bindings.DEVICES.getByName(id), async (instance: PushDevice, state) => {
      const stored = (await state.storage.get<StoredDevice>('device'))!;
      stored.rest!.endsAt = Date.now() - 120_000;
      stored.rest!.expiresAt = Date.now() - 60_000;
      await state.storage.put('device', stored);
      await instance.alarm();
    });
    expect(send).not.toHaveBeenCalled();
    await request(id, 'PUT', '/rest', { revision: 2, rest: rest('new') });
    await runInDurableObject(bindings.DEVICES.getByName(id), async (instance: PushDevice, state) => {
      const stored = (await state.storage.get<StoredDevice>('device'))!;
      stored.rest!.endsAt = Date.now() - 1;
      await state.storage.put('device', stored);
      await instance.alarm();
    });
    expect((await readDevice(id))?.subscription).toBeNull();
  });
});
