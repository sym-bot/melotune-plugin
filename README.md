# melotune-plugin

Claude Code console as a MeloTune music interface. View the upcoming queue, see the current track, play, skip — while you vibe-code.

```
> /melotune:queue

Next up:
  1. Kiasmos — Burn · focus · 5:52
  2. Nils Frahm — Says · focus · 8:18
  3. Ólafur Arnalds — re:member · focus · 4:44
  4. Nala Sinephro — Space 1.8 · focus · 4:10

Use the melotune_play or melotune_skip tools to control playback.
```

## How it works

The plugin is a peer node on the SYM mesh. It talks to MeloTune on your iPhone via the Mesh Memory Protocol (MMP). The Claude Code console becomes the UI surface; your phone is the speaker.

Nothing plays audio on your Mac. All playback happens on your iPhone — this plugin just gives you a place to see and steer it.

## Install

```
/plugin marketplace add sym-bot/melotune-plugin
```

Or direct-install from a clone:

```
git clone https://github.com/sym-bot/melotune-plugin.git
claude --plugin-dir ./melotune-plugin
```

Prerequisites:

- MeloTune running on your iPhone (iOS 17+)
- iPhone on the same LAN as your Mac, **or** both connected to the same SYM relay (`SYM_RELAY_URL` + `SYM_RELAY_TOKEN` env vars)
- Node.js ≥ 18 (Claude Code plugin requirement)

## Tools

| Tool | What it does |
|---|---|
| `melotune_now_playing` | Show the track currently playing on your iPhone |
| `melotune_queue` | Show the next few tracks MeloTune has queued for your current vibe |
| `melotune_play` | Play / resume |
| `melotune_skip` | Skip to the next track |
| `melotune_favorite` | Star the current track (or a specific track by id) |
| `melotune_unfavorite` | Remove favorite from the current (or specific) track |
| `melotune_artist_info` | Bio, genres, top tracks, similar artists |
| `melotune_listening_history` | Recent tracks, top artists of the week, top moods |
| `melotune_search` | Search your MeloTune library and recommendations |
| `melotune_request` | Ask MeloTune to curate music matching a free-text vibe/mood/activity (e.g. "late night coding") |

You can call these as tools or just chat — "who's the artist on this one?", "show me something calmer", "what have I played most this week?" — Claude Code picks the tool and surfaces the answer in the console.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `MELOTUNE_PLUGIN_NODE_NAME` | `melotune-plugin-<pid>` | Mesh node identity for this plugin instance |
| `MELOTUNE_SERVICE_TYPE` | `_melotune._tcp` | Bonjour service type — must match MeloTune iOS's `discoveryServiceType` |
| `MELOTUNE_GROUP` | `default` | MMP §5.8 mesh group — must match MeloTune iOS |
| `SYM_RELAY_URL` | (unset → LAN-only via Bonjour) | WebSocket URL of a SYM relay for cross-network mesh |
| `SYM_RELAY_TOKEN` | (unset) | Relay auth token |

## CMB contract (for MeloTune iOS implementers)

This plugin emits and expects typed CMBs. Any MeloTune iOS build that implements these handlers will work with the plugin.

**Requests from plugin (focus field):**

- `melotune:now-playing`
- `melotune:queue`
- `melotune:play`
- `melotune:skip`
- `melotune:favorite` (optional metadata `{ trackId }`)
- `melotune:unfavorite` (optional metadata `{ trackId }`)
- `melotune:artist-info` (optional metadata `{ artistName }`)
- `melotune:history` (metadata `{ limit }`)
- `melotune:search` (metadata `{ query }`)
- `melotune:text-prompt` (metadata `{ text }`) — free-text vibe/mood request, parsed into a MusicCommand on iOS and dispatched through the same path as typed input

**Responses expected (focus field = request + `:response`):**

- `now-playing` → `{ title, artist, mood, durationSec, positionSec }`
- `queue` → `{ tracks: [{ title, artist, mood, durationSec }, ...] }`
- `play` / `skip` → `{ ok: bool, detail?: string }`
- `favorite` / `unfavorite` → `{ ok: bool, title, artist, favorite: bool }`
- `artist-info` → `{ name, bio?, genres: [], topTracks: [{ title }], similarArtists: [{ name }] }`
- `history` → `{ tracks: [{ title, artist, mood, playedAt }], topArtists: [{ name, plays }], topMoods: [{ mood }] }`
- `search` → `{ results: [{ title, artist, mood }] }`
- `text-prompt` → `{ ok: bool, explanation?: string, curatingType?: string, detail?: string }`

Transport is MMP §4.4 message frames (not CMBs). Control traffic bypasses SVAF — the music-agent SVAF profile would reject focus-only CMBs with no mood signal, so wire format is `node.send(JSON, {to: peerId})` both directions. Envelope: `{ protocol: "melotune-plugin", v: 1, id, focus, metadata?, intent? }` and `{ protocol, v, id, focus: "<req>:response", payload }`.

Peer discovery: plugin matches any mesh peer on `_melotune._tcp` Bonjour service type that is not another plugin instance (user's phone may publish with a custom display name).

## Architecture

```
Claude Code  ──MCP tool call──▶  melotune-plugin (this Node process)
                                         │
                                  SymNode (peer identity)
                                         │
                     ┌──────── MMP CMB over LAN/relay ────────┐
                     ▼                                         ▼
               MeloTune iOS                                sym-relay
               (plays music)
```

Plugin does not handle audio. Plugin does not store music. Plugin does not call Spotify / Apple Music APIs. All of that lives in MeloTune on the phone.

## License

Apache-2.0. © 2026 SYM.BOT.

## Author

Hongwei Xu · hongwei@sym.bot · https://sym.bot
