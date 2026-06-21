create or replace function public.get_admin_dashboard_full()
returns jsonb
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

  return jsonb_build_object(
    'stats',
    jsonb_build_object(
      'patients_count',
      (select count(*) from public.profiles where role = 'patient'),
      'doctors_count',
      (select count(*) from public.doctors),
      'active_doctors_count',
      (select count(*) from public.doctors where active is true),
      'inactive_doctors_count',
      (select count(*) from public.doctors where active is false or active is null),
      'appointments_count',
      (select count(*) from public.appointments),
      'notifications_count',
      (select count(*) from public.notifications)
    ),
    'doctors',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(doctor)
          || jsonb_build_object(
            'appointments_count',
            (
              select count(*)
              from public.appointments
              where appointments.doctor_id = doctor.id
            ),
            'reviews_count',
            (
              select count(*)
              from public.doctor_reviews
              where doctor_reviews.doctor_id = doctor.id
            ),
            'average_rating',
            (
              select avg(doctor_reviews.rating)::numeric
              from public.doctor_reviews
              where doctor_reviews.doctor_id = doctor.id
            )
          )
          order by doctor.created_at desc
        )
        from public.doctors as doctor
      ),
      '[]'::jsonb
    ),
    'patients',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(profile)
          || jsonb_build_object(
            'appointments_count',
            (
              select count(*)
              from public.appointments
              where appointments.patient_id = profile.id
            )
          )
          order by profile.created_at desc
        )
        from public.profiles as profile
        where profile.role = 'patient'
      ),
      '[]'::jsonb
    ),
    'appointments',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(appointment)
          || jsonb_build_object(
            'patient_name',
            coalesce(patient.full_name, patient.email, 'غير متوفر'),
            'doctor_name',
            coalesce(doctor.full_name, appointment.doctor_name, 'غير متوفر')
          )
          order by appointment.appointment_date desc
        )
        from public.appointments as appointment
        left join public.profiles as patient
          on patient.id = appointment.patient_id
        left join public.doctors as doctor
          on doctor.id = appointment.doctor_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.get_admin_dashboard_full() from public;
grant execute on function public.get_admin_dashboard_full() to authenticated;
