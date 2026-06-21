create or replace function public.get_admin_dashboard_stats()
returns table (
  patients_count bigint,
  doctors_count bigint,
  appointments_count bigint,
  notifications_count bigint,
  unlinked_appointments_count bigint,
  reviews_count bigint,
  average_platform_rating numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_access_required'
      using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.profiles where role = 'patient'),
    (select count(*) from public.doctors),
    (select count(*) from public.appointments),
    (select count(*) from public.notifications),
    (select count(*) from public.appointments where doctor_id is null),
    (select count(*) from public.doctor_reviews),
    (select avg(rating)::numeric from public.doctor_reviews);
end;
$$;

revoke all on function public.get_admin_dashboard_stats() from public;
grant execute on function public.get_admin_dashboard_stats() to authenticated;
