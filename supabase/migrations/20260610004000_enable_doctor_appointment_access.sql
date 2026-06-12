alter table public.appointments
  drop constraint if exists appointments_status_check;

alter table public.appointments
  add constraint appointments_status_check
  check (status in ('scheduled', 'confirmed', 'completed', 'cancelled'));

drop policy if exists "Doctors can view their own appointments" on public.appointments;
create policy "Doctors can view their own appointments"
  on public.appointments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.doctors
      where doctors.id = appointments.doctor_id
        and doctors.user_id = auth.uid()
    )
  );

drop policy if exists "Doctors can update their own appointments" on public.appointments;
create policy "Doctors can update their own appointments"
  on public.appointments
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.doctors
      where doctors.id = appointments.doctor_id
        and doctors.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.doctors
      where doctors.id = appointments.doctor_id
        and doctors.user_id = auth.uid()
    )
  );
