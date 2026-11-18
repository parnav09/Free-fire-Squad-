
alter table public.teams add column if not exists avatar_url text;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('team-avatars','team-avatars',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp'];

drop policy if exists "team avatar upload by authenticated" on storage.objects;
create policy "team avatar upload by authenticated" on storage.objects for insert to authenticated
with check (bucket_id='team-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "team avatar update by owner path" on storage.objects;
create policy "team avatar update by owner path" on storage.objects for update to authenticated
using (bucket_id='team-avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='team-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "team avatar public read" on storage.objects;
create policy "team avatar public read" on storage.objects for select to public using (bucket_id='team-avatars');
