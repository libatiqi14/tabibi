import { supabase } from '../lib/supabase'

export type PushNotificationStatus =
  | 'enabled'
  | 'disabled'
  | 'denied'
  | 'unsupported'

type PushSubscriptionKeys = {
  p256dh: string
  auth: string
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)

  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)))
}

function getSubscriptionKeys(subscription: PushSubscription): PushSubscriptionKeys {
  const json = subscription.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth

  if (!p256dh || !auth) {
    throw new Error('Push subscription encryption keys are missing.')
  }

  return { p256dh, auth }
}

function getPushErrorMessage(error: unknown) {
  const pushError = error as { name?: string; message?: string }
  const name = pushError?.name || 'PushSubscriptionError'
  const message = pushError?.message || 'Unknown push subscription error'

  return `${name} - ${message}`
}

async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const existingRegistration = await navigator.serviceWorker.getRegistration()

  console.log('Existing service worker registration:', existingRegistration)

  if (!existingRegistration) {
    console.log('Registering service worker: /sw.js')
    await navigator.serviceWorker.register('/sw.js')
  }

  const readyRegistration = await navigator.serviceWorker.ready
  console.log('Service worker ready:', readyRegistration)

  return readyRegistration
}

export function isPushSupported(): boolean {
  const supported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window

  console.log('Push supported:', supported)

  return supported
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  console.log('Notification supported:', typeof window !== 'undefined' && 'Notification' in window)

  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported by this browser.')
  }

  console.log('Current notification permission:', Notification.permission)

  const permission = await Notification.requestPermission()

  console.log('Notification permission result:', permission)

  return permission
}

export async function saveSubscriptionToSupabase(
  subscription: PushSubscription,
): Promise<void> {
  console.log('Saving push subscription to Supabase:', subscription.endpoint)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    console.error('Failed to read current user for push subscription:', userError)
    throw new Error(userError.message)
  }

  if (!user) {
    throw new Error('User is not authenticated.')
  }

  const { p256dh, auth } = getSubscriptionKeys(subscription)
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh,
      auth,
    },
    { onConflict: 'user_id,endpoint' },
  )

  if (error) {
    console.error('Failed to save push subscription:', error)
    throw new Error(error.message)
  }

  console.log('Push subscription saved for user:', user.id)
}

export async function subscribeUserToPush(): Promise<PushSubscription> {
  console.log('Starting push subscription flow.')

  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported by this browser.')
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

  console.log('VAPID public key configured:', Boolean(vapidPublicKey))
  console.log('VAPID public key length:', vapidPublicKey?.length ?? 0)

  if (!vapidPublicKey) {
    throw new Error('VITE_VAPID_PUBLIC_KEY is not configured.')
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await requestNotificationPermission()

  console.log('Final notification permission:', permission)

  if (permission !== 'granted') {
    throw new Error(`Notification permission was not granted: ${permission}`)
  }

  const registration = await ensureServiceWorkerRegistration()
  const existingSubscription = await registration.pushManager.getSubscription()

  console.log('Existing push subscription:', existingSubscription)

  if (existingSubscription) {
    await saveSubscriptionToSupabase(existingSubscription)
    return existingSubscription
  }

  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)

  console.log('Application server key:', applicationServerKey)

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })

    console.log('New push subscription created:', subscription)

    await saveSubscriptionToSupabase(subscription)

    return subscription
  } catch (error) {
    console.error('Push subscription failed:', error)
    console.error('Push subscription error name:', (error as { name?: string })?.name)
    console.error(
      'Push subscription error message:',
      (error as { message?: string })?.message,
    )

    throw new Error(getPushErrorMessage(error))
  }
}

export async function unsubscribeUserFromPush(): Promise<void> {
  console.log('Starting push unsubscribe flow.')

  if (!isPushSupported()) {
    return
  }

  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()

  console.log('Subscription to remove:', subscription)

  if (!subscription) {
    return
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', subscription.endpoint)

  if (error) {
    console.error('Failed to delete push subscription from Supabase:', error)
    throw new Error(error.message)
  }

  await subscription.unsubscribe()
  console.log('Push subscription removed.')
}

export async function getPushNotificationStatus(): Promise<PushNotificationStatus> {
  if (!isPushSupported()) {
    return 'unsupported'
  }

  if (Notification.permission === 'denied') {
    return 'denied'
  }

  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()

  console.log('Current push notification status:', {
    permission: Notification.permission,
    hasRegistration: Boolean(registration),
    hasSubscription: Boolean(subscription),
  })

  return subscription ? 'enabled' : 'disabled'
}
