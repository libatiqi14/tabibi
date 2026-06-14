import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

type ReminderType = '24h' | '2h'
type ReminderStatus = 'sent' | 'failed'

type AppointmentRow = {
  id: string
  patient_id: string
  doctor_name: string
  specialty: string
  appointment_date: string
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
}

type ProfileRow = {
  email: string | null
  full_name?: string | null
}

type ReminderRow = {
  id: string
  appointment_id: string
  reminder_type: ReminderType
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

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function formatDateTime(isoDate: string) {
  const date = new Date(isoDate)

  return {
    date: new Intl.DateTimeFormat('ar', {
      dateStyle: 'full',
      timeZone: 'UTC',
    }).format(date),
    time: new Intl.DateTimeFormat('ar', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }).format(date),
  }
}

function getReminderWindow(type: ReminderType, now = new Date()) {
  if (type === '24h') {
    return {
      from: addMinutes(now, 23 * 60 + 55).toISOString(),
      to: addMinutes(now, 24 * 60 + 5).toISOString(),
    }
  }

  return {
    from: addMinutes(now, 115).toISOString(),
    to: addMinutes(now, 125).toISOString(),
  }
}

function getNotificationMessage(appointment: AppointmentRow, reminderType: ReminderType) {
  const { time } = formatDateTime(appointment.appointment_date)

  if (reminderType === '24h') {
    return `لديك موعد طبي غداً مع د. ${appointment.doctor_name} على الساعة ${time}.`
  }

  return `لديك موعد طبي بعد ساعتين مع د. ${appointment.doctor_name} على الساعة ${time}.`
}

function getEmailBody(appointment: AppointmentRow, reminderType: ReminderType) {
  const { date, time } = formatDateTime(appointment.appointment_date)
  const leadText =
    reminderType === '24h'
      ? 'هذا تذكير بموعدك الطبي غداً.'
      : 'هذا تذكير بموعدك الطبي بعد ساعتين.'

  const text = [
    leadText,
    '',
    `الطبيب: د. ${appointment.doctor_name}`,
    `التخصص: ${appointment.specialty}`,
    `التاريخ: ${date}`,
    `الوقت: ${time}`,
    '',
    'نتمنى لك زيارة طبية موفقة.',
  ].join('\n')

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8; color: #0f172a;">
      <div style="max-width: 560px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 18px; padding: 24px;">
        <p style="margin: 0 0 8px; color: #0f766e; font-weight: 700;">Tabibi</p>
        <h2 style="margin: 0 0 16px; color: #020617;">تذكير بموعدك الطبي</h2>
        <p style="margin: 0 0 16px;">${leadText}</p>
        <ul style="padding-right: 20px; margin: 0 0 16px;">
          <li><strong>الطبيب:</strong> د. ${appointment.doctor_name}</li>
          <li><strong>التخصص:</strong> ${appointment.specialty}</li>
          <li><strong>التاريخ:</strong> ${date}</li>
          <li><strong>الوقت:</strong> ${time}</li>
        </ul>
        <p style="margin: 0; color: #475569;">نتمنى لك زيارة طبية موفقة.</p>
      </div>
    </div>
  `

  return { text, html }
}

async function fetchAppointmentsForReminder(type: ReminderType) {
  const window = getReminderWindow(type)

  console.log('Fetching appointments for reminder window', {
    type,
    from: window.from,
    to: window.to,
  })

  const { data, error } = await supabase
    .from('appointments')
    .select('id, patient_id, doctor_name, specialty, appointment_date, status')
    .in('status', ['scheduled', 'confirmed'])
    .gte('appointment_date', window.from)
    .lte('appointment_date', window.to)
    .order('appointment_date', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as AppointmentRow[]
}

async function createReminder(appointmentId: string, reminderType: ReminderType) {
  const { data, error } = await supabase
    .from('appointment_reminders')
    .insert({
      appointment_id: appointmentId,
      reminder_type: reminderType,
      status: 'pending',
    })
    .select('id, appointment_id, reminder_type')
    .single()

  if (error) {
    if (error.code === '23505') {
      console.log('Reminder already exists, skipping duplicate', {
        appointmentId,
        reminderType,
      })
      return null
    }

    throw new Error(error.message)
  }

  return data as ReminderRow
}

async function getPatientProfile(patientId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', patientId)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as ProfileRow
}

async function createInAppNotification(
  appointment: AppointmentRow,
  reminderType: ReminderType,
) {
  const { error } = await supabase.from('notifications').insert({
    user_id: appointment.patient_id,
    appointment_id: appointment.id,
    title: 'تذكير بالموعد',
    message: getNotificationMessage(appointment, reminderType),
    type: 'appointment_reminder',
    read: false,
  })

  if (error) {
    throw new Error(error.message)
  }
}

async function sendReminderEmail(
  appointment: AppointmentRow,
  profile: ProfileRow,
  reminderType: ReminderType,
) {
  const recipient = profile.email?.trim()

  if (!recipient) {
    throw new Error('Patient profile is missing email.')
  }

  const body = getEmailBody(appointment, reminderType)

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: recipient,
      subject: 'تذكير بموعدك الطبي',
      html: body.html,
      text: body.text,
    }),
  })

  const responseBody = await response.json().catch(() => null)

  if (!response.ok) {
    console.error('Resend reminder email failed', {
      appointment_id: appointment.id,
      reminder_type: reminderType,
      status: response.status,
      body: responseBody,
    })

    const errorMessage =
      typeof responseBody?.message === 'string'
        ? responseBody.message
        : `Resend request failed with status ${response.status}.`

    throw new Error(errorMessage)
  }

  console.log('Reminder email sent', {
    appointment_id: appointment.id,
    reminder_type: reminderType,
    resend_id: responseBody?.id ?? null,
  })
}

async function updateReminderStatus(
  reminderId: string,
  status: ReminderStatus,
  errorMessage: string | null = null,
) {
  const { error } = await supabase
    .from('appointment_reminders')
    .update({
      status,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      error_message: errorMessage,
    })
    .eq('id', reminderId)

  if (error) {
    console.error('Failed to update reminder status', {
      reminderId,
      status,
      error: error.message,
    })
  }
}

async function processAppointment(
  appointment: AppointmentRow,
  reminderType: ReminderType,
) {
  const reminder = await createReminder(appointment.id, reminderType)

  if (!reminder) {
    return { appointmentId: appointment.id, reminderType, status: 'skipped' }
  }

  try {
    const profile = await getPatientProfile(appointment.patient_id)

    await createInAppNotification(appointment, reminderType)
    await sendReminderEmail(appointment, profile, reminderType)
    await updateReminderStatus(reminder.id, 'sent')

    return { appointmentId: appointment.id, reminderType, status: 'sent' }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown reminder processing error.'

    console.error('Appointment reminder failed', {
      appointment_id: appointment.id,
      reminder_type: reminderType,
      error: message,
    })

    await updateReminderStatus(reminder.id, 'failed', message)

    return {
      appointmentId: appointment.id,
      reminderType,
      status: 'failed',
      error: message,
    }
  }
}

serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  console.log('send-appointment-reminders started')

  try {
    const reminderTypes: ReminderType[] = ['24h', '2h']
    const results = []

    for (const reminderType of reminderTypes) {
      const appointments = await fetchAppointmentsForReminder(reminderType)

      console.log('Appointments found for reminder type', {
        reminderType,
        count: appointments.length,
      })

      for (const appointment of appointments) {
        const result = await processAppointment(appointment, reminderType)
        results.push(result)
      }
    }

    console.log('send-appointment-reminders finished', {
      processed: results.length,
    })

    return jsonResponse({
      processed: results.length,
      results,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown reminder function error.'

    console.error('send-appointment-reminders failed', {
      error: message,
    })

    return jsonResponse({ error: message }, 500)
  }
})
