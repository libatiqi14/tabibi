insert into storage.buckets (id, name, public)
values ('doctor-avatars', 'doctor-avatars', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Public can read doctor avatars" on storage.objects;
create policy "Public can read doctor avatars"
  on storage.objects
  for select
  using (bucket_id = 'doctor-avatars');

drop policy if exists "Doctors can upload their own avatars" on storage.objects;
create policy "Doctors can upload their own avatars"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'doctor-avatars'
    and exists (
      select 1
      from public.doctors
      where doctors.user_id = auth.uid()
        and name like 'doctors/' || doctors.id::text || '/%'
    )
  );

drop policy if exists "Doctors can update their own avatars" on storage.objects;
create policy "Doctors can update their own avatars"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'doctor-avatars'
    and exists (
      select 1
      from public.doctors
      where doctors.user_id = auth.uid()
        and name like 'doctors/' || doctors.id::text || '/%'
    )
  )
  with check (
    bucket_id = 'doctor-avatars'
    and exists (
      select 1
      from public.doctors
      where doctors.user_id = auth.uid()
        and name like 'doctors/' || doctors.id::text || '/%'
    )
  );
