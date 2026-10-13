self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload;
    try { payload = event.data?.json(); } catch { payload = null; }
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visible = windows.some((client) => client.visibilityState === 'visible' && client.url.startsWith(self.registration.scope));
    const icon = new URL('icons/icon-192.png', self.registration.scope).href;
    // Apple requires every received push to display a user-visible notification.
    await self.registration.showNotification(payload?.title || 'MeuTreino', {
      body: payload?.body || 'Você recebeu um aviso do MeuTreino.',
      icon,
      badge: icon,
      tag: payload?.kind === 'test' ? 'meutreino-teste' : 'meutreino-descanso',
      silent: Boolean(payload?.silent) || visible,
      data: { id: payload?.id ?? null },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const appUrl = self.registration.scope;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existingWindow = windows.find((client) => client.url.startsWith(appUrl));
    if (existingWindow) {
      await existingWindow.focus();
      return;
    }
    await self.clients.openWindow(appUrl);
  })());
});

