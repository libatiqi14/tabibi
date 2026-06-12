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
grant select, update on public.doctors to authenticated;

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
