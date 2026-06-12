import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

type EmailNotificationRow = {
  id: string
  patient_email?: string | null
  to_email?: string | null
  subject?: string | null
  message?: string | null
  html_body?: string | null
  text_body?: string | null
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const resendApiKey = Deno.env.get('RESEND_API_KEY')

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL environment variable.')
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.')
}

if (!resendApiKey) {
  throw new Error('Missing RESEND_API_KEY environment variable.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getRecipient(row: EmailNotificationRow) {
  return row.patient_email ?? row.to_email ?? ''
}

function getMessage(row: EmailNotificationRow) {
  return row.message ?? row.text_body ?? ''
}

function getHtml(row: EmailNotificationRow) {
  if (row.html_body) {
    return row.html_body
  }

  return `<div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8; color: #0f172a;">${getMessage(
    row,
  )}</div>`
}

async function sendEmail(row: EmailNotificationRow) {
  const recipient = getRecipient(row)
  const subject = row.subject ?? 'تحديث موعدك الطبي'
  const message = getMessage(row)

  if (!recipient) {
    throw new Error('Email notification row is missing patient_email/to_email.')
  }

  if (!message && !row.html_body) {
    throw new Error('Email notification row is missing message/html_body.')
  }

  console.log('Sending appointment email', {
    id: row.id,
    to: recipient,
    subject,
  })

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: recipient,
      subject,
      html: getHtml(row),
      text: message,
    }),
  })

  const responseBody = await response.json().catch(() => null)

  if (!response.ok) {
    console.error('Resend email failed', {
      id: row.id,
      status: response.status,
      body: responseBody,
    })

    const errorMessage =
      typeof responseBody?.message === 'string'
        ? responseBody.message
        : `Resend request failed with status ${response.status}.`

    throw new Error(errorMessage)
  }

  console.log('Resend email sent', {
    id: row.id,
    resend_id: responseBody?.id ?? null,
  })

  return responseBody
}

serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  console.log('send-appointment-email started')

  const { data: rows, error: fetchError } = await supabase
    .from('email_notifications')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(25)

  if (fetchError) {
    console.error('Failed to fetch pending email notifications', fetchError)
    return jsonResponse({ error: fetchError.message }, 500)
  }

  const notifications = (rows ?? []) as EmailNotificationRow[]
  const results = []

  console.log('Pending email notifications found', notifications.length)

  for (const row of notifications) {
    try {
      await sendEmail(row)

      const { error: updateError } = await supabase
        .from('email_notifications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', row.id)

      if (updateError) {
        throw new Error(updateError.message)
      }

      results.push({ id: row.id, status: 'sent' })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown email sending error.'

      console.error('Appointment email processing failed', {
        id: row.id,
        error: message,
      })

      const { error: updateError } = await supabase
        .from('email_notifications')
        .update({ status: 'failed' })
        .eq('id', row.id)

      if (updateError) {
        console.error('Failed to mark email notification as failed', {
          id: row.id,
          error: updateError.message,
        })
      }

      results.push({ id: row.id, status: 'failed', error: message })
    }
  }

  console.log('send-appointment-email finished', {
    processed: results.length,
  })

  return jsonResponse({
    processed: results.length,
    results,
  })
})
