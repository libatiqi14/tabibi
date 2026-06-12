create table if not exists public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  to_email text not null,
  subject text not null,
  html_body text not null,
  text_body text not null,
  type text not null default 'appointment',
  status text not null default 'pending',
  attempts integer not null default 0,
  error_message text,
  sent_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_notifications_status_check
    check (status in ('pending', 'processing', 'sent', 'failed')),
  constraint email_notifications_type_check
    check (type in ('appointment'))
);

create index if not exists email_notifications_status_next_attempt_idx
  on public.email_notifications (status, next_attempt_at, created_at);

create index if not exists email_notifications_user_id_idx
  on public.email_notifications (user_id);

create index if not exists email_notifications_appointment_id_idx
  on public.email_notifications (appointment_id);

alter table public.email_notifications enable row level security;

revoke all on public.email_notifications from anon;
revoke all on public.email_notifications from authenticated;

grant select, insert, update on public.email_notifications to service_role;

create or replace function public.set_email_notifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_email_notifications_updated_at on public.email_notifications;
create trigger set_email_notifications_updated_at
  before update on public.email_notifications
  for each row execute function public.set_email_notifications_updated_at();

create or replace function public.claim_pending_email_notifications(batch_size integer default 20)
returns setof public.email_notifications
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with queued as (
    select email_notifications.id
    from public.email_notifications
    where email_notifications.status = 'pending'
      and email_notifications.next_attempt_at <= now()
    order by email_notifications.created_at asc
    limit least(greatest(batch_size, 1), 50)
    for update skip locked
  ),
  claimed as (
    update public.email_notifications
    set
      status = 'processing',
      attempts = attempts + 1,
      error_message = null
    from queued
    where email_notifications.id = queued.id
    returning email_notifications.*
  )
  select *
  from claimed;
end;
$$;

grant execute on function public.claim_pending_email_notifications(integer) to service_role;

create or replace function public.handle_appointment_status_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_title text;
  notification_message text;
  email_subject text;
  email_text text;
  email_html text;
  patient_email text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  notification_title := 'تحديث حالة الموعد';
  notification_message := case new.status
    when 'confirmed' then 'تم تأكيد موعدك من طرف الطبيب.'
    when 'cancelled' then 'تم إلغاء موعدك.'
    when 'completed' then 'تم إكمال موعدك.'
    else 'تم تحديث حالة موعدك.'
  end;

  insert into public.notifications (
    user_id,
    appointment_id,
    title,
    message,
    type,
    read
  )
  values (
    new.patient_id,
    new.id,
    notification_title,
    notification_message,
    'appointment',
    false
  );

  if new.status not in ('confirmed', 'cancelled') then
    return new;
  end if;

  select profiles.email
  into patient_email
  from public.profiles
  where profiles.id = new.patient_id;

  if patient_email is null or length(trim(patient_email)) = 0 then
    return new;
  end if;

  email_subject := case new.status
    when 'confirmed' then 'تم تأكيد موعدك الطبي'
    when 'cancelled' then 'تم إلغاء موعدك الطبي'
  end;

  email_text := notification_message || E'\n\n' ||
    'الطبيب: ' || coalesce(new.doctor_name, '-') || E'\n' ||
    'التخصص: ' || coalesce(new.specialty, '-') || E'\n' ||
    'وقت الموعد: ' || to_char(new.appointment_date at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC';

  email_html :=
    '<div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8; color: #0f172a;">' ||
    '<h2 style="margin: 0 0 12px;">' || email_subject || '</h2>' ||
    '<p>' || notification_message || '</p>' ||
    '<ul>' ||
    '<li><strong>الطبيب:</strong> ' || coalesce(new.doctor_name, '-') || '</li>' ||
    '<li><strong>التخصص:</strong> ' || coalesce(new.specialty, '-') || '</li>' ||
    '<li><strong>وقت الموعد:</strong> ' ||
      to_char(new.appointment_date at time zone 'UTC', 'YYYY-MM-DD HH24:MI') ||
      ' UTC</li>' ||
    '</ul>' ||
    '</div>';

  insert into public.email_notifications (
    user_id,
    appointment_id,
    to_email,
    subject,
    html_body,
    text_body,
    type,
    status
  )
  values (
    new.patient_id,
    new.id,
    patient_email,
    email_subject,
    email_html,
    email_text,
    'appointment',
    'pending'
  );

  return new;
end;
$$;

drop trigger if exists on_appointment_status_notifications on public.appointments;
drop trigger if exists on_appointment_status_changed_notifications on public.appointments;
drop trigger if exists appointment_status_notifications_trigger on public.appointments;

create trigger on_appointment_status_notifications
  after update of status on public.appointments
  for each row execute function public.handle_appointment_status_notifications();
