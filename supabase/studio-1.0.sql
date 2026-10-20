-- Studio 1.0: collaboration, private remote controls and protected listening rooms.
create table public.nt_workbench (
 record_kind text not null check(record_kind in('track','album')),
 record_id text not null check(record_id ~ '^[a-zA-Z0-9-]{1,80}$'),
 status text not null default 'idea' check(status in('idea','demo','working','approved','released')),
 version_group text not null default '' check(version_group='' or version_group ~ '^[a-zA-Z0-9-]{1,80}$'),
 version_label text not null default '' check(length(version_label)<=80),
 lyrics text not null default '' check(length(lyrics)<=120000),
 credits text not null default '' check(length(credits)<=4000),
 notes text not null default '' check(length(notes)<=4000),
 revision uuid not null default gen_random_uuid(),
 updated_at timestamptz not null default now(),
 updated_alias text not null default (private.nt_actor()->>'alias') check(updated_alias in('Dex','Nix','Jax')),
 primary key(record_kind,record_id)
);
alter table public.nt_workbench enable row level security;
revoke all on public.nt_workbench from public,anon,authenticated;
grant select,delete on public.nt_workbench to authenticated;
grant insert(record_kind,record_id,status,version_group,version_label,lyrics,credits,notes) on public.nt_workbench to authenticated;
grant update(status,version_group,version_label,lyrics,credits,notes) on public.nt_workbench to authenticated;
create policy nt_workbench_members on public.nt_workbench for all to authenticated
 using((select private.nt_is_member())) with check((select private.nt_is_member()));
create function private.nt_workbench_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.revision=gen_random_uuid();new.updated_at=now();new.updated_alias=private.nt_actor()->>'alias';return new;end $$;
revoke all on function private.nt_workbench_revision() from public,anon,authenticated;
create trigger nt_workbench_revision before update on public.nt_workbench for each row execute function private.nt_workbench_revision();

create table public.nt_song_comments (
 id uuid primary key default gen_random_uuid(),
 track_id text not null check(track_id ~ '^[a-zA-Z0-9-]{1,80}$'),
 author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 author_alias text not null default (private.nt_actor()->>'alias') check(author_alias in('Dex','Nix','Jax')),
 position double precision not null check(position>=0 and position<=86400),
 origin_id uuid unique,origin_alias text check(origin_alias in('Dex','Nix','Jax')),origin_created_at timestamptz,
 body text not null check(length(btrim(body)) between 1 and 2000),
 resolved boolean not null default false,
 created_at timestamptz not null default now()
);
create index nt_song_comments_track on public.nt_song_comments(track_id,created_at);
create index nt_song_comments_author on public.nt_song_comments(author_id);
alter table public.nt_song_comments enable row level security;
revoke all on public.nt_song_comments from public,anon,authenticated;
grant select,delete on public.nt_song_comments to authenticated;
grant insert(track_id,position,body,origin_id,origin_alias,origin_created_at) on public.nt_song_comments to authenticated;
grant update(resolved) on public.nt_song_comments to authenticated;
create policy nt_comments_read on public.nt_song_comments for select to authenticated using((select private.nt_is_member()));
create policy nt_comments_create on public.nt_song_comments for insert to authenticated with check((select private.nt_is_member()) and author_id=(select auth.uid()) and author_alias=(select private.nt_actor()->>'alias'));
create policy nt_comments_resolve on public.nt_song_comments for update to authenticated using((select private.nt_is_member())) with check((select private.nt_is_member()));
create policy nt_comments_remove on public.nt_song_comments for delete to authenticated using((select private.nt_is_member()) and author_id=(select auth.uid()));

create table public.nt_remote_devices (
 id uuid primary key,
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 label text not null check(length(btrim(label)) between 1 and 60),
 state jsonb not null check(jsonb_typeof(state)='object' and octet_length(state::text)<=131072),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null check(expires_at<=now()+interval '2 minutes')
);
create index nt_remote_devices_owner on public.nt_remote_devices(owner_id);
alter table public.nt_remote_devices enable row level security;
revoke all on public.nt_remote_devices from public,anon,authenticated;
grant select,insert,update,delete on public.nt_remote_devices to authenticated;
create policy nt_remote_devices_owner on public.nt_remote_devices for all to authenticated
 using(owner_id=(select auth.uid()) and (select private.nt_is_member()))
 with check(owner_id=(select auth.uid()) and (select private.nt_is_member()));

create table public.nt_remote_commands (
 id uuid primary key default gen_random_uuid(),
 device_id uuid not null references public.nt_remote_devices(id) on delete cascade,
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 command text not null check(command in('toggle','pause','resume','previous','next','seek','volume','queue-play','queue-move','listen-stop')),
 payload jsonb not null default '{}' check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=2048),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '20 seconds' check(expires_at<=now()+interval '30 seconds'),
 acknowledged_at timestamptz
);
create index nt_remote_commands_device on public.nt_remote_commands(device_id,created_at);
create index nt_remote_commands_owner on public.nt_remote_commands(owner_id);
alter table public.nt_remote_commands enable row level security;
revoke all on public.nt_remote_commands from public,anon,authenticated;
grant select,delete on public.nt_remote_commands to authenticated;
grant insert(device_id,command,payload) on public.nt_remote_commands to authenticated;
grant update(acknowledged_at) on public.nt_remote_commands to authenticated;
create policy nt_remote_commands_read on public.nt_remote_commands for select to authenticated using(owner_id=(select auth.uid()) and (select private.nt_is_member()));
create policy nt_remote_commands_create on public.nt_remote_commands for insert to authenticated with check(owner_id=(select auth.uid()) and (select private.nt_is_member()) and exists(select 1 from public.nt_remote_devices d where d.id=device_id and d.owner_id=(select auth.uid()) and d.expires_at>now()));
create policy nt_remote_commands_ack on public.nt_remote_commands for update to authenticated using(owner_id=(select auth.uid()) and (select private.nt_is_member())) with check(owner_id=(select auth.uid()) and (select private.nt_is_member()));
create policy nt_remote_commands_delete on public.nt_remote_commands for delete to authenticated using(owner_id=(select auth.uid()) and (select private.nt_is_member()));

create table public.nt_listen_preferences (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 mode text not null check(mode in('link','code','invite')),
 code_hash text not null default '', code_salt text not null default '',
 invited_discord_ids text[] not null default '{}', revision uuid not null default gen_random_uuid(),
 check(cardinality(invited_discord_ids)<=50),
 check(mode<>'code' or (code_hash ~ '^[a-f0-9]{64}$' and code_salt ~ '^[a-f0-9]{32}$'))
);
alter table public.nt_listen_preferences enable row level security;
revoke all on public.nt_listen_preferences from public,anon,authenticated;

create table public.nt_room_settings (
 room_id text primary key references public.nt_rooms(id) on delete cascade,
 mode text not null default 'link' check(mode in('link','code','invite')),
 code_hash text not null default '' check(code_hash='' or code_hash ~ '^[a-f0-9]{64}$'),
 code_salt text not null default '' check(code_salt='' or code_salt ~ '^[a-f0-9]{32}$'),
 invited_discord_ids text[] not null default '{}' check(cardinality(invited_discord_ids)<=50),
 revision uuid not null default gen_random_uuid(),
 check(mode<>'code' or code_hash<>'')
);
alter table public.nt_room_settings enable row level security;
revoke all on public.nt_room_settings from public,anon,authenticated;
grant select on public.nt_room_settings to authenticated;
create policy nt_room_settings_host on public.nt_room_settings for select to authenticated using(exists(select 1 from public.nt_rooms r where r.id=room_id and r.host_id=(select auth.uid()) and (select private.nt_is_member())));

create table public.nt_room_grants (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
 room_id text not null references public.nt_rooms(id) on delete cascade,
 revision uuid not null,
 expires_at timestamptz not null
);
create index nt_room_grants_room on public.nt_room_grants(room_id);
create index nt_room_grants_expiry on public.nt_room_grants(expires_at);
alter table public.nt_room_grants enable row level security;
revoke all on public.nt_room_grants from public,anon,authenticated;

create table public.nt_room_guests (
 id uuid primary key default gen_random_uuid(),
 room_id text not null references public.nt_rooms(id) on delete cascade,
 token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'),
 listening boolean not null default false,
 display_name text not null default 'Gast' check(length(btrim(display_name)) between 1 and 60),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null
);
create index nt_room_guests_room on public.nt_room_guests(room_id,expires_at);
alter table public.nt_room_guests enable row level security;
revoke all on public.nt_room_guests from public,anon,authenticated;

create table public.nt_room_requests (
 id uuid primary key default gen_random_uuid(),
 room_id text not null references public.nt_rooms(id) on delete cascade,
 guest_id uuid not null references public.nt_room_guests(id) on delete cascade,
 track_id text not null check(track_id ~ '^[a-zA-Z0-9-]{1,80}$'),
 status text not null default 'pending' check(status in('pending','approved','declined')),
 created_at timestamptz not null default now()
);
create index nt_room_requests_room on public.nt_room_requests(room_id,status,created_at);
create index nt_room_requests_guest on public.nt_room_requests(guest_id);
alter table public.nt_room_requests enable row level security;
revoke all on public.nt_room_requests from public,anon,authenticated;


alter table public.nt_profiles
 add column header_path text not null default '' check(header_path='' or header_path ~ ('^'||alias||'/[a-f0-9-]{36}\.(png|jpg|webp)$')),
 add column pinned_release_ids text[] not null default '{}' check(cardinality(pinned_release_ids)<=6),
 add column news text not null default '' check(length(news)<=1200);
grant update(header_path,pinned_release_ids,news) on public.nt_profiles to authenticated;
create function private.nt_profile_extras() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from unnest(new.pinned_release_ids) as pin where not exists(select 1 from public.nt_releases r where r.id=pin)) then raise exception 'Only published albums can be pinned';end if;
 if new.header_path is distinct from old.header_path or new.pinned_release_ids is distinct from old.pinned_release_ids or new.news is distinct from old.news then new.updated_at=now();end if;
 return new;
end $$;
revoke all on function private.nt_profile_extras() from public,anon,authenticated;
create trigger nt_profile_extras before update on public.nt_profiles for each row execute function private.nt_profile_extras();
