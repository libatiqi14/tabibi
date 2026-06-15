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

  select profiles.email
  into patient_email
  from public.profiles
  where profiles.id = new.patient_id;

  if patient_email is null or length(trim(patient_email)) = 0 then
    return new;
  end if;

  appointment_time_text :=
    to_char(new.appointment_date at time zone 'Africa/Casablanca', 'YYYY-MM-DD HH24:MI');

  email_subject := case new.status
    when 'confirmed' then 'تم تأكيد موعدك الطبي'
    when 'cancelled' then 'تم إلغاء موعدك الطبي'
  end;

  email_text := notification_message || E'\n\n' ||
    'الطبيب: ' || coalesce(new.doctor_name, '-') || E'\n' ||
    'التخصص: ' || coalesce(new.specialty, '-') || E'\n' ||
    'وقت الموعد: ' || appointment_time_text || ' Africa/Casablanca';

  email_html :=
    '<div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8; color: #0f172a;">' ||
    '<h2 style="margin: 0 0 12px;">' || email_subject || '</h2>' ||
    '<p>' || notification_message || '</p>' ||
    '<ul>' ||
    '<li><strong>الطبيب:</strong> ' || coalesce(new.doctor_name, '-') || '</li>' ||
    '<li><strong>التخصص:</strong> ' || coalesce(new.specialty, '-') || '</li>' ||
    '<li><strong>وقت الموعد:</strong> ' ||
      appointment_time_text ||
      ' Africa/Casablanca</li>' ||
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
