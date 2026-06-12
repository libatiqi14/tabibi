alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'doctor', 'patient'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

grant select on public.profiles to authenticated;
grant select, update on public.doctors to authenticated;
grant select on public.appointments to authenticated;
grant select on public.notifications to authenticated;
grant select, delete on public.doctor_reviews to authenticated;

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read all doctors" on public.doctors;
create policy "Admins can read all doctors"
  on public.doctors
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update doctors" on public.doctors;
create policy "Admins can update doctors"
  on public.doctors
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can read all appointments" on public.appointments;
create policy "Admins can read all appointments"
  on public.appointments
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read all notifications" on public.notifications;
create policy "Admins can read all notifications"
  on public.notifications
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read all doctor reviews" on public.doctor_reviews;
create policy "Admins can read all doctor reviews"
  on public.doctor_reviews
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can delete doctor reviews" on public.doctor_reviews;
create policy "Admins can delete doctor reviews"
  on public.doctor_reviews
  for delete
  to authenticated
  using (public.is_admin());

create or replace function public.prevent_inactive_doctor_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.doctor_id is not null
    and not exists (
      select 1
      from public.doctors
      where doctors.id = new.doctor_id
        and doctors.active = true
    )
  then
    raise exception 'doctor_inactive'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_inactive_doctor_booking on public.appointments;
create trigger prevent_inactive_doctor_booking
  before insert or update of doctor_id, appointment_date on public.appointments
  for each row execute function public.prevent_inactive_doctor_booking();
