# Neon Trinity Studio 0.5.0 · Supabase Edition

Windows music studio for Dex, Nix and Jax. Shared songs, albums, artwork, playlists and performances live in the dedicated Supabase project. Authentication uses Discord OAuth with PKCE. Only three explicitly allowed Discord provider identities can access the band's data.

For normal use, open the Windows package and follow `SUPABASE-START.html`. Node.js, a CLI, and a separately hosted team server are not required by app users.

## Development

Node.js 22 or newer. Install dependencies with the committed lockfile (`pnpm install --frozen-lockfile`). Run `pnpm start`. The optional public website is static HTML/CSS/JS. `pnpm test` runs the unit and integration checks; `pnpm build:win` builds the portable Windows executable. `pnpm build:web` builds the web studio. The scripts bundle the pinned Supabase browser SDK locally.

## Data and access

`supabase/schema.sql` documents the project schema. Public tables have RLS policies. A private allowlist maps trusted `auth.identities.provider_id` values for the Discord provider to Dex, Nix and Jax. User-editable profile metadata does not grant access. The Windows session and PKCE verifier use Electron safeStorage. No privileged Supabase keys, Discord secrets or GitHub tokens belong in the source, frontend, backups, or album pages.

The catalog uses revision-based compare-and-swap and record-level conflict detection. MP3s and artwork are stored in a private Storage bucket. Explicitly published albums are separate snapshots. The `neon-public` Edge Function signs short-lived media URLs for published albums and live listening sessions. Public listening reads require the unguessable room capability; all session mutations additionally validate the Supabase user and band membership, and RLS enforces host ownership. Sessions expire without a host heartbeat.

The optional GitHub Pages publisher uploads only the static public player, with no MP3 copies. Public website hosting is a separate one-time setup; Discord sign-in and band synchronization work independently. The existing browser studio audience is preserved.

## Verification limits

Linux can build and inspect Windows app files but cannot prove the Windows runtime behavior, real Discord OAuth consent or Rich Presence. Those require the owner's configured Discord application and a Windows/Discord session. See the included setup guide for the exact callbacks and identity mapping.

## Windows-Installation und Updates

Nix und Jax laden den Installer über https://mikejaeson1-wq.github.io/neon-trinity/install.html herunter und melden sich im Studio mit Discord an. Updates werden unter Einstellungen → Studio & Updates angeboten.

Eine neue Versionsnummer in package.json auf main startet den Windows-Release-Workflow. Er testet das Studio, baut den NSIS-Installer, prüft dessen SHA-512-Prüfsumme und veröffentlicht Installer, Blockmap und latest.yml zusammen in einem GitHub Release. Ein bereits veröffentlichtes Release wird nicht verändert.
