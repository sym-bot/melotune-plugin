---
description: Ask MeloTune to curate music matching a free-text vibe, mood, or activity (e.g. "late night coding", "something calmer").
---

Call the `melotune_request` MCP tool with the user's description as the `request` argument. Everything the user typed after the command is the request text. If the user's phrasing is a good description (mood word, activity, genre, artist, era, etc.), pass it through verbatim. If they gave a terse signal ("calmer", "hype me up"), expand it with relevant session context (time of day, what they're working on). Present the returned text directly to the user.
