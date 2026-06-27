import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import webpush from 'npm:web-push@3.6.7'

type PushRequest = {
  user_id?: string
  title?: string
  body?: string
  url?: string
}

type PushSubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

type PushResult = {
  subscription_id: string
  endpoint: string
  success: boolean
  status_code: number | null
  deleted: boolean
  error: string | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
const vapidSubject = Deno.env.get('VAPID_SUBJECT')

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL environment variable.')
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.')
}

if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
  throw new Error('Missing VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, or VAPID_SUBJECT.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getWebPushError(error: unknown) {
  const pushError = error as {
    statusCode?: number
    status?: number
    message?: string
    body?: string
  }

  return {
    statusCode:
      typeof pushError.statusCode === 'number'
        ? pushError.statusCode
        : typeof pushError.status === 'number'
          ? pushError.status
          : null,
    message: pushError.body || pushError.message || 'Unknown Web Push error.',
  }
}

async function deleteInvalidSubscription(subscriptionId: string) {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('id', subscriptionId)

  if (error) {
    console.error('[send-push-notification] failed to delete subscription', {
      subscriptionId,
      error: error.message,
    })

    return false
  }

  console.log('[send-push-notification] deleted invalid subscription', {
    subscriptionId,
  })

  return true
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const requestPayload = (await request.json()) as PushRequest
    const userId = requestPayload.user_id
    const title = requestPayload.title || 'Tabibi'
    const body = requestPayload.body || 'اختبار إشعار الهاتف'
    const url = requestPayload.url || '/patient'

    console.log('[send-push-notification] request received', {
      userId,
      title,
      bodyLength: body.length,
      url,
    })

    if (!userId) {
      return jsonResponse({ error: 'user_id is required.' }, 400)
    }

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (error) {
      console.error('[send-push-notification] failed to fetch subscriptions', error)
      throw new Error(error.message)
    }

    const subscriptions = (data ?? []) as PushSubscriptionRow[]
    const notificationPayload = JSON.stringify({ title, body, url })

    console.log('[send-push-notification] subscriptions found', {
      userId,
      count: subscriptions.length,
    })

    const results = await Promise.all(
      subscriptions.map(async (subscription): Promise<PushResult> => {
        try {
          const response = await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            notificationPayload,
          )

          console.log('[send-push-notification] push sent', {
            subscriptionId: subscription.id,
            endpoint: subscription.endpoint,
            statusCode: response.statusCode ?? null,
          })

          return {
            subscription_id: subscription.id,
            endpoint: subscription.endpoint,
            success: true,
            status_code: response.statusCode ?? null,
            deleted: false,
            error: null,
          }
        } catch (error) {
          const pushError = getWebPushError(error)
          const shouldDelete =
            pushError.statusCode === 400 ||
            pushError.statusCode === 404 ||
            pushError.statusCode === 410
          const deleted = shouldDelete
            ? await deleteInvalidSubscription(subscription.id)
            : false

          console.error('[send-push-notification] push failed', {
            subscriptionId: subscription.id,
            endpoint: subscription.endpoint,
            statusCode: pushError.statusCode,
            error: pushError.message,
            deleted,
          })

          return {
            subscription_id: subscription.id,
            endpoint: subscription.endpoint,
            success: false,
            status_code: pushError.statusCode,
            deleted,
            error: pushError.message,
          }
        }
      }),
    )

    const sent = results.filter((result) => result.success).length
    const failed = results.length - sent

    console.log('[send-push-notification] request complete', {
      userId,
      sent,
      failed,
    })

    return jsonResponse({ sent, failed, results })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown push notification error.'

    console.error('[send-push-notification] unexpected failure', message)

    return jsonResponse(
      {
        error: message,
        sent: 0,
        failed: 0,
        results: [],
      },
      500,
    )
  }
})
