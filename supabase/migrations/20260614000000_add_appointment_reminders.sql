create table if not exists public.appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  reminder_type text not null,
  status text not null default 'pending',
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  constraint appointment_reminders_type_check
    check (reminder_type in ('24h', '2h')),
  constraint appointment_reminders_status_check
    check (status in ('pending', 'sent', 'failed')),
  constraint appointment_reminders_appointment_type_key
    unique (appointment_id, reminder_type)
);

create index if not exists appointment_reminders_appointment_id_idx
  on public.appointment_reminders (appointment_id);

create index if not exists appointment_reminders_status_created_at_idx
  on public.appointment_reminders (status, created_at);

alter table public.appointment_reminders enable row level security;

revoke all on public.appointment_reminders from anon;
revoke all on public.appointment_reminders from authenticated;

grant select, insert, update on public.appointment_reminders to service_role;
