-- Additive 1.2 update. Existing media, catalog and profiles remain untouched.
create table public.nt_personal_songs (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 source_id text not null check(source_id ~ '^[a-zA-Z0-9-]{1,80}$'),
 title text not null check(length(title) between 1 and 160), artist text not null check(length(artist)<=120),
 duration double precision not null check(duration>0 and duration<86400), size bigint not null check(size between 1 and 50331648),
 sha text not null check(sha ~ '^[a-f0-9]{64}$'), created_at timestamptz not null default now(),
 unique(owner_id,source_id)
);
create table public.nt_song_grants (
 id uuid primary key default gen_random_uuid(), song_id uuid not null references public.nt_personal_songs(id) on delete cascade,
 recipient_id uuid not null references auth.users(id), allow_download boolean not null default false,
 expires_at timestamptz, created_at timestamptz not null default now(), unique(song_id,recipient_id)
);
create index nt_song_grants_recipient on public.nt_song_grants(recipient_id,song_id);
create index nt_personal_songs_owner on public.nt_personal_songs(owner_id);
create table public.nt_share_feedback (
 id uuid primary key default gen_random_uuid(), grant_id uuid not null references public.nt_song_grants(id) on delete cascade,
 author_id uuid not null default auth.uid() references auth.users(id), body text not null check(length(btrim(body)) between 1 and 2000),
 position double precision not null default 0 check(position between 0 and 86400),
 kind text not null default 'comment' check(kind in ('comment','reaction')), created_at timestamptz not null default now()
);
create index nt_share_feedback_grant on public.nt_share_feedback(grant_id,created_at);
create index nt_share_feedback_author on public.nt_share_feedback(author_id);
alter table public.nt_personal_songs enable row level security;
alter table public.nt_song_grants enable row level security;
alter table public.nt_share_feedback enable row level security;
revoke all on public.nt_personal_songs,public.nt_song_grants,public.nt_share_feedback from public,anon,authenticated;
grant select,insert,delete on public.nt_personal_songs,public.nt_song_grants,public.nt_share_feedback to authenticated;
grant update(title,artist) on public.nt_personal_songs to authenticated;
grant update(allow_download,expires_at) on public.nt_song_grants to authenticated;
-- Definer lookups are private and always bind the requesting account. They avoid
-- recursive policies between a song and its grants without granting global access.
create function private.nt_song_access(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (select private.nt_is_member()) and exists(select 1 from public.nt_personal_songs s where s.id=target and
 (s.owner_id=(select auth.uid()) or exists(select 1 from public.nt_song_grants g where g.song_id=s.id and g.recipient_id=(select auth.uid()) and (g.expires_at is null or g.expires_at>now()))))
$$;
create function private.nt_grant_access(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (select private.nt_is_member()) and exists(select 1 from public.nt_song_grants g join public.nt_personal_songs s on s.id=g.song_id where g.id=target and
 (s.owner_id=(select auth.uid()) or g.recipient_id=(select auth.uid()) and (g.expires_at is null or g.expires_at>now())))
$$;
create function private.nt_share_members() returns table(id uuid,alias text) language sql stable security definer set search_path='' as $$
 select i.user_id,a.alias from auth.identities i join private.nt_allowed_discord a on a.discord_id=i.provider_id
 where (select private.nt_is_member()) and i.provider='discord' and a.enabled
$$;
revoke all on function private.nt_song_access(uuid),private.nt_grant_access(uuid),private.nt_share_members() from public,anon;
grant execute on function private.nt_song_access(uuid),private.nt_grant_access(uuid),private.nt_share_members() to authenticated;
create function public.nt_share_members() returns table(id uuid,alias text) language sql stable security invoker set search_path='' as $$ select * from private.nt_share_members() $$;
revoke all on function public.nt_share_members() from public,anon;
grant execute on function public.nt_share_members() to authenticated;
create policy nt_personal_read on public.nt_personal_songs for select to authenticated using(private.nt_song_access(id));
create policy nt_personal_insert on public.nt_personal_songs for insert to authenticated with check(owner_id=(select auth.uid()) and (select private.nt_is_member()));
create policy nt_personal_update on public.nt_personal_songs for update to authenticated using(owner_id=(select auth.uid()) and (select private.nt_is_member())) with check(owner_id=(select auth.uid()) and (select private.nt_is_member()));
create policy nt_personal_delete on public.nt_personal_songs for delete to authenticated using(owner_id=(select auth.uid()) and (select private.nt_is_member()));
create policy nt_grant_read on public.nt_song_grants for select to authenticated using(private.nt_grant_access(id));
create policy nt_grant_insert on public.nt_song_grants for insert to authenticated with check(
 (select private.nt_is_member()) and recipient_id<>(select auth.uid()) and exists(select 1 from private.nt_share_members() m where m.id=recipient_id) and
 exists(select 1 from public.nt_personal_songs s where s.id=song_id and s.owner_id=(select auth.uid())));
create policy nt_grant_update on public.nt_song_grants for update to authenticated using(
 (select private.nt_is_member()) and exists(select 1 from public.nt_personal_songs s where s.id=song_id and s.owner_id=(select auth.uid()))) with check(
 (select private.nt_is_member()) and exists(select 1 from public.nt_personal_songs s where s.id=song_id and s.owner_id=(select auth.uid())));
create policy nt_grant_delete on public.nt_song_grants for delete to authenticated using(
 (select private.nt_is_member()) and exists(select 1 from public.nt_personal_songs s where s.id=song_id and s.owner_id=(select auth.uid())));
create policy nt_feedback_read on public.nt_share_feedback for select to authenticated using(private.nt_grant_access(grant_id));
create policy nt_feedback_insert on public.nt_share_feedback for insert to authenticated with check(author_id=(select auth.uid()) and private.nt_grant_access(grant_id));
create policy nt_feedback_delete on public.nt_share_feedback for delete to authenticated using(author_id=(select auth.uid()) and private.nt_grant_access(grant_id));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('nt-personal-shares','nt-personal-shares',false,50331648,array['audio/mpeg']) on conflict(id) do nothing;
create policy nt_personal_audio_read on storage.objects for select to authenticated using(bucket_id='nt-personal-shares' and exists(
 select 1 from public.nt_personal_songs s where name=s.owner_id::text||'/'||s.id::text||'.mp3' and private.nt_song_access(s.id)));
create policy nt_personal_audio_insert on storage.objects for insert to authenticated with check(bucket_id='nt-personal-shares' and exists(
 select 1 from public.nt_personal_songs s where name=s.owner_id::text||'/'||s.id::text||'.mp3' and s.owner_id=(select auth.uid()) and (select private.nt_is_member())));
create policy nt_personal_audio_delete on storage.objects for delete to authenticated using(bucket_id='nt-personal-shares' and exists(
 select 1 from public.nt_personal_songs s where name=s.owner_id::text||'/'||s.id::text||'.mp3' and s.owner_id=(select auth.uid()) and (select private.nt_is_member())));
