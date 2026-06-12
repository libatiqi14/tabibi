update public.appointments as appointment
set doctor_id = doctor.id
from public.doctors as doctor
where appointment.doctor_id is null
  and lower(trim(appointment.doctor_name)) = lower(trim(doctor.full_name))
  and lower(trim(appointment.specialty)) = lower(trim(doctor.specialty));

update public.appointments as appointment
set doctor_id = doctor.id
from public.doctors as doctor
where appointment.doctor_id = doctor.user_id;

create index if not exists appointments_doctor_id_appointment_date_idx
  on public.appointments (doctor_id, appointment_date);

grant select, update on public.appointments to authenticated;
grant select on public.doctors to authenticated;

drop policy if exists "Authenticated users can read doctors" on public.doctors;
create policy "Authenticated users can read doctors"
  on public.doctors
  for select
  to authenticated
  using (true);

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
