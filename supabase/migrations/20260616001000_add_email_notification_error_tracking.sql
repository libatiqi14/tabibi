alter table public.email_notifications
  add column if not exists error_message text;
