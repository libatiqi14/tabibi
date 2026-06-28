alter table public.doctors
add column if not exists active boolean default false;

alter table public.doctors
alter column active set default false;

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
    false
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

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

  if user_role not in ('patient', 'doctor', 'admin') then
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
      false
    )
    on conflict (user_id) do update
      set full_name = coalesce(excluded.full_name, doctors.full_name),
          specialty = excluded.specialty,
          city = coalesce(excluded.city, doctors.city),
          clinic_name = coalesce(excluded.clinic_name, doctors.clinic_name),
          phone = coalesce(excluded.phone, doctors.phone),
          email = coalesce(excluded.email, doctors.email);
  end if;

  return new;
end;
$$;
