self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || 'PantrySync Reminder';
  const options = {
    body: data.body || 'You have an expiration reminder.',
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    data: {
      url: data.url || '/app',
      pantryItemId: data.pantryItemId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/app';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();

            if ('navigate' in client) {
              return client.navigate(urlToOpen);
            }

            return undefined;
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }

        return undefined;
      }),
  );
});
