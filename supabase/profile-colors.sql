alter table public.nt_profiles add column accent_color text not null default '#a2f972'
 check(accent_color ~ '^#[a-fA-F0-9]{6}$');
update public.nt_profiles set accent_color=case alias when 'Nix' then '#c777ff' when 'Jax' then '#68d8ff' else '#a2f972' end;
grant update(accent_color) on public.nt_profiles to authenticated;
create or replace function private.nt_profile_timestamp() returns trigger language plpgsql
 security invoker set search_path='' as $$
begin
 if new.display_name is distinct from old.display_name or new.bio is distinct from old.bio
 or new.avatar_path is distinct from old.avatar_path or new.accent_color is distinct from old.accent_color
 then new.updated_at=now();end if;return new;
end $$;
revoke all on function private.nt_profile_timestamp() from public,anon,authenticated;
