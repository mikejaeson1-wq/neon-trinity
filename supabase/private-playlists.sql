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
