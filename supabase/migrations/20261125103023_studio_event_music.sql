-- Add Event Music as a distinct source. Existing band links and permissions stay valid.
alter table public.nt_musicbox_links
 drop constraint nt_musicbox_links_kind_check,
 add constraint nt_musicbox_links_kind_check check(kind in ('track','album','event-track'));

alter policy nt_musicbox_create on public.nt_musicbox_links
 with check((select private.nt_is_member()) and created_by=(select auth.uid()) and exists(
 select 1 from public.nt_catalog c,
 jsonb_array_elements(coalesce(c.data->case nt_musicbox_links.kind
  when 'track' then 'tracks' when 'album' then 'albums' when 'event-track' then 'eventTracks' end,'[]'::jsonb)) as entry
 where c.id=1 and entry->>'id'=nt_musicbox_links.record_id));
