-- Apply to projects created before Studio 0.5.0. No Spotify secrets are stored here.
alter table public.nt_config add column if not exists spotify_client_id text not null default '' check (spotify_client_id = '' or spotify_client_id ~ '^[a-fA-F0-9]{32}$');
