create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null check (role in ('doctor', 'patient')),
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists role text,
  add column if not exists phone text,
  add column if not exists avatar_url text,
  add column if not exists created_at timestamptz not null default now();

alter table public.profiles
  drop constraint if exists profiles_role_check;

update public.profiles
set role = 'patient'
where role is null;

alter table public.profiles
  alter column role set not null;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('doctor', 'patient'));

alter table public.profiles enable row level security;

alter table public.doctors
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create unique index if not exists doctors_user_id_key
  on public.doctors (user_id)
  where user_id is not null;

create index if not exists idx_doctors_user_id
  on public.doctors (user_id);

alter table public.doctors enable row level security;

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

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

create or replace function public.handle_new_user()
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
  user_role := coalesce(new.raw_user_meta_data ->> 'role', 'patient');

  if user_role not in ('doctor', 'patient') then
    user_role := 'patient';
  end if;

  user_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  user_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  doctor_specialty := nullif(trim(coalesce(new.raw_user_meta_data ->> 'specialty', '')), '');
  doctor_clinic_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'clinic_name', '')), '');

  insert into public.profiles (id, email, full_name, role, phone)
  values (new.id, new.email, user_full_name, user_role, user_phone)
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role,
        phone = excluded.phone;

  if user_role = 'doctor' then
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
    on conflict (user_id) do update
      set full_name = excluded.full_name,
          specialty = excluded.specialty,
          clinic_name = excluded.clinic_name,
          phone = excluded.phone,
          email = excluded.email,
          active = true;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
