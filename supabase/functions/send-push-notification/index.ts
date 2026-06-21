import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import webpush from 'npm:web-push@3.6.7'

type PushRequest = {
  user_id?: string
  appointment_id?: string
  title?: string
  body?: string
  url?: string
  role?: 'patient' | 'doctor' | 'admin'
}

type PushSubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
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

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase Edge Function environment variables.')
}

if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
  throw new Error('Missing VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, or VAPID_SUBJECT.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function authorizeRequest(
  authorization: string,
  payload: Required<Pick<PushRequest, 'user_id' | 'appointment_id'>>,
) {
  const token = authorization.replace(/^Bearer\s+/i, '')
  const { data: userData, error: userError } = await supabase.auth.getUser(token)

  if (userError || !userData.user) {
    throw new Error('Unauthorized request.')
  }

  const callerId = userData.user.id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single()

  if (profileError) {
    throw new Error(profileError.message)
  }

  if (profile.role === 'admin') {
    return
  }

  if (profile.role !== 'doctor') {
    throw new Error('Only a doctor or admin can send appointment push notifications.')
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select('patient_id, doctor_id')
    .eq('id', payload.appointment_id)
    .single()

  if (appointmentError) {
    throw new Error(appointmentError.message)
  }

  const { data: doctor, error: doctorError } = await supabase
    .from('doctors')
    .select('user_id')
    .eq('id', appointment.doctor_id)
    .single()

  if (
    doctorError ||
    doctor?.user_id !== callerId ||
    appointment.patient_id !== payload.user_id
  ) {
    throw new Error('You cannot send a push notification for this appointment.')
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

    if (
      !payload.user_id ||
      !payload.appointment_id ||
      !payload.title ||
      !payload.body
    ) {
      return jsonResponse(
        { error: 'user_id, appointment_id, title, and body are required.' },
        400,
      )
    }

    const authorization = request.headers.get('Authorization')

    if (!authorization) {
      return jsonResponse({ error: 'Missing Authorization header.' }, 401)
    }

    await authorizeRequest(authorization, {
      user_id: payload.user_id,
      appointment_id: payload.appointment_id,
    })

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', payload.user_id)

    if (error) {
      throw new Error(error.message)
    }

    const subscriptions = (data ?? []) as PushSubscriptionRow[]
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? '/patient/dashboard',
      role: payload.role ?? 'patient',
    })

    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            notificationPayload,
          )

          return subscription.id
        } catch (error) {
          const pushError = error as { statusCode?: number; message?: string }

          if (pushError.statusCode === 404 || pushError.statusCode === 410) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', subscription.id)
          }

          console.error('Push delivery failed', {
            subscriptionId: subscription.id,
            statusCode: pushError.statusCode,
            message: pushError.message,
          })
          throw error
        }
      }),
    )

    const sent = results.filter((result) => result.status === 'fulfilled').length
    const failed = results.length - sent

    console.log('Push notification delivery complete', {
      userId: payload.user_id,
      subscriptions: subscriptions.length,
      sent,
      failed,
    })

    return jsonResponse({ subscriptions: subscriptions.length, sent, failed })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown push error.'
    const status = message === 'Unauthorized request.' ? 401 : 500
    console.error('send-push-notification failed', error)
    return jsonResponse({ error: message }, status)
  }
})
