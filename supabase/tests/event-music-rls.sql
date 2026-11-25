-- Run against the Studio project after the migration. All fixture writes roll back.
begin;
do $test$
declare member_id uuid; fixture_id text:='event-music-check-'||gen_random_uuid()::text;
begin
 select i.user_id into member_id from auth.identities i join private.nt_allowed_discord a on a.discord_id=i.provider_id
 where i.provider='discord' and a.enabled limit 1;
 if member_id is null then raise exception 'No enabled Studio member available for the policy check';end if;
 update public.nt_catalog set data=jsonb_set(data,'{eventTracks}',coalesce(data->'eventTracks','[]'::jsonb)||jsonb_build_array(jsonb_build_object('id',fixture_id,'title','Transactional policy fixture','blobId',fixture_id||'-audio','duration',1,'visibility','event')))
 where id=1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 insert into public.nt_musicbox_links(kind,record_id,source_key,track_count) values('event-track',fixture_id,repeat('e',64),1);
 begin
  insert into public.nt_musicbox_links(kind,record_id,source_key,track_count) values('track',fixture_id,repeat('b',64),1);
  raise exception 'An event record was accepted as a band song';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.nt_musicbox_links(kind,record_id,source_key,track_count) values('event-track',fixture_id||'-missing',repeat('a',64),1);
  raise exception 'An event record absent from the catalog was accepted';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 begin
  insert into public.nt_musicbox_links(kind,record_id,source_key,track_count) values('event-track',fixture_id,repeat('c',64),1);
  raise exception 'A nonmember created an event link';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
end $test$;
rollback;
select 'Event link: member allowed, band mismatch/missing source/nonmember blocked; fixtures rolled back' as result;
