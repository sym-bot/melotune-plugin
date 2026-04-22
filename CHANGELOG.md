# Changelog

## 0.1.7

### Added

- **Startup remix-memory primer — auto-recall on session/agent restart (MMP §4.2 O2).**
  The plugin now calls `node.buildStartupPrimer()` before constructing the MCP
  Server and passes the result into the server's `instructions` payload. A fresh
  Claude Code session wakes with the agent's own remix memory — own observations
  plus peer observations admitted by SVAF — already loaded into context. No
  first-turn `sym_recall` required; agent acts from prior state immediately.
  Default caps inherited from `@sym-bot/sym`: last 24 hours OR 20 most recent
  CMBs, whichever is tighter. Empty store is a silent no-op.
- Introduces an MCP `instructions` payload for `melotune-plugin` (previously
  none) that describes the plugin's role and surfaces the startup primer.

### Changed

- **`@sym-bot/sym` dep bumped to `^0.5.0`** (was `^0.4.1`) to pick up
  `buildStartupPrimer` and to keep every plugin on the `sym.day` platform pinned
  to the same substrate SDK version (no drift across `mesh-channel`,
  `melotune-plugin`, and future specialised plugins).

## 0.1.6

### Added

- `melotune_request` MCP tool + `/melotune:request <text>` slash command — free-text vibe / mood / activity prompt routed through MeloTune's AI text-command parser. Claude picks this up conversationally whenever the user describes WHAT they want to hear or HOW they want to feel ("play something for late-night coding", "need focus music", "something calmer", "90s hip hop throwback").

## 0.1.5

### Changed

- Switch request / response transport from CMB frames to MMP §4.4 message frames (bypasses SVAF so protocol-control traffic isn't rejected by MeloTune's `.musicAgent` SVAF profile). Correlation via envelope `{ protocol, v, id, focus, ... }`.

## 0.1.0 – 0.1.4

Initial public release and iteration of the MCP plugin for Claude Code. 9 tools + 9 slash commands: `melotune_now_playing`, `melotune_queue`, `melotune_play`, `melotune_skip`, `melotune_favorite`, `melotune_unfavorite`, `melotune_artist_info`, `melotune_listening_history`, `melotune_search`.
