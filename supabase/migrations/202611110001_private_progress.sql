begin;

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  local_id text not null check (length(local_id) between 1 and 1000),
  measured_at timestamptz,
  measurement_date date not null,
  weight_kg numeric check (weight_kg between 1 and 800),
  body_fat_pct numeric check (body_fat_pct between 0 and 100),
  body_fat_method text check (length(body_fat_method) <= 200),
  waist_cm numeric check (waist_cm between 1 and 400),
  abdomen_cm numeric check (abdomen_cm between 1 and 400),
  shoulder_cm numeric check (shoulder_cm between 1 and 400),
  chest_cm numeric check (chest_cm between 1 and 400),
  hip_cm numeric check (hip_cm between 1 and 400),
  right_arm_relaxed_cm numeric check (right_arm_relaxed_cm between 1 and 400),
  left_arm_relaxed_cm numeric check (left_arm_relaxed_cm between 1 and 400),
  right_arm_flexed_cm numeric check (right_arm_flexed_cm between 1 and 400),
  left_arm_flexed_cm numeric check (left_arm_flexed_cm between 1 and 400),
  right_forearm_cm numeric check (right_forearm_cm between 1 and 400),
  left_forearm_cm numeric check (left_forearm_cm between 1 and 400),
  right_thigh_cm numeric check (right_thigh_cm between 1 and 400),
  left_thigh_cm numeric check (left_thigh_cm between 1 and 400),
  right_calf_cm numeric check (right_calf_cm between 1 and 400),
  left_calf_cm numeric check (left_calf_cm between 1 and 400),
  arm_cm numeric check (arm_cm between 1 and 400),
  thigh_cm numeric check (thigh_cm between 1 and 400),
  calf_cm numeric check (calf_cm between 1 and 400),
  notes text check (length(notes) <= 2000),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, local_id),
  unique (user_id, id),
  check (body_fat_pct is null or coalesce(length(trim(body_fat_method)), 0) > 0)
);

create table public.progress_photos (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measurement_id uuid,
  taken_at date not null,
  pose text not null check (pose in ('front', 'right', 'left', 'back')),
  storage_path text not null unique,
  thumbnail_path text not null unique,
  mime_type text not null check (mime_type = 'image/jpeg'),
  width integer not null check (width between 1 and 1920),
  height integer not null check (height between 1 and 1920),
  file_size integer not null check (file_size between 1 and 8388608),
  notes text check (length(notes) <= 2000),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (user_id, measurement_id) references public.body_measurements(user_id, id) on delete set null (measurement_id),
  check (storage_path = user_id::text || '/' || id::text || '/original.jpg'),
  check (thumbnail_path = user_id::text || '/' || id::text || '/miniatura.jpg')
);

create index body_measurements_user_date_idx on public.body_measurements (user_id, measurement_date desc, measured_at desc);
create index progress_photos_user_date_idx on public.progress_photos (user_id, taken_at desc);
create index progress_photos_user_measurement_idx on public.progress_photos (user_id, measurement_id);

create function public.stamp_progress_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.revision := 1;
    new.created_at := now();
  else
    if new.id is distinct from old.id or new.user_id is distinct from old.user_id then
      raise exception 'Record identity is immutable';
    end if;
    new.revision := old.revision + 1;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger body_measurements_revision before insert or update on public.body_measurements
for each row execute function public.stamp_progress_revision();
create trigger progress_photos_revision before insert or update on public.progress_photos
for each row execute function public.stamp_progress_revision();

alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;
revoke all on public.body_measurements, public.progress_photos from anon, authenticated;
grant select, insert, update, delete on public.body_measurements, public.progress_photos to authenticated;

create policy body_measurements_read on public.body_measurements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy body_measurements_insert on public.body_measurements
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy body_measurements_update on public.body_measurements
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy body_measurements_delete on public.body_measurements
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy progress_photos_read on public.progress_photos
  for select to authenticated using ((select auth.uid()) = user_id);
create policy progress_photos_insert on public.progress_photos
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy progress_photos_update on public.progress_photos
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy progress_photos_delete on public.progress_photos
  for delete to authenticated using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 8388608, array['image/jpeg']);

create function public.owns_progress_photo_path(path text) returns boolean
language sql stable set search_path = '' as $$
  select split_part(path, '/', 1) = (select auth.uid())::text
    and path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(original|miniatura)\.jpg$';
$$;
revoke all on function public.owns_progress_photo_path(text) from public;
grant execute on function public.owns_progress_photo_path(text) to authenticated;

-- Restrictive policies keep existing permissive rules for other buckets from opening this one.
create policy progress_storage_private on storage.objects as restrictive
  for all to authenticated
  using (bucket_id <> 'progress-photos' or public.owns_progress_photo_path(name))
  with check (bucket_id <> 'progress-photos' or public.owns_progress_photo_path(name));
create policy progress_storage_no_anon on storage.objects as restrictive
  for all to anon using (bucket_id <> 'progress-photos') with check (bucket_id <> 'progress-photos');
create policy progress_storage_read on storage.objects
  for select to authenticated using (bucket_id = 'progress-photos' and public.owns_progress_photo_path(name));
create policy progress_storage_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'progress-photos' and public.owns_progress_photo_path(name));
create policy progress_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'progress-photos' and public.owns_progress_photo_path(name))
  with check (bucket_id = 'progress-photos' and public.owns_progress_photo_path(name));
create policy progress_storage_delete on storage.objects
  for delete to authenticated using (bucket_id = 'progress-photos' and public.owns_progress_photo_path(name));

commit;
