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

