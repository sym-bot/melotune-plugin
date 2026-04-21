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

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `MELOTUNE_PLUGIN_NODE_NAME` | `melotune-plugin-<pid>` | Mesh node identity for this plugin instance |
| `SYM_RELAY_URL` | (unset → LAN-only via Bonjour) | WebSocket URL of a SYM relay for cross-network mesh |
| `SYM_RELAY_TOKEN` | (unset) | Relay auth token |

## CMB contract (for MeloTune iOS implementers)

This plugin emits and expects typed CMBs. Any MeloTune iOS build that implements these handlers will work with the plugin.

**Requests from plugin (focus field):**

- `melotune:now-playing`
- `melotune:queue`
- `melotune:play`
- `melotune:skip`

**Responses expected (focus field):**

- `melotune:now-playing:response` — payload `{ title, artist, mood, durationSec, positionSec }`
- `melotune:queue:response` — payload `{ tracks: [{ title, artist, mood, durationSec }, ...] }`
- `melotune:play:response` — payload `{ ok: bool, detail?: string }`
- `melotune:skip:response` — payload `{ ok: bool, detail?: string }`

Payload can be in the CMB `content` field (JSON-encoded) or `metadata` field (object).

Peer discovery: plugin matches any mesh peer whose `name` starts with `melotune` (case-insensitive).

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
