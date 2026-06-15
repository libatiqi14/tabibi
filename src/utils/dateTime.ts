export const APP_TIME_ZONE = 'Africa/Casablanca'

export function buildAppointmentDateTime(date: string, time: string): string {
  return `${date}T${time}:00`
}

export function formatAppointmentDate(value: string): string {
  return new Intl.DateTimeFormat('fr-MA', {
    dateStyle: 'medium',
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value))
}

export function formatAppointmentTime(value: string): string {
  return new Intl.DateTimeFormat('fr-MA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value))
}

export function formatAppointmentDateTime(value: string): string {
  return new Intl.DateTimeFormat('fr-MA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value))
}

function getDateTimeParts(value: string | Date) {
  const parts = new Intl.DateTimeFormat('fr-MA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: APP_TIME_ZONE,
  }).formatToParts(value instanceof Date ? value : new Date(value))

  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function formatAppointmentDateInput(value: string | Date = new Date()): string {
  const parts = getDateTimeParts(value)

  return `${parts.year}-${parts.month}-${parts.day}`
}

export function formatAppointmentDateTimeLocalInput(value: string): string {
  const parts = getDateTimeParts(value)

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function isAppointmentToday(value: string): boolean {
  return formatAppointmentDateInput(value) === formatAppointmentDateInput()
}

export function formatLocalAppointmentTime(value: string): string {
  const normalized = value.replace('T', ' ')
  const timePart = normalized.split(' ')[1] ?? ''

  return timePart.slice(0, 5)
}

export function formatLocalAppointmentDate(value: string): string {
  const normalized = value.replace('T', ' ')
  const datePart = normalized.split(' ')[0] ?? ''
  const [year, month, day] = datePart.split('-')

  if (!year || !month || !day) {
    return datePart
  }

  return `${day}/${month}/${year}`
}

export function formatLocalAppointmentDateTime(value: string): string {
  return `${formatLocalAppointmentDate(value)} - ${formatLocalAppointmentTime(value)}`
}
