alter table public.doctors
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create unique index if not exists doctors_user_id_key
  on public.doctors (user_id)
  where user_id is not null;

create index if not exists idx_doctors_user_id
  on public.doctors (user_id);
