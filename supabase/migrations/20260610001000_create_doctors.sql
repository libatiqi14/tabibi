create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  specialty text not null,
  clinic_name text,
  phone text,
  email text,
  avatar_url text,
  active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_doctors_specialty
  on public.doctors (specialty);

create index if not exists idx_doctors_active
  on public.doctors (active);

alter table public.doctors enable row level security;

drop policy if exists "Authenticated users can read doctors" on public.doctors;
create policy "Authenticated users can read doctors"
  on public.doctors
  for select
  to authenticated
  using (true);
