alter table public.doctors
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create unique index if not exists doctors_user_id_key
  on public.doctors (user_id)
  where user_id is not null;

create index if not exists idx_doctors_user_id
  on public.doctors (user_id);

alter table public.doctors enable row level security;

grant select, insert, update on public.doctors to authenticated;

drop policy if exists "Authenticated users can read doctors" on public.doctors;
create policy "Authenticated users can read doctors"
  on public.doctors
  for select
  to authenticated
  using (true);

drop policy if exists "Doctors can insert their own doctor profile" on public.doctors;
create policy "Doctors can insert their own doctor profile"
  on public.doctors
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Doctors can update their own doctor profile" on public.doctors;
create policy "Doctors can update their own doctor profile"
  on public.doctors
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_new_doctor_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
  user_full_name text;
  user_phone text;
  doctor_specialty text;
  doctor_clinic_name text;
begin
  user_role := new.raw_user_meta_data ->> 'role';

  if user_role <> 'doctor' then
    return new;
  end if;

  user_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  user_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  doctor_specialty := nullif(trim(coalesce(new.raw_user_meta_data ->> 'specialty', '')), '');
  doctor_clinic_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'clinic_name', '')), '');

  insert into public.doctors (
    user_id,
    full_name,
    specialty,
    clinic_name,
    phone,
    email,
    active
  )
  values (
    new.id,
    coalesce(user_full_name, new.email),
    coalesce(doctor_specialty, 'General Medicine'),
    doctor_clinic_name,
    user_phone,
    new.email,
    true
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_doctor_user_created on auth.users;
create trigger on_auth_doctor_user_created
  after insert on auth.users
  for each row execute function public.handle_new_doctor_user();

insert into public.doctors (
  user_id,
  full_name,
  specialty,
  phone,
  email,
  active
)
select
  profiles.id,
  coalesce(nullif(trim(profiles.full_name), ''), profiles.email),
  'General Medicine',
  profiles.phone,
  profiles.email,
  true
from public.profiles
where profiles.role = 'doctor'
  and not exists (
    select 1
    from public.doctors
    where doctors.user_id = profiles.id
  );
