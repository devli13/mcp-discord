# @devli13/mcp-discord

[![npm](https://img.shields.io/npm/v/@devli13/mcp-discord)](https://www.npmjs.com/package/@devli13/mcp-discord)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An MCP server for Discord. Send messages, moderate, manage channels, inspect servers — from Claude Code, Paperclip agents, Gemini CLI, or any MCP-compatible client.

**Pure REST wrapper. No Gateway. No database.** Just Discord's v10 API as 26 well-documented tools, with per-route rate limiting and structured error results.

---

## Why

Discord's API is sprawling and agent-unfriendly when called via raw `curl`. Agents hit rate limits, mishandle 429s, fumble audit-log reasons, forget pagination cursors. This MCP fixes that once, so agents can focus on intent: *"delete that spam message,"* *"post the daily digest to #mod-log,"* *"timeout @user for an hour."*

Also great for humans. Connected to Claude Code, you can say *"summarize the last 50 messages in my Discord #dev channel"* and Claude just does it.

---

## Install

```bash
npm install -g @devli13/mcp-discord
```

Or via npx (no install):
```bash
DISCORD_BOT_TOKEN=<your-token> npx -y @devli13/mcp-discord
```

---

## Setup

### 1. Create a Discord bot

1. Go to <https://discord.com/developers/applications> → **New Application**
2. Add a **Bot** to the application
3. Copy the bot token — this is your `DISCORD_BOT_TOKEN`
4. Invite the bot to your server using the OAuth2 URL generator (scope: `bot`). Pick permissions based on what you need the MCP to do (e.g. Manage Messages for deletes, Moderate Members for timeouts)

### 2. Wire it to your MCP client

**Claude Code:**
```bash
claude mcp add discord \
  --env DISCORD_BOT_TOKEN=<your-token> \
  -- npx -y @devli13/mcp-discord
```

**Paperclip mcp-gateway (`.mcp.json`):**
```json
{
  "mcpServers": {
    "discord": {
      "command": "npx",
      "args": ["-y", "@devli13/mcp-discord"],
      "env": {
        "DISCORD_BOT_TOKEN": "<your-token>"
      }
    }
  }
}
```

**Gemini CLI (`~/.gemini/config.json`):**
```json
{
  "mcpServers": {
    "discord": {
      "command": "npx",
      "args": ["-y", "@devli13/mcp-discord"]
    }
  }
}
```

### 3. (Optional) Enable privileged intents

If you want to list server members (`discord_list_members`) or use this MCP alongside the companion plugin for inbound events, enable **Server Members Intent** and **Message Content Intent** in your bot's Developer Portal settings. These are *not* required for most MCP operations — only for specific endpoints.

---

## Tool reference

All tools are prefixed `discord_*` and return either a JSON blob (on success) or a formatted error message (on failure). None throw — every tool returns a usable string result.

### Messages (8)
| Tool | Purpose |
|---|---|
| `discord_send_message` | Send to a channel. Supports embeds, replies, mention control |
| `discord_edit_message` | Edit the bot's own message |
| `discord_delete_message` | Delete one message (by bot or others, with Manage Messages) |
| `discord_bulk_delete_messages` | Delete 2-100 messages (<14 days old) in one call |
| `discord_get_message` | Fetch one message by ID |
| `discord_list_messages` | Paginated channel history (before/after/around cursors) |
| `discord_pin_message` / `discord_unpin_message` | Manage pins |

### Reactions (3)
| Tool | Purpose |
|---|---|
| `discord_add_reaction` | Bot adds a reaction |
| `discord_remove_reaction` | Remove bot's or user's reaction |
| `discord_get_reactions` | List users who reacted with an emoji |

### Channels & Threads (5)
| Tool | Purpose |
|---|---|
| `discord_list_channels` | All channels in a guild |
| `discord_get_channel` | Single channel details |
| `discord_create_thread` | Spawn a new thread (public or private, anchored or standalone) |
| `discord_list_active_threads` | All active threads in a guild |
| `discord_send_typing` | Trigger "bot is typing…" indicator |

### Moderation (6)
| Tool | Purpose |
|---|---|
| `discord_get_member` | Member profile (roles, join date, timeout state) |
| `discord_list_members` | Paginated member list (requires Server Members intent) |
| `discord_timeout_user` | Mute via `communication_disabled_until` (max 28 days, 0 to clear) |
| `discord_kick_user` | Remove from guild |
| `discord_add_role` / `discord_remove_role` | Role management |

### Server info (4)
| Tool | Purpose |
|---|---|
| `discord_list_guilds` | All guilds the bot is in |
| `discord_get_guild` | Single guild details |
| `discord_list_roles` | All roles, sorted by position |
| `discord_get_audit_log` | Recent audit log entries (filter by user, action, etc.) |

**Not included (by design):**
- `ban`/`unban` — deliberate. Use Discord's UI; irreversible actions shouldn't be one agent-call away
- Channel create/delete/edit — high blast radius, use the UI
- Webhook CRUD — not needed for most agent flows; can add in a future release
- Voice operations, sticker/emoji management — out of scope for v0.1

---

## Example: summarize a channel via Claude Code

```
User: Summarize the last 30 messages in the #dev channel of my Discord server, guild ID 1234...

Claude (calls discord_list_channels → finds #dev → calls discord_list_messages → writes summary)
```

## Example: Paperclip agent daily digest

```js
// From an agent's prompt:
"Post the daily digest to channel 1234. Summarize the last 24h of activity
using discord_list_messages with limit=100, then format as an embed via
discord_send_message."
```

---

## Error handling

Every tool returns a usable text result. On error:

```
Error (DISCORD_50001, HTTP 403): Missing Access
Details: [...]
(This error is transient and may succeed on retry.)
```

The MCP already handles retries internally for 429 (rate limits) and 5xx (server errors), with exponential backoff.

---

## Rate limits

Discord has two rate-limit layers:

1. **Per-route** — each API endpoint has independent buckets. This MCP serializes requests per (method + route template) to prevent bursting past a 429.
2. **Global** — per-bot, across all endpoints. The MCP honors `Retry-After` headers globally.

You shouldn't need to think about this. If you do hit the global limit repeatedly, you're probably doing something that deserves a human in the loop.

---

## Security

- **Never commit your bot token.** This MCP reads it from `DISCORD_BOT_TOKEN` environment variable at startup.
- **Use least-privilege invite URLs.** Don't give bots Administrator if you only need Manage Messages.
- **Audit log reasons** — all moderation tools accept a `reason` argument that appears in Discord's audit log. Use it.

---

## Development

```bash
git clone https://github.com/devli13/mcp-discord.git
cd mcp-discord
npm install
npm test           # smoke tests (no live Discord calls)
npm run lint       # syntax check all files
npm start          # boot server over stdio (needs DISCORD_BOT_TOKEN)
```

---

## Attribution

See [ATTRIBUTION.md](./ATTRIBUTION.md). Short version: built alongside the fork of [paperclip-plugin-discord](https://github.com/mvanhorn/paperclip-plugin-discord) by [@mvanhorn](https://github.com/mvanhorn), whose Gateway handling inspired design patterns here.

## License

MIT — see [LICENSE](./LICENSE).
