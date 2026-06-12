create table if not exists public.doctor_reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  constraint doctor_reviews_appointment_id_key unique (appointment_id)
);

create index if not exists doctor_reviews_doctor_id_created_at_idx
  on public.doctor_reviews (doctor_id, created_at desc);

create index if not exists doctor_reviews_patient_id_idx
  on public.doctor_reviews (patient_id);

alter table public.doctor_reviews enable row level security;

grant select, insert on public.doctor_reviews to authenticated;

drop policy if exists "Authenticated users can read doctor reviews" on public.doctor_reviews;
create policy "Authenticated users can read doctor reviews"
  on public.doctor_reviews
  for select
  to authenticated
  using (true);

drop policy if exists "Patients can review completed appointments" on public.doctor_reviews;
create policy "Patients can review completed appointments"
  on public.doctor_reviews
  for insert
  to authenticated
  with check (
    patient_id = auth.uid()
    and exists (
      select 1
      from public.appointments
      where appointments.id = doctor_reviews.appointment_id
        and appointments.patient_id = auth.uid()
        and appointments.doctor_id = doctor_reviews.doctor_id
        and appointments.status = 'completed'
    )
  );
