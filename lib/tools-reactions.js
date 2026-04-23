// Category B — Reactions.
//
// Tools:
//   discord_add_reaction
//   discord_remove_reaction
//   discord_get_reactions
//
// Emoji format:
//   Unicode:    👍  or  "thumbsup"  (bare unicode glyph)
//   Custom:     "name:id"  e.g. "rekt:1234567890"  (no colon-wrapping; just name + id)
//   Animated:   "a:name:id"

import { discord, formatResult, requireSnowflake, encodeEmoji } from './discord.js';

export const tools = [
  {
    name: 'discord_add_reaction',
    description: 'Add a reaction from the bot to a message. Emoji can be a unicode glyph (e.g. "👍") or custom-emoji string ("name:id"). Requires Add Reactions + Read Message History.',
    inputSchema: {
      type: 'object',
      required: ['channel_id', 'message_id', 'emoji'],
      properties: {
        channel_id: { type: 'string' },
        message_id: { type: 'string' },
        emoji: { type: 'string', description: 'Unicode emoji or "name:id" for custom emoji.' },
      },
    },
  },
  {
    name: 'discord_remove_reaction',
    description: "Remove a reaction. Without user_id, removes the bot's own reaction. With user_id, removes a specific user's reaction (requires Manage Messages).",
    inputSchema: {
      type: 'object',
      required: ['channel_id', 'message_id', 'emoji'],
      properties: {
        channel_id: { type: 'string' },
        message_id: { type: 'string' },
        emoji: { type: 'string' },
        user_id: { type: 'string', description: "Optional — specific user's reaction to remove. Omit for bot's own." },
      },
    },
  },
  {
    name: 'discord_get_reactions',
    description: 'List users who reacted with a specific emoji on a message. Paginated (default 25, max 100).',
    inputSchema: {
      type: 'object',
      required: ['channel_id', 'message_id', 'emoji'],
      properties: {
        channel_id: { type: 'string' },
        message_id: { type: 'string' },
        emoji: { type: 'string' },
        limit: { type: 'number', description: '1-100, default 25.' },
        after: { type: 'string', description: 'User ID cursor for pagination.' },
      },
    },
  },
];

export const handlers = {
  async discord_add_reaction(args) {
    requireSnowflake(args.channel_id, 'channel_id');
    requireSnowflake(args.message_id, 'message_id');
    const em = encodeEmoji(args.emoji);
    const res = await discord.put(`/channels/${args.channel_id}/messages/${args.message_id}/reactions/${em}/@me`);
    if (res.ok) return `Added reaction ${args.emoji} to message ${args.message_id}.`;
    return formatResult(res);
  },

  async discord_remove_reaction(args) {
    requireSnowflake(args.channel_id, 'channel_id');
    requireSnowflake(args.message_id, 'message_id');
    const em = encodeEmoji(args.emoji);
    const target = args.user_id ? args.user_id : '@me';
    if (args.user_id) requireSnowflake(args.user_id, 'user_id');
    const res = await discord.delete(`/channels/${args.channel_id}/messages/${args.message_id}/reactions/${em}/${target}`);
    if (res.ok) return `Removed reaction ${args.emoji} (user ${target}) from message ${args.message_id}.`;
    return formatResult(res);
  },

  async discord_get_reactions(args) {
    requireSnowflake(args.channel_id, 'channel_id');
    requireSnowflake(args.message_id, 'message_id');
    const em = encodeEmoji(args.emoji);
    const params = new URLSearchParams();
    if (args.limit !== undefined) params.set('limit', String(Math.min(100, Math.max(1, args.limit))));
    if (args.after) params.set('after', args.after);
    const qs = params.toString();
    const path = `/channels/${args.channel_id}/messages/${args.message_id}/reactions/${em}${qs ? `?${qs}` : ''}`;
    return formatResult(await discord.get(path));
  },
};
