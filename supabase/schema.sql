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
