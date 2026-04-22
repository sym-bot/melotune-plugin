---
description: Show artist info (bio, genres, top tracks, similar artists) for the current track or a named artist.
---

Call the `melotune_artist_info` MCP tool. If the user mentioned a specific artist name after the command, pass it as `artistName`; otherwise call with no arguments to use the currently playing track's artist. Present the returned text directly to the user.
