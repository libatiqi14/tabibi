alter table public.appointments
  add column if not exists doctor_id uuid references public.doctors(id) on delete set null;

create index if not exists appointments_doctor_id_idx
  on public.appointments (doctor_id);
