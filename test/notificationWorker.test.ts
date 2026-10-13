import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const script = readFileSync(new URL('../public/notification-sw.js', import.meta.url), 'utf8');

async function deliver(payload: Record<string, unknown>) {
  type PushEvent = { data: { json: () => Record<string, unknown> }; waitUntil: (promise: Promise<void>) => void };
  const listeners = new Map<string, (event: PushEvent) => void>();
  const notify = vi.fn<(title: string, options: NotificationOptions) => Promise<void>>(async () => undefined);
  runInNewContext(script, {
    URL,
    self: {
      addEventListener: (type: string, handler: (event: PushEvent) => void) => listeners.set(type, handler),
      registration: { scope: 'https://dedarkness.github.io/MeuTreino/', showNotification: notify },
      clients: { matchAll: async () => [{ visibilityState: 'visible' }] },
    },
  });
  let finished: Promise<void> | undefined;
  listeners.get('push')!({ data: { json: () => payload }, waitUntil: (operation) => { finished = operation; } });
  await finished;
  return notify;
}

describe('recebimento dos avisos pelo iPhone', () => {
  it('usa avisos distintos para novas séries e identifica uma repetição do mesmo envio', async () => {
    const first = await deliver({ kind: 'rest', id: 'rest-1', title: 'Descanso', silent: false });
    const next = await deliver({ kind: 'rest', id: 'rest-2', title: 'Descanso', silent: false });
    const duplicate = await deliver({ kind: 'rest', id: 'rest-1', title: 'Descanso', silent: false });
    const firstTag = first.mock.calls[0][1].tag;
    expect(next.mock.calls[0][1].tag).not.toBe(firstTag);
    expect(duplicate.mock.calls[0][1].tag).toBe(firstTag);
  });

  it('não silencia o teste ou o descanso por causa de uma janela considerada visível', async () => {
    for (const kind of ['test', 'rest']) {
      const notify = await deliver({ kind, title: 'MeuTreino', body: 'Aviso', silent: false });
      expect(notify).toHaveBeenCalledWith('MeuTreino', expect.objectContaining({ silent: false }));
    }
  });

  it('mantém o aviso visual quando a preferência de som foi desativada', async () => {
    const notify = await deliver({ kind: 'rest', title: 'Descanso finalizado', body: 'Próxima série', silent: true });
    expect(notify).toHaveBeenCalledWith('Descanso finalizado', expect.objectContaining({ silent: true, body: 'Próxima série' }));
  });
});
