// Category C — Channels & threads.
//
// Tools:
//   discord_list_channels
//   discord_get_channel
//   discord_create_thread
//   discord_list_active_threads
//   discord_send_typing

import { discord, formatResult, requireSnowflake } from './discord.js';

export const tools = [
  {
    name: 'discord_list_channels',
    description: 'List all channels in a guild (server). Includes text, voice, category, thread channels.',
    inputSchema: {
      type: 'object',
      required: ['guild_id'],
      properties: {
        guild_id: { type: 'string' },
      },
    },
  },
  {
    name: 'discord_get_channel',
    description: 'Fetch details about a single channel — name, type, permission overwrites, parent category, rate limit, etc.',
    inputSchema: {
      type: 'object',
      required: ['channel_id'],
      properties: {
        channel_id: { type: 'string' },
      },
    },
  },
  {
    name: 'discord_create_thread',
    description: 'Create a thread. If message_id is provided, creates a thread from that message; otherwise creates a standalone thread in the channel. auto_archive_duration is in minutes: 60, 1440, 4320, or 10080.',
    inputSchema: {
      type: 'object',
      required: ['channel_id', 'name'],
      properties: {
        channel_id: { type: 'string' },
        name: { type: 'string', description: '1-100 character thread name.' },
        message_id: { type: 'string', description: 'Optional — create thread anchored to this message.' },
        auto_archive_duration: {
          type: 'number',
          description: 'Minutes of inactivity before auto-archive: 60, 1440 (1d), 4320 (3d), or 10080 (7d). Default 1440.',
        },
        type: {
          type: 'number',
          description: 'Thread type (only used when message_id is not set): 11 = public thread, 12 = private thread. Default 11.',
        },
        invitable: {
          type: 'boolean',
          description: 'Private threads only — if false, only moderators can add members. Default true.',
        },
      },
    },
  },
  {
    name: 'discord_list_active_threads',
    description: 'List all active (non-archived) threads in a guild.',
    inputSchema: {
      type: 'object',
      required: ['guild_id'],
      properties: {
        guild_id: { type: 'string' },
      },
    },
  },
  {
    name: 'discord_send_typing',
    description: 'Trigger the "bot is typing…" indicator in a channel for about 10 seconds. Useful before sending a long-form response so users know the bot is working.',
    inputSchema: {
      type: 'object',
      required: ['channel_id'],
      properties: {
        channel_id: { type: 'string' },
      },
    },
  },
];

export const handlers = {
  async discord_list_channels(args) {
    requireSnowflake(args.guild_id, 'guild_id');
    return formatResult(await discord.get(`/guilds/${args.guild_id}/channels`));
  },

  async discord_get_channel(args) {
    requireSnowflake(args.channel_id, 'channel_id');
    return formatResult(await discord.get(`/channels/${args.channel_id}`));
  },

  async discord_create_thread(args) {
    requireSnowflake(args.channel_id, 'channel_id');
    if (typeof args.name !== 'string' || args.name.length < 1 || args.name.length > 100) {
      return 'Error: name must be 1-100 characters.';
    }
    const body = {
      name: args.name,
      auto_archive_duration: args.auto_archive_duration ?? 1440,
    };
    if (args.invitable !== undefined) body.invitable = args.invitable;
    let path;
    if (args.message_id) {
      requireSnowflake(args.message_id, 'message_id');
      path = `/channels/${args.channel_id}/messages/${args.message_id}/threads`;
    } else {
      path = `/channels/${args.channel_id}/threads`;
      body.type = args.type ?? 11;
    }
    return formatResult(await discord.post(path, body));
  },

  async discord_list_active_threads(args) {
    requireSnowflake(args.guild_id, 'guild_id');
    return formatResult(await discord.get(`/guilds/${args.guild_id}/threads/active`));
  },

  async discord_send_typing(args) {
    requireSnowflake(args.channel_id, 'channel_id');
    const res = await discord.post(`/channels/${args.channel_id}/typing`);
    if (res.ok) return `Typing indicator triggered in channel ${args.channel_id}.`;
    return formatResult(res);
  },
};
