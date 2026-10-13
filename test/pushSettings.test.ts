import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/pushNotifications', () => ({}));
import { PushNotificationSettings } from '../src/components/PushNotificationSettings';

describe('ajustes simplificados dos avisos', () => {
  it.each([true, false])('mostra somente um botão de teste, com conexão ativa = %s', (enabled) => {
    const html = renderToStaticMarkup(createElement(PushNotificationSettings, {
      status: { enabled, phase: enabled ? 'ready' : 'disabled', message: 'Avisos ligados por padrão.' },
      onPermissionChange: () => undefined,
    }));
    expect(html.match(/<button\b/g)).toHaveLength(1);
    expect(html).toContain('Testar notificações');
    expect(html).not.toContain('Desativar avisos');
    expect(html).not.toContain('Verificar avisos');
  });
});
