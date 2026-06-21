/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{
    url: string
    revision?: string | null
  }>
}

type PushPayload = {
  title?: string
  body?: string
  url?: string
  role?: 'patient' | 'doctor' | 'admin'
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('push', (event: PushEvent) => {
  let payload: PushPayload = {}

  try {
    payload = event.data?.json() as PushPayload
  } catch {
    payload = { body: event.data?.text() }
  }

  const fallbackUrl =
    payload.role === 'doctor'
      ? '/doctor/dashboard'
      : payload.role === 'admin'
        ? '/admin'
        : '/patient/dashboard'

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Tabibi', {
      body: payload.body || 'لديك تحديث جديد في Tabibi.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      data: {
        url: payload.url || fallbackUrl,
      },
    }),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const targetUrl = new URL(
    event.notification.data?.url || '/patient/dashboard',
    self.location.origin,
  ).href

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            await client.navigate(targetUrl)
            return client.focus()
          }
        }

        return self.clients.openWindow(targetUrl)
      }),
  )
})
