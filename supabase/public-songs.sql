-- Independent song snapshots: older album publishers cannot remove these links.
create table public.nt_song_releases (
 id text primary key check(id ~ '^[a-zA-Z0-9-]{1,80}$'),
 data jsonb not null check(jsonb_typeof(data)='object' and data->'track'->>'id'=id),
 asset_paths text[] not null default '{}',
 updated_at timestamptz not null default now()
);
alter table public.nt_song_releases enable row level security;
grant select on public.nt_song_releases to anon,authenticated;
grant insert,update,delete on public.nt_song_releases to authenticated;
create policy nt_song_releases_read on public.nt_song_releases for select to anon,authenticated using(true);
create policy nt_song_releases_insert on public.nt_song_releases for insert to authenticated with check((select private.nt_is_member()));
create policy nt_song_releases_update on public.nt_song_releases for update to authenticated using((select private.nt_is_member())) with check((select private.nt_is_member()));
create policy nt_song_releases_delete on public.nt_song_releases for delete to authenticated using((select private.nt_is_member()));
