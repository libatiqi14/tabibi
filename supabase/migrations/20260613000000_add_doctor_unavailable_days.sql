create table if not exists public.doctor_unavailable_days (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  unavailable_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint doctor_unavailable_days_unique_date unique (doctor_id, unavailable_date)
);

create index if not exists doctor_unavailable_days_doctor_id_idx
  on public.doctor_unavailable_days (doctor_id);

create index if not exists doctor_unavailable_days_unavailable_date_idx
  on public.doctor_unavailable_days (unavailable_date);

alter table public.doctor_unavailable_days enable row level security;

grant select on public.doctor_unavailable_days to anon, authenticated;
grant insert, update, delete on public.doctor_unavailable_days to authenticated;

drop policy if exists "Anyone can read unavailable days for active doctors"
  on public.doctor_unavailable_days;
create policy "Anyone can read unavailable days for active doctors"
  on public.doctor_unavailable_days
  for select
  using (
    exists (
      select 1
      from public.doctors
      where doctors.id = doctor_unavailable_days.doctor_id
        and doctors.active = true
    )
  );

drop policy if exists "Doctors can read their own unavailable days"
  on public.doctor_unavailable_days;
create policy "Doctors can read their own unavailable days"
  on public.doctor_unavailable_days
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.doctors
      where doctors.id = doctor_unavailable_days.doctor_id
        and doctors.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can read all unavailable days"
  on public.doctor_unavailable_days;
create policy "Admins can read all unavailable days"
  on public.doctor_unavailable_days
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Doctors can insert their own unavailable days"
  on public.doctor_unavailable_days;
create policy "Doctors can insert their own unavailable days"
  on public.doctor_unavailable_days
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.doctors
      where doctors.id = doctor_unavailable_days.doctor_id
        and doctors.user_id = auth.uid()
    )
  );

drop policy if exists "Doctors can update their own unavailable days"
  on public.doctor_unavailable_days;
create policy "Doctors can update their own unavailable days"
  on public.doctor_unavailable_days
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.doctors
      where doctors.id = doctor_unavailable_days.doctor_id
        and doctors.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.doctors
      where doctors.id = doctor_unavailable_days.doctor_id
        and doctors.user_id = auth.uid()
    )
  );

drop policy if exists "Doctors can delete their own unavailable days"
  on public.doctor_unavailable_days;
create policy "Doctors can delete their own unavailable days"
  on public.doctor_unavailable_days
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.doctors
      where doctors.id = doctor_unavailable_days.doctor_id
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
  select
    not exists (
      select 1
      from public.doctor_unavailable_days
      where doctor_unavailable_days.doctor_id = p_doctor_id
        and doctor_unavailable_days.unavailable_date =
          (p_appointment_date at time zone 'UTC')::date
    )
    and exists (
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
  with unavailable_day as (
    select 1
    from public.doctor_unavailable_days
    where doctor_unavailable_days.doctor_id = p_doctor_id
      and doctor_unavailable_days.unavailable_date = p_date
    limit 1
  ),
  availability as (
    select
      (p_date + doctor_availability.start_time) at time zone 'UTC' as start_at,
      (p_date + doctor_availability.end_time) at time zone 'UTC' as end_at
    from public.doctor_availability
    where doctor_availability.doctor_id = p_doctor_id
      and doctor_availability.active = true
      and doctor_availability.day_of_week = extract(dow from p_date)::int
      and not exists (select 1 from unavailable_day)
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

  if new.doctor_id is null then
    raise exception 'doctor_not_available'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.doctor_unavailable_days
    where doctor_unavailable_days.doctor_id = new.doctor_id
      and doctor_unavailable_days.unavailable_date =
        (new.appointment_date at time zone 'UTC')::date
  ) then
    raise exception 'Doctor is unavailable on this day'
      using errcode = 'P0001';
  end if;

  if not public.is_doctor_available(new.doctor_id, new.appointment_date) then
    raise exception 'doctor_not_available'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;
