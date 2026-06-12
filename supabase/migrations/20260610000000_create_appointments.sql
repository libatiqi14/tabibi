create extension if not exists pgcrypto with schema extensions;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  doctor_name text not null,
  specialty text not null,
  appointment_date timestamptz not null,
  status text not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  constraint appointments_status_check
    check (status in ('scheduled', 'completed', 'cancelled'))
);

create index if not exists appointments_patient_id_idx
  on public.appointments (patient_id);

create index if not exists appointments_appointment_date_idx
  on public.appointments (appointment_date);

alter table public.appointments enable row level security;

grant select, insert, update, delete on public.appointments to authenticated;

drop policy if exists "Users can view their own appointments" on public.appointments;
create policy "Users can view their own appointments"
  on public.appointments
  for select
  to authenticated
  using (patient_id = auth.uid());

drop policy if exists "Users can create their own appointments" on public.appointments;
create policy "Users can create their own appointments"
  on public.appointments
  for insert
  to authenticated
  with check (patient_id = auth.uid());

drop policy if exists "Users can update their own appointments" on public.appointments;
create policy "Users can update their own appointments"
  on public.appointments
  for update
  to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

drop policy if exists "Users can delete their own appointments" on public.appointments;
create policy "Users can delete their own appointments"
  on public.appointments
  for delete
  to authenticated
  using (patient_id = auth.uid());
