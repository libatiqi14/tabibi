update public.profiles as profiles
set email = auth_users.email
from auth.users as auth_users
where profiles.id = auth_users.id
  and auth_users.email is not null
  and length(trim(auth_users.email)) > 0
  and (profiles.email is null or length(trim(profiles.email)) = 0);

update public.email_notifications as email_notifications
set
  to_email = coalesce(nullif(trim(profiles.email), ''), auth_users.email),
  status = 'pending',
  error_message = null,
  next_attempt_at = now()
from auth.users as auth_users
left join public.profiles as profiles
  on profiles.id = auth_users.id
where email_notifications.user_id = auth_users.id
  and email_notifications.sent_at is null
  and email_notifications.status in ('pending', 'failed')
  and (email_notifications.to_email is null or length(trim(email_notifications.to_email)) = 0)
  and coalesce(nullif(trim(profiles.email), ''), auth_users.email) is not null
  and length(trim(coalesce(nullif(trim(profiles.email), ''), auth_users.email))) > 0;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
  user_email text;
  user_full_name text;
  user_phone text;
  doctor_specialty text;
  doctor_clinic_name text;
begin
  user_role := coalesce(new.raw_user_meta_data ->> 'role', 'patient');

  if user_role not in ('doctor', 'patient') then
    user_role := 'patient';
  end if;

  user_email := nullif(trim(coalesce(new.email, new.raw_user_meta_data ->> 'email', '')), '');
  user_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  user_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  doctor_specialty := nullif(trim(coalesce(new.raw_user_meta_data ->> 'specialty', '')), '');
  doctor_clinic_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'clinic_name', '')), '');

  insert into public.profiles (id, email, full_name, role, phone)
  values (new.id, user_email, user_full_name, user_role, user_phone)
  on conflict (id) do update
    set email = coalesce(excluded.email, profiles.email),
        full_name = coalesce(excluded.full_name, profiles.full_name),
        role = excluded.role,
        phone = coalesce(excluded.phone, profiles.phone);

  if user_role = 'doctor' then
    insert into public.doctors (
      user_id,
      full_name,
      specialty,
      clinic_name,
      phone,
      email,
      active
    )
    values (
      new.id,
      coalesce(user_full_name, user_email),
      coalesce(doctor_specialty, 'General Medicine'),
      doctor_clinic_name,
      user_phone,
      user_email,
      true
    )
    on conflict (user_id) do update
      set full_name = coalesce(excluded.full_name, doctors.full_name),
          specialty = excluded.specialty,
          clinic_name = coalesce(excluded.clinic_name, doctors.clinic_name),
          phone = coalesce(excluded.phone, doctors.phone),
          email = coalesce(excluded.email, doctors.email),
          active = true;
  end if;

  return new;
end;
$$;

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
  appointment_time_text text;
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

  select coalesce(nullif(trim(profiles.email), ''), nullif(trim(auth_users.email), ''))
  into patient_email
  from auth.users as auth_users
  left join public.profiles as profiles
    on profiles.id = auth_users.id
  where auth_users.id = new.patient_id;

  if patient_email is null or length(trim(patient_email)) = 0 then
    return new;
  end if;

  appointment_time_text := to_char(new.appointment_date, 'YYYY-MM-DD HH24:MI');

  email_subject := case new.status
    when 'confirmed' then 'تم تأكيد موعدك الطبي'
    when 'cancelled' then 'تم إلغاء موعدك الطبي'
  end;

  email_text := notification_message || E'\n\n' ||
    'الطبيب: ' || coalesce(new.doctor_name, '-') || E'\n' ||
    'التخصص: ' || coalesce(new.specialty, '-') || E'\n' ||
    'وقت الموعد: ' || appointment_time_text;

  email_html :=
    '<div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8; color: #0f172a;">' ||
    '<h2 style="margin: 0 0 12px;">' || email_subject || '</h2>' ||
    '<p>' || notification_message || '</p>' ||
    '<ul>' ||
    '<li><strong>الطبيب:</strong> ' || coalesce(new.doctor_name, '-') || '</li>' ||
    '<li><strong>التخصص:</strong> ' || coalesce(new.specialty, '-') || '</li>' ||
    '<li><strong>وقت الموعد:</strong> ' || appointment_time_text || '</li>' ||
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
