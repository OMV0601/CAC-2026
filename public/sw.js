// service worker: this runs in the background, even with the tab closed.
// its only job is showing push notifications from notify-ask

self.addEventListener('push', (event) => {
  let data = { title: 'Lexicon', body: 'Someone asked a question.', url: '/inbox' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    // not json, just use the defaults
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      data: { url: data.url },
      // makes the phone buzz again even if an old one is still showing
      tag: 'lexicon-ask',
      renotify: true,
    }),
  )
})

// tapping the notification opens (or focuses) the inbox
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/inbox'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if ('focus' in w) {
          w.navigate(url)
          return w.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
