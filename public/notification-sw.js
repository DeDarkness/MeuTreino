self.addEventListener('message', (event) => {
  if (event.data?.type === 'MEUTREINO_PUSH_CHECK') {
    event.ports?.[0]?.postMessage({ type: 'MEUTREINO_PUSH_READY', protocol: 2 });
  }
});

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload;
    try { payload = event.data?.json(); } catch { payload = null; }
    const icon = new URL('icons/icon-192.png', self.registration.scope).href;
    const family = payload?.kind === 'test' ? 'meutreino-teste' : 'meutreino-descanso';
    // Apple requires every received push to display a user-visible notification.
    await self.registration.showNotification(payload?.title || 'MeuTreino', {
      body: payload?.body || 'Você recebeu um aviso do MeuTreino.',
      icon,
      badge: icon,
      // A different rest/test must produce a new alert. Retrying the same id
      // still replaces its own notification instead of producing duplicates.
      tag: payload?.id ? `${family}-${payload.id}` : family,
      // WindowClient.visibilityState can be stale while iOS suspends the app.
      // Only the explicit sound preference may silence a received notification.
      silent: Boolean(payload?.silent),
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

