create table public.nt_tv_pairs (
 id uuid primary key default gen_random_uuid(), device_hash text not null check(device_hash ~ '^[a-f0-9]{64}$'),
 approval_hash text not null check(approval_hash ~ '^[a-f0-9]{64}$'), owner_id uuid references auth.users(id) on delete cascade,
 owner_alias text, expires_at timestamptz not null default now()+interval '5 minutes', created_at timestamptz not null default now()
);
create index nt_tv_pairs_expires on public.nt_tv_pairs(expires_at);
create index nt_tv_pairs_owner on public.nt_tv_pairs(owner_id);
alter table public.nt_tv_pairs enable row level security;
revoke all on public.nt_tv_pairs from public,anon,authenticated;
grant all on public.nt_tv_pairs to service_role;
create policy nt_tv_no_direct_client_access on public.nt_tv_pairs for all to authenticated using(false) with check(false);
create function private.nt_tv_member(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.identities i join private.nt_allowed_discord a on a.discord_id=i.provider_id where i.user_id=target and i.provider='discord' and a.enabled)
$$;
revoke all on function private.nt_tv_member(uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.nt_tv_member(uuid) to service_role;
create function public.nt_tv_member(target uuid) returns boolean language sql stable security invoker set search_path='' as $$select private.nt_tv_member(target)$$;
revoke all on function public.nt_tv_member(uuid) from public,anon,authenticated;
grant execute on function public.nt_tv_member(uuid) to service_role;
