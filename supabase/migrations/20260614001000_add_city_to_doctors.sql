alter table public.doctors
  add column if not exists city text;

create index if not exists idx_doctors_city
  on public.doctors (city);
