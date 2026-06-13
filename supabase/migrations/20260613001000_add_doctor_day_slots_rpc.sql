create or replace function public.get_doctor_day_slots(
  p_doctor_id uuid,
  p_date date,
  p_slot_minutes int default 10
)
returns table (
  slot_start text,
  slot_end text,
  status text
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
    to_char(slots.slot_start at time zone 'UTC', 'HH24:MI') as slot_start,
    to_char(
      (slots.slot_start + make_interval(mins => greatest(p_slot_minutes, 1)))
        at time zone 'UTC',
      'HH24:MI'
    ) as slot_end,
    case
      when exists (
        select 1
        from public.appointments
        where appointments.doctor_id = p_doctor_id
          and appointments.appointment_date = slots.slot_start
          and appointments.status in ('scheduled', 'confirmed')
      )
      then 'booked'
      else 'available'
    end as status
  from slots
  where slots.slot_start > now()
  order by slots.slot_start;
$$;

grant execute on function public.get_doctor_day_slots(uuid, date, int)
  to anon, authenticated;
