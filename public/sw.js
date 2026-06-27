self.addEventListener('install', (event) => {
  console.log('[Tabibi SW] install')
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  console.log('[Tabibi SW] activate')
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  console.log('[Tabibi SW] push event received')

  let payload = {}

  try {
    payload = event.data ? event.data.json() : {}
  } catch (error) {
    console.error('[Tabibi SW] failed to parse push payload as JSON', error)
    payload = {
      body: event.data ? event.data.text() : undefined,
    }
  }

  const title = payload.title || 'Tabibi'
  const body = payload.body || 'لديك إشعار جديد من Tabibi.'
  const url = payload.url || '/patient'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      data: {
        url,
      },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  console.log('[Tabibi SW] notification click')
  event.notification.close()

  const targetUrl = new URL(
    event.notification.data?.url || '/patient',
    self.location.origin,
  ).href

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            await client.navigate(targetUrl)
            return client.focus()
          }
        }

        return self.clients.openWindow(targetUrl)
      }),
  )
})
