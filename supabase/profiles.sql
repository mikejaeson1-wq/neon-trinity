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
