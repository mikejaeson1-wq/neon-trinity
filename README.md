# Neon Trinity Studio 0.8.1 · Supabase Edition

Windows music studio for Dex, Nix and Jax. Shared songs, albums, artwork, playlists and performances live in the dedicated Supabase project. Authentication uses Discord OAuth with PKCE. Only three explicitly allowed Discord provider identities can access the band's data.

For normal use, open the Windows package and follow `SUPABASE-START.html`. Node.js, a CLI, and a separately hosted team server are not required by app users.

## Development

Node.js 22 or newer. Install dependencies with the committed lockfile (`pnpm install --frozen-lockfile`). Run `pnpm start`. The optional public website is static HTML/CSS/JS. `pnpm test` runs the unit and integration checks; `pnpm build:win` builds the Windows NSIS installer. `pnpm build:web` builds the web studio. The scripts bundle the pinned Supabase browser SDK locally.

## Data and access

`supabase/schema.sql` documents the project schema. Public tables have RLS policies. A private allowlist maps trusted `auth.identities.provider_id` values for the Discord provider to Dex, Nix and Jax. User-editable profile metadata does not grant access. The Windows session and PKCE verifier use Electron safeStorage. No privileged Supabase keys, Discord secrets or GitHub tokens belong in the source, frontend, backups, or album pages.

The catalog uses revision-based compare-and-swap and record-level conflict detection. MP3s and artwork are stored in a private Storage bucket. Explicitly published albums are separate snapshots. The `neon-public` Edge Function signs short-lived media URLs for published albums and live listening sessions. Public listening reads require the unguessable room capability; all session mutations additionally validate the Supabase user and band membership, and RLS enforces host ownership. Sessions expire without a host heartbeat.

The optional GitHub Pages publisher uploads only the static public player, with no MP3 copies. Public website hosting is a separate one-time setup; Discord sign-in and band synchronization work independently. The existing browser studio audience is preserved.

## Verification limits

Linux can build and inspect Windows app files but cannot prove the Windows runtime behavior, real Discord OAuth consent or Rich Presence. Those require the owner's configured Discord application and a Windows/Discord session. See the included setup guide for the exact callbacks and identity mapping.

## Windows-Installation und Updates

Nix und Jax laden den Installer über https://mikejaeson1-wq.github.io/neon-trinity/install.html herunter und melden sich im Studio mit Discord an. Updates werden unter Einstellungen → Studio & Updates angeboten.

Eine neue Versionsnummer in package.json auf main startet den Windows-Release-Workflow. Er testet das Studio, baut den NSIS-Installer, prüft dessen SHA-512-Prüfsumme und veröffentlicht Installer, Blockmap und latest.yml zusammen in einem GitHub Release. Ein bereits veröffentlichtes Release wird nicht verändert.

Spotify Premium is optional: the Windows studio uses PKCE and encrypted per-account credentials to browse playlists and control an official Spotify Connect device. Dex configures the public client ID once under Spotify; no client secret is used. See docs/TEAM-START.md for the registered loopback redirect and account allowlist.


## Player and public profiles

The dock and floating Winamp-style miniplayer share one source-aware transport.
Spotify metadata and commands stay bound to the current account and active
Connect device. Eleven skins and three layouts are device preferences. The
10-band Web Audio equalizer uses the existing MP3 audio graph, with gain
headroom, balance and a limiter; Spotify Connect audio remains in Spotify and
uses Spotify's own equalizer.

Public artist profiles live in nt_profiles. Only the allowlisted Discord
identity for the matching alias can edit a profile or upload its avatar.
Public counters are updated only by a private trigger; visitors can read
counts but only their own account's reactions. Follows and likes are unique
per Discord account, artist and reaction type. The public profile page uses
its own PKCE browser session, without installing the Studio or exposing the
band catalog. Its exact Supabase redirect URL is documented in TEAM-START.md.


## Mobile listening and profile colors in 0.7

The studio's Handy-App screen contains an offline-generated QR code for the public mobile.html PWA on the band's existing GitHub Pages site. It supports public releases, Discord-authorized band music and personal band playlists, plus an account-bound Spotify Premium Web Playback SDK player. The existing profile.html Supabase callback returns mobile OAuth to a fixed mobile.html target. Spotify PKCE uses one additional exact mobile.html redirect; tokens are sessionStorage-only, owner-bound and excluded from the service-worker cache. The service worker handles a fixed app-shell allowlist and never intercepts OAuth queries, APIs or media. Mobile playback and background behavior still need verification on the actual target phones.

Public profile accent_color is constrained to six-digit hex and has an owner-only column update grant under existing alias RLS. A separate migration is included for existing installations. New Cyberpunk name artwork and six mascot skins are source assets; the five existing skins remain. The mini-player playlist uses the same validated queue and playback source as the studio, with paged private Spotify items. Discord RPC now has a handshake timeout, forced reconnect, connection-generation guards, account diagnostics and acknowledgement status; its activity uses the public band icon URL. Discord's own activity privacy settings still control visibility.


## Conan music-box links in 0.8

The studio context menu explicitly publishes immutable MP3 snapshots of a selected band song or album to the separate nt-musicbox Storage bucket. The private nt-media bucket is unchanged. nt_musicbox_links has band-only RLS, immutable source fingerprints and a random UUID per audio revision. Storage inserts require a reserved object path; public playback uses a direct .mp3 URL with native Range support, no redirect, and no expiring JWT. A menu action removes the public objects before deleting their link records. Spotify and device-local music are excluded.

Albums are decoded one track at a time at 44.1 kHz and encoded into one continuous stereo MP3 using the pinned LGPL-3.0 @breezystack/lamejs package. Its source and license are included in the distribution; the package is bundled locally. A module worker handles encoding with a yielding in-process fallback. The upload supports AbortSignal, snapshots are bound to the verified Studio account, and publication is checked before exposing the URL.

Discord emits Listening type 2 with a song-oriented display type, clears paused/idle presence and exposes the acknowledged activity type without inventing a confirmation when the field is absent. Automatic game detection in a user's Discord client remains outside the app's control.
