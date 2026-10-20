-- Neon Trinity 0.3: dedicated project, Discord identities, private shared media.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table private.nt_allowed_discord (
 discord_id text primary key check(discord_id ~ '^[0-9]{16,22}$'),
 alias text not null unique check(alias in ('Dex','Nix','Jax')),
 enabled boolean not null default true
);
alter table private.nt_allowed_discord enable row level security;
revoke all on private.nt_allowed_discord from public,anon,authenticated;
create policy nt_allowlist_no_client_access on private.nt_allowed_discord for all to authenticated using(false) with check(false);

create function private.nt_actor() returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare uid uuid := (select auth.uid()); did text; band_alias text;
begin
 if uid is null then return null; end if;
 select i.provider_id into did from auth.identities i
 where i.user_id=uid and i.provider='discord' limit 1;
 if did is not null then
  select a.alias into band_alias from private.nt_allowed_discord a
  where a.discord_id=did and a.enabled;
 end if;
 return jsonb_build_object('id',uid,'discordId',did,'alias',band_alias,
  'allowed',band_alias is not null,'role',case when band_alias='Dex' then 'admin' else 'member' end);
end $$;
revoke all on function private.nt_actor() from public,anon;
grant execute on function private.nt_actor() to authenticated;

create function private.nt_is_member() returns boolean
language sql stable security invoker set search_path=''
as $$ select coalesce((private.nt_actor()->>'allowed')::boolean,false) $$;
revoke all on function private.nt_is_member() from public,anon;
grant execute on function private.nt_is_member() to authenticated;

create function public.nt_identity() returns jsonb
language sql stable security invoker set search_path=''
as $$ select private.nt_actor() $$;
revoke all on function public.nt_identity() from public,anon;
grant execute on function public.nt_identity() to authenticated;

create table public.nt_catalog (
 id integer primary key check(id=1), revision bigint not null default 0,
 data jsonb not null check(jsonb_typeof(data)='object' and data->>'schema'='2'),
 updated_at timestamptz not null default now()
);
insert into public.nt_catalog(id,data) values(1,'{"schema":2,"tracks":[],"albums":[],"playlists":[],"events":[],"assets":[],"publications":[]}');
alter table public.nt_catalog enable row level security;
grant select,update on public.nt_catalog to authenticated;
revoke all on public.nt_catalog from anon;
create policy nt_catalog_read on public.nt_catalog for select to authenticated using((select private.nt_is_member()));
create policy nt_catalog_update on public.nt_catalog for update to authenticated using((select private.nt_is_member())) with check((select private.nt_is_member()) and id=1);
create function private.nt_revision() returns trigger
language plpgsql security invoker set search_path='' as $$
begin new.revision=old.revision+1;new.updated_at=now();return new;end $$;
revoke all on function private.nt_revision() from public,anon,authenticated;
create trigger nt_revision before update on public.nt_catalog for each row execute function private.nt_revision();

create table public.nt_config (
 id integer primary key check(id=1), public_base text not null default 'https://mikejaeson1-wq.github.io/neon-trinity' check(public_base ~ '^https://[^[:space:]]+$'), discord_client_id text not null default '' check(discord_client_id='' or discord_client_id ~ '^[0-9]{16,22}$')
);
insert into public.nt_config(id) values(1);
alter table public.nt_config enable row level security;
grant select on public.nt_config to anon,authenticated;
grant update on public.nt_config to authenticated;
create policy nt_config_read on public.nt_config for select to anon,authenticated using(true);
create policy nt_config_admin on public.nt_config for update to authenticated using((select private.nt_actor()->>'alias')='Dex') with check((select private.nt_actor()->>'alias')='Dex');

create table public.nt_releases (
 id text primary key check(id ~ '^[a-zA-Z0-9-]{1,80}$'),
 data jsonb not null check(jsonb_typeof(data)='object'),
 asset_paths text[] not null default '{}', updated_at timestamptz not null default now()
);
alter table public.nt_releases enable row level security;
grant select on public.nt_releases to anon,authenticated;
grant insert,update,delete on public.nt_releases to authenticated;
create policy nt_releases_read on public.nt_releases for select to anon,authenticated using(true);
create policy nt_releases_insert on public.nt_releases for insert to authenticated with check((select private.nt_is_member()));
create policy nt_releases_update on public.nt_releases for update to authenticated using((select private.nt_is_member())) with check((select private.nt_is_member()));
create policy nt_releases_delete on public.nt_releases for delete to authenticated using((select private.nt_is_member()));

create table public.nt_rooms (
 id text primary key check(id ~ '^[a-f0-9]{64}$'),
 host_id uuid not null references auth.users(id) on delete cascade,
 host_alias text not null check(host_alias in ('Dex','Nix','Jax')),
 track_id text not null, position double precision not null default 0 check(position>=0 and position<=86400),
 playing boolean not null default false,
 updated_at timestamptz not null default now(), expires_at timestamptz not null
);
create index nt_rooms_host on public.nt_rooms(host_id);
create index nt_rooms_expiry on public.nt_rooms(expires_at);
alter table public.nt_rooms enable row level security;
revoke all on public.nt_rooms from anon;
grant select,insert,update,delete on public.nt_rooms to authenticated;
create policy nt_rooms_read on public.nt_rooms for select to authenticated using((select private.nt_is_member()));
create policy nt_rooms_insert on public.nt_rooms for insert to authenticated with check((select private.nt_is_member()) and host_id=(select auth.uid()) and host_alias=(select private.nt_actor()->>'alias'));
create policy nt_rooms_update on public.nt_rooms for update to authenticated using((select private.nt_is_member()) and host_id=(select auth.uid())) with check((select private.nt_is_member()) and host_id=(select auth.uid()) and host_alias=(select private.nt_actor()->>'alias'));
create policy nt_rooms_delete on public.nt_rooms for delete to authenticated using((select private.nt_is_member()) and host_id=(select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('nt-media','nt-media',false,50331648,array['audio/mpeg','image/png','image/jpeg','image/webp']);
create policy nt_media_members_read on storage.objects for select to authenticated using(bucket_id='nt-media' and (select private.nt_is_member()));
create policy nt_media_members_insert on storage.objects for insert to authenticated with check(bucket_id='nt-media' and (select private.nt_is_member()) and name ~ '^media/[a-zA-Z0-9-]{1,80}\.(mp3|png|jpg|webp)$');
create policy nt_media_members_update on storage.objects for update to authenticated using(bucket_id='nt-media' and (select private.nt_is_member())) with check(bucket_id='nt-media' and (select private.nt_is_member()));
create policy nt_media_members_delete on storage.objects for delete to authenticated using(bucket_id='nt-media' and (select private.nt_is_member()));
create policy nt_media_published on storage.objects for select to anon using(bucket_id='nt-media' and exists(select 1 from public.nt_releases r where name=any(r.asset_paths)));

alter publication supabase_realtime add table public.nt_catalog;
alter publication supabase_realtime add table public.nt_rooms;

-- Personal playlists (0.4.0)
create table public.nt_private_playlists (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (id ~ '^[a-zA-Z0-9-]{1,80}$'),
  data jsonb not null check (
    jsonb_typeof(data) = 'object'
    and data ?& array['title','trackIds']
    and jsonb_typeof(data->'title') = 'string'
    and length(btrim(data->>'title')) between 1 and 160
    and jsonb_typeof(data->'trackIds') = 'array'
    and jsonb_array_length(data->'trackIds') <= 2000
    and octet_length(data::text) <= 262144
  ),
  revision uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now(),
  primary key (owner_id,id)
);
alter table public.nt_private_playlists enable row level security;
revoke all on public.nt_private_playlists from public,anon,authenticated;
grant select,insert,update,delete on public.nt_private_playlists to authenticated;
create policy nt_private_playlists_owner on public.nt_private_playlists
  for all to authenticated
  using (owner_id = (select auth.uid()) and (select private.nt_is_member()))
  with check (owner_id = (select auth.uid()) and (select private.nt_is_member()));

-- Public OAuth client identifier only; user tokens remain encrypted on each PC.
alter table public.nt_config add column spotify_client_id text not null default '' check (spotify_client_id = '' or spotify_client_id ~ '^[a-fA-F0-9]{32}$');

-- Public artist profiles and account-bound reactions. Shared media stays private.
create table public.nt_profiles (
 alias text primary key check(alias in ('Dex','Nix','Jax')),
 display_name text not null check(length(btrim(display_name)) between 1 and 60),
 bio text not null default '' check(length(bio)<=1200),
 accent_color text not null default '#a2f972' check(accent_color ~ '^#[a-fA-F0-9]{6}$'),
 avatar_path text not null default '' check(avatar_path='' or avatar_path ~ ('^'||alias||'/[a-f0-9-]{36}\.(png|jpg|webp)$')),
 follower_count bigint not null default 0 check(follower_count>=0),
 like_count bigint not null default 0 check(like_count>=0),
 updated_at timestamptz not null default now()
);
insert into public.nt_profiles(alias,display_name,accent_color) values ('Dex','Dex','#a2f972'),('Nix','Nix','#c777ff'),('Jax','Jax','#68d8ff');
alter table public.nt_profiles enable row level security;
revoke all on public.nt_profiles from public,anon,authenticated;
grant select on public.nt_profiles to anon,authenticated;
grant update(display_name,bio,avatar_path,accent_color) on public.nt_profiles to authenticated;
create policy nt_profiles_read on public.nt_profiles for select to anon,authenticated using(true);
create policy nt_profiles_edit_own on public.nt_profiles for update to authenticated
 using(alias=(select private.nt_actor()->>'alias'))
 with check(alias=(select private.nt_actor()->>'alias'));

create table public.nt_profile_reactions (
 alias text not null references public.nt_profiles(alias) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check(kind in ('follow','like')),
 created_at timestamptz not null default now(),
 primary key(alias,user_id,kind)
);
create index nt_profile_reactions_user on public.nt_profile_reactions(user_id);
alter table public.nt_profile_reactions enable row level security;
revoke all on public.nt_profile_reactions from public,anon,authenticated;
grant select,delete on public.nt_profile_reactions to authenticated;
grant insert(alias,user_id,kind) on public.nt_profile_reactions to authenticated;
create policy nt_reactions_read_own on public.nt_profile_reactions for select to authenticated
 using(user_id=(select auth.uid()) and (select private.nt_actor()->>'discordId') is not null);
create policy nt_reactions_create_own on public.nt_profile_reactions for insert to authenticated
 with check(user_id=(select auth.uid()) and (select private.nt_actor()->>'discordId') is not null);
create policy nt_reactions_delete_own on public.nt_profile_reactions for delete to authenticated
 using(user_id=(select auth.uid()) and (select private.nt_actor()->>'discordId') is not null);

-- Counts cannot be changed through client column grants. Trigger executes only
-- on a successful, RLS-checked reaction and is not callable through the Data API.
create function private.nt_profile_count() returns trigger language plpgsql
 security definer set search_path='' as $$
declare target text; reaction text; delta integer; actor uuid := (select auth.uid());
begin
 if actor is not null and actor is distinct from (case when tg_op='INSERT' then new.user_id else old.user_id end) then raise exception 'Wrong reaction owner' using errcode='42501';end if;
 if tg_op='INSERT' then target=new.alias;reaction=new.kind;delta=1;
 else target=old.alias;reaction=old.kind;delta=-1;end if;
 update public.nt_profiles set
 follower_count=greatest(0,follower_count+case when reaction='follow' then delta else 0 end),
 like_count=greatest(0,like_count+case when reaction='like' then delta else 0 end)
 where alias=target;
 return null;
end $$;
revoke all on function private.nt_profile_count() from public,anon,authenticated;
create trigger nt_profile_count after insert or delete on public.nt_profile_reactions
 for each row execute function private.nt_profile_count();
create function private.nt_profile_timestamp() returns trigger language plpgsql
 security invoker set search_path='' as $$
begin if new.display_name is distinct from old.display_name or new.bio is distinct from old.bio or new.avatar_path is distinct from old.avatar_path or new.accent_color is distinct from old.accent_color then new.updated_at=now();end if;return new;end $$;
revoke all on function private.nt_profile_timestamp() from public,anon,authenticated;
create trigger nt_profile_timestamp before update on public.nt_profiles for each row execute function private.nt_profile_timestamp();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('nt-profiles','nt-profiles',true,2097152,array['image/png','image/jpeg','image/webp']);
create policy nt_profile_images_read_own on storage.objects for select to authenticated
 using(bucket_id='nt-profiles' and split_part(name,'/',1)=(select private.nt_actor()->>'alias'));
create policy nt_profile_images_insert_own on storage.objects for insert to authenticated
 with check(bucket_id='nt-profiles' and split_part(name,'/',1)=(select private.nt_actor()->>'alias') and name ~ '^(Dex|Nix|Jax)/[a-f0-9-]{36}\.(png|jpg|webp)$');
create policy nt_profile_images_delete_own on storage.objects for delete to authenticated
 using(bucket_id='nt-profiles' and split_part(name,'/',1)=(select private.nt_actor()->>'alias'));

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
