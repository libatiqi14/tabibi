create unique index if not exists appointments_no_double_booking_idx
  on public.appointments (doctor_id, appointment_date)
  where doctor_id is not null
    and status in ('scheduled', 'confirmed');

create table if not exists public.doctor_availability (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint doctor_availability_time_check check (start_time < end_time)
);

create unique index if not exists doctor_availability_doctor_day_key
  on public.doctor_availability (doctor_id, day_of_week);

create index if not exists doctor_availability_doctor_id_idx
  on public.doctor_availability (doctor_id);

create index if not exists doctor_availability_active_idx
  on public.doctor_availability (active);

alter table public.doctor_availability enable row level security;

grant select on public.doctor_availability to anon, authenticated;
grant insert, update, delete on public.doctor_availability to authenticated;

drop policy if exists "Anyone can read active doctor availability" on public.doctor_availability;
create policy "Anyone can read active doctor availability"
  on public.doctor_availability
  for select
  using (active = true);

drop policy if exists "Doctors can read their own availability" on public.doctor_availability;
create policy "Doctors can read their own availability"
  on public.doctor_availability
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.doctors
      where doctors.id = doctor_availability.doctor_id
        and doctors.user_id = auth.uid()
    )
  );

drop policy if exists "Doctors can insert their own availability" on public.doctor_availability;
create policy "Doctors can insert their own availability"
  on public.doctor_availability
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.doctors
      where doctors.id = doctor_availability.doctor_id
        and doctors.user_id = auth.uid()
    )
  );

drop policy if exists "Doctors can update their own availability" on public.doctor_availability;
create policy "Doctors can update their own availability"
  on public.doctor_availability
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.doctors
      where doctors.id = doctor_availability.doctor_id
        and doctors.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.doctors
      where doctors.id = doctor_availability.doctor_id
        and doctors.user_id = auth.uid()
    )
  );

drop policy if exists "Doctors can delete their own availability" on public.doctor_availability;
create policy "Doctors can delete their own availability"
  on public.doctor_availability
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.doctors
      where doctors.id = doctor_availability.doctor_id
        and doctors.user_id = auth.uid()
    )
  );

create or replace function public.is_doctor_available(
  p_doctor_id uuid,
  p_appointment_date timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.doctor_availability
    where doctor_availability.doctor_id = p_doctor_id
      and doctor_availability.active = true
      and doctor_availability.day_of_week =
        extract(dow from (p_appointment_date at time zone 'UTC'))::int
      and (p_appointment_date at time zone 'UTC')::time >= doctor_availability.start_time
      and (p_appointment_date at time zone 'UTC')::time < doctor_availability.end_time
  );
$$;

create or replace function public.get_doctor_available_slots(
  p_doctor_id uuid,
  p_date date,
  p_slot_minutes int default 30
)
returns table (
  slot_start timestamptz,
  slot_end timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with availability as (
    select
      (p_date + doctor_availability.start_time) at time zone 'UTC' as start_at,
      (p_date + doctor_availability.end_time) at time zone 'UTC' as end_at
    from public.doctor_availability
    where doctor_availability.doctor_id = p_doctor_id
      and doctor_availability.active = true
      and doctor_availability.day_of_week = extract(dow from p_date)::int
  ),
  slots as (
    select
      generate_series(
        availability.start_at,
        availability.end_at - make_interval(mins => greatest(p_slot_minutes, 1)),
        make_interval(mins => greatest(p_slot_minutes, 1))
      ) as slot_start
    from availability
  )
  select
    slots.slot_start,
    slots.slot_start + make_interval(mins => greatest(p_slot_minutes, 1)) as slot_end
  from slots
  where slots.slot_start > now()
    and not exists (
      select 1
      from public.appointments
      where appointments.doctor_id = p_doctor_id
        and appointments.appointment_date = slots.slot_start
        and appointments.status in ('scheduled', 'confirmed')
    )
  order by slots.slot_start;
$$;

grant execute on function public.is_doctor_available(uuid, timestamptz) to anon, authenticated;
grant execute on function public.get_doctor_available_slots(uuid, date, int) to anon, authenticated;

create or replace function public.prevent_invalid_appointment_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status not in ('scheduled', 'confirmed') then
    return new;
  end if;

  if new.doctor_id is null or not public.is_doctor_available(new.doctor_id, new.appointment_date) then
    raise exception 'doctor_not_available'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_invalid_appointment_booking on public.appointments;
create trigger prevent_invalid_appointment_booking
  before insert or update of doctor_id, appointment_date, status on public.appointments
  for each row execute function public.prevent_invalid_appointment_booking();
