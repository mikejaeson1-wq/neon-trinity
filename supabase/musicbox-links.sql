-- Explicitly shared, immutable MP3 snapshots for external music boxes.
-- The original band bucket, private local music and Spotify stay separate.
create table public.nt_musicbox_links (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('track','album')),
 record_id text not null check(record_id ~ '^[a-zA-Z0-9-]{1,80}$'),
 source_key text not null check(source_key ~ '^[a-f0-9]{64}$'),
 track_count integer not null check(track_count between 1 and 500),
 byte_size bigint not null default 0 check(byte_size between 0 and 50331648),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 unique(kind,record_id,source_key)
);
create index nt_musicbox_links_created_by on public.nt_musicbox_links(created_by);
alter table public.nt_musicbox_links enable row level security;
revoke all on public.nt_musicbox_links from public,anon,authenticated;
grant select,delete on public.nt_musicbox_links to authenticated;
grant insert(kind,record_id,source_key,track_count) on public.nt_musicbox_links to authenticated;
grant update(byte_size) on public.nt_musicbox_links to authenticated;
create policy nt_musicbox_read on public.nt_musicbox_links for select to authenticated
 using((select private.nt_is_member()));
create policy nt_musicbox_create on public.nt_musicbox_links for insert to authenticated
 with check((select private.nt_is_member()) and created_by=(select auth.uid()) and exists(
 select 1 from public.nt_catalog c, jsonb_array_elements(c.data->case nt_musicbox_links.kind when 'track' then 'tracks' else 'albums' end) as entry
 where c.id=1 and entry->>'id'=nt_musicbox_links.record_id));
create policy nt_musicbox_complete on public.nt_musicbox_links for update to authenticated
 using((select private.nt_is_member())) with check((select private.nt_is_member()));
create policy nt_musicbox_remove on public.nt_musicbox_links for delete to authenticated
 using((select private.nt_is_member()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('nt-musicbox','nt-musicbox',true,50331648,array['audio/mpeg']);
create policy nt_musicbox_objects_read on storage.objects for select to authenticated
 using(bucket_id='nt-musicbox' and (select private.nt_is_member()));
create policy nt_musicbox_objects_insert on storage.objects for insert to authenticated
 with check(bucket_id='nt-musicbox' and (select private.nt_is_member())
 and exists(select 1 from public.nt_musicbox_links l where name='audio/'||l.id::text||'.mp3'));
create policy nt_musicbox_objects_delete on storage.objects for delete to authenticated
 using(bucket_id='nt-musicbox' and (select private.nt_is_member()));
