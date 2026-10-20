-- Private originals stay on-device. Only the playing MP3 is staged for a live room.
create table public.nt_listen_assets (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 track_id text not null check(track_id ~ '^[a-zA-Z0-9-]{1,80}$'),
 title text not null check(length(btrim(title)) between 1 and 160),
 artist text not null check(length(btrim(artist)) between 1 and 160),
 duration double precision not null check(duration>0 and duration<=86400),
 byte_size bigint not null check(byte_size between 1 and 50331648),
 path text generated always as(owner_id::text||'/'||id::text||'.mp3') stored,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '15 minutes'
);
create index nt_listen_assets_owner on public.nt_listen_assets(owner_id);
create index nt_listen_assets_expiry on public.nt_listen_assets(expires_at);
alter table public.nt_listen_assets enable row level security;
revoke all on public.nt_listen_assets from public,anon,authenticated;
grant select,delete on public.nt_listen_assets to authenticated;
grant insert(track_id,title,artist,duration,byte_size) on public.nt_listen_assets to authenticated;
create policy nt_listen_assets_owner on public.nt_listen_assets for all to authenticated
 using(owner_id=(select auth.uid()) and (select private.nt_is_member()))
 with check(owner_id=(select auth.uid()) and (select private.nt_is_member()));

alter table public.nt_rooms add column local_asset_id uuid references public.nt_listen_assets(id) on delete cascade;
create index nt_rooms_local_asset on public.nt_rooms(local_asset_id) where local_asset_id is not null;
drop policy nt_rooms_insert on public.nt_rooms;
drop policy nt_rooms_update on public.nt_rooms;
create policy nt_rooms_insert on public.nt_rooms for insert to authenticated with check(
 (select private.nt_is_member()) and host_id=(select auth.uid()) and host_alias=(select private.nt_actor()->>'alias')
 and (local_asset_id is null or exists(select 1 from public.nt_listen_assets a
 where a.id=local_asset_id and a.owner_id=(select auth.uid()) and a.track_id=nt_rooms.track_id and a.expires_at>now())));
create policy nt_rooms_update on public.nt_rooms for update to authenticated
 using((select private.nt_is_member()) and host_id=(select auth.uid()))
 with check((select private.nt_is_member()) and host_id=(select auth.uid()) and host_alias=(select private.nt_actor()->>'alias')
 and (local_asset_id is null or exists(select 1 from public.nt_listen_assets a
 where a.id=local_asset_id and a.owner_id=(select auth.uid()) and a.track_id=nt_rooms.track_id and a.expires_at>now())));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('nt-listen','nt-listen',false,50331648,array['audio/mpeg']);
create policy nt_listen_objects_owner_read on storage.objects for select to authenticated
 using(bucket_id='nt-listen' and (select private.nt_is_member()) and exists(
 select 1 from public.nt_listen_assets a where a.path=name and a.owner_id=(select auth.uid()) and a.expires_at>now()));
create policy nt_listen_objects_owner_insert on storage.objects for insert to authenticated
 with check(bucket_id='nt-listen' and (select private.nt_is_member()) and exists(
 select 1 from public.nt_listen_assets a where a.path=name and a.owner_id=(select auth.uid()) and a.expires_at>now()));
create policy nt_listen_objects_owner_delete on storage.objects for delete to authenticated
 using(bucket_id='nt-listen' and (select private.nt_is_member()) and exists(
 select 1 from public.nt_listen_assets a where a.path=name and a.owner_id=(select auth.uid())));
