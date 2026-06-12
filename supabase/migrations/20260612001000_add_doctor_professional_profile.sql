alter table public.doctors
  add column if not exists years_experience integer,
  add column if not exists medical_school text,
  add column if not exists graduation_year integer,
  add column if not exists biography text,
  add column if not exists languages text[],
  add column if not exists previous_hospitals text[];

alter table public.doctors
  drop constraint if exists doctors_years_experience_check;

alter table public.doctors
  add constraint doctors_years_experience_check
  check (years_experience is null or years_experience >= 0);

alter table public.doctors
  drop constraint if exists doctors_graduation_year_check;

alter table public.doctors
  add constraint doctors_graduation_year_check
  check (graduation_year is null or graduation_year >= 1950);
