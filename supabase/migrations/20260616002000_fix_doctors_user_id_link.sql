alter table public.doctors
  add column if not exists user_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'doctors_user_id_fkey'
      and conrelid = 'public.doctors'::regclass
  ) then
    alter table public.doctors
      add constraint doctors_user_id_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete cascade;
  end if;
end;
$$;

create unique index if not exists doctors_user_id_key
  on public.doctors (user_id)
  where user_id is not null;

create index if not exists idx_doctors_user_id
  on public.doctors (user_id);

with matched_doctors as (
  select
    doctors.id as doctor_id,
    auth_users.id as auth_user_id,
    count(*) over (partition by doctors.id) as doctor_match_count,
    count(*) over (partition by auth_users.id) as user_match_count
  from public.doctors as doctors
  join auth.users as auth_users
    on lower(nullif(trim(doctors.email), '')) = lower(nullif(trim(auth_users.email), ''))
  where doctors.user_id is null
    and doctors.email is not null
    and length(trim(doctors.email)) > 0
)
update public.doctors as doctors
set user_id = matched_doctors.auth_user_id
from matched_doctors
where doctors.id = matched_doctors.doctor_id
  and matched_doctors.doctor_match_count = 1
  and matched_doctors.user_match_count = 1
  and not exists (
    select 1
    from public.doctors as linked_doctors
    where linked_doctors.user_id = matched_doctors.auth_user_id
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
  user_email text;
  user_full_name text;
  user_phone text;
  doctor_specialty text;
  doctor_city text;
  doctor_clinic_name text;
begin
  user_role := coalesce(new.raw_user_meta_data ->> 'role', 'patient');

  if user_role not in ('doctor', 'patient') then
    user_role := 'patient';
  end if;

  user_email := nullif(trim(coalesce(new.email, new.raw_user_meta_data ->> 'email', '')), '');
  user_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  user_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  doctor_specialty := nullif(trim(coalesce(new.raw_user_meta_data ->> 'specialty', '')), '');
  doctor_city := nullif(trim(coalesce(new.raw_user_meta_data ->> 'city', '')), '');
  doctor_clinic_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'clinic_name', '')), '');

  insert into public.profiles (id, email, full_name, role, phone)
  values (new.id, user_email, user_full_name, user_role, user_phone)
  on conflict (id) do update
    set email = coalesce(excluded.email, profiles.email),
        full_name = coalesce(excluded.full_name, profiles.full_name),
        role = excluded.role,
        phone = coalesce(excluded.phone, profiles.phone);

  if user_role = 'doctor' then
    insert into public.doctors (
      user_id,
      full_name,
      specialty,
      city,
      clinic_name,
      phone,
      email,
      active
    )
    values (
      new.id,
      coalesce(user_full_name, user_email),
      coalesce(doctor_specialty, 'General Medicine'),
      doctor_city,
      doctor_clinic_name,
      user_phone,
      user_email,
      true
    )
    on conflict (user_id) do update
      set full_name = coalesce(excluded.full_name, doctors.full_name),
          specialty = excluded.specialty,
          city = coalesce(excluded.city, doctors.city),
          clinic_name = coalesce(excluded.clinic_name, doctors.clinic_name),
          phone = coalesce(excluded.phone, doctors.phone),
          email = coalesce(excluded.email, doctors.email),
          active = true;
  end if;

  return new;
end;
$$;
