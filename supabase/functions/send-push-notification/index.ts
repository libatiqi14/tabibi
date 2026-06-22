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
  endpoint: string
  p256dh: string
  auth: string
}

type PushResult = {
  subscription_id: string
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

function getPushError(error: unknown) {
  const pushError = error as {
    statusCode?: number
    message?: string
    body?: string
  }

  return {
    statusCode:
      typeof pushError.statusCode === 'number' ? pushError.statusCode : null,
    message: pushError.body || pushError.message || 'Unknown Web Push error.',
  }
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const payload = (await request.json()) as PushRequest

    if (!payload.user_id || !payload.title || !payload.body) {
      return jsonResponse(
        { error: 'user_id, title, and body are required.' },
        400,
      )
    }

    console.log('Fetching push subscriptions', {
      userId: payload.user_id,
      title: payload.title,
      url: payload.url ?? '/patient',
    })

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', payload.user_id)

    if (error) {
      console.error('Failed to fetch push subscriptions', error)
      throw new Error(error.message)
    }

    const subscriptions = (data ?? []) as PushSubscriptionRow[]

    console.log('Push subscriptions found', {
      userId: payload.user_id,
      count: subscriptions.length,
    })

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? '/patient',
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

          console.log('Push notification sent', {
            subscriptionId: subscription.id,
            statusCode: response.statusCode,
          })

          return {
            subscription_id: subscription.id,
            success: true,
            status_code: response.statusCode ?? null,
            deleted: false,
            error: null,
          }
        } catch (error) {
          const pushError = getPushError(error)
          const shouldDelete =
            pushError.statusCode === 400 ||
            pushError.statusCode === 404 ||
            pushError.statusCode === 410

          console.error('Push notification failed', {
            subscriptionId: subscription.id,
            statusCode: pushError.statusCode,
            error: pushError.message,
            deletingSubscription: shouldDelete,
          })

          let deleted = false

          if (shouldDelete) {
            const { error: deleteError } = await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', subscription.id)

            if (deleteError) {
              console.error('Failed to delete invalid push subscription', {
                subscriptionId: subscription.id,
                error: deleteError.message,
              })
            } else {
              deleted = true
              console.log('Invalid push subscription deleted', {
                subscriptionId: subscription.id,
              })
            }
          }

          return {
            subscription_id: subscription.id,
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

    console.log('Push notification request complete', {
      userId: payload.user_id,
      sent,
      failed,
    })

    return jsonResponse({
      sent,
      failed,
      results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown push error.'

    console.error('send-push-notification failed', {
      error: message,
    })

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
