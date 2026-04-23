// Category D — Members & moderation.
//
// Tools:
//   discord_get_member
//   discord_list_members
//   discord_timeout_user
//   discord_kick_user
//   discord_add_role
//   discord_remove_role

import { discord, formatResult, requireSnowflake } from './discord.js';

// Discord's max timeout is 28 days (2419200 seconds).
const MAX_TIMEOUT_SECONDS = 28 * 24 * 60 * 60;

export const tools = [
  {
    name: 'discord_get_member',
    description: 'Fetch a guild member — nickname, joined_at, roles, communication_disabled_until (timeout), etc.',
    inputSchema: {
      type: 'object',
      required: ['guild_id', 'user_id'],
      properties: {
        guild_id: { type: 'string' },
        user_id: { type: 'string' },
      },
    },
  },
  {
    name: 'discord_list_members',
    description: 'List members of a guild. Paginate with `after` cursor (last user ID). Requires the Server Members privileged intent on the bot.',
    inputSchema: {
      type: 'object',
      required: ['guild_id'],
      properties: {
        guild_id: { type: 'string' },
        limit: { type: 'number', description: '1-1000, default 100.' },
        after: { type: 'string', description: 'User ID cursor for pagination.' },
      },
    },
  },
  {
    name: 'discord_timeout_user',
    description: 'Timeout a user — they cannot send messages, react, or join voice. Up to 28 days. Pass duration_seconds=0 to remove an existing timeout. Requires Moderate Members permission.',
    inputSchema: {
      type: 'object',
      required: ['guild_id', 'user_id', 'duration_seconds'],
      properties: {
        guild_id: { type: 'string' },
        user_id: { type: 'string' },
        duration_seconds: {
          type: 'number',
          description: 'Timeout length (0 to clear, max 2419200 = 28 days).',
        },
        reason: { type: 'string' },
      },
    },
  },
  {
    name: 'discord_kick_user',
    description: 'Remove a user from the guild. They can rejoin via invite. Requires Kick Members permission.',
    inputSchema: {
      type: 'object',
      required: ['guild_id', 'user_id'],
      properties: {
        guild_id: { type: 'string' },
        user_id: { type: 'string' },
        reason: { type: 'string' },
      },
    },
  },
  {
    name: 'discord_add_role',
    description: 'Add a role to a guild member. Requires Manage Roles and the target role must be below the bot\'s highest role.',
    inputSchema: {
      type: 'object',
      required: ['guild_id', 'user_id', 'role_id'],
      properties: {
        guild_id: { type: 'string' },
        user_id: { type: 'string' },
        role_id: { type: 'string' },
        reason: { type: 'string' },
      },
    },
  },
  {
    name: 'discord_remove_role',
    description: 'Remove a role from a guild member.',
    inputSchema: {
      type: 'object',
      required: ['guild_id', 'user_id', 'role_id'],
      properties: {
        guild_id: { type: 'string' },
        user_id: { type: 'string' },
        role_id: { type: 'string' },
        reason: { type: 'string' },
      },
    },
  },
];

export const handlers = {
  async discord_get_member(args) {
    requireSnowflake(args.guild_id, 'guild_id');
    requireSnowflake(args.user_id, 'user_id');
    return formatResult(await discord.get(`/guilds/${args.guild_id}/members/${args.user_id}`));
  },

  async discord_list_members(args) {
    requireSnowflake(args.guild_id, 'guild_id');
    const params = new URLSearchParams();
    if (args.limit !== undefined) params.set('limit', String(Math.min(1000, Math.max(1, args.limit))));
    if (args.after) params.set('after', args.after);
    const qs = params.toString();
    const path = `/guilds/${args.guild_id}/members${qs ? `?${qs}` : ''}`;
    return formatResult(await discord.get(path));
  },

  async discord_timeout_user(args) {
    requireSnowflake(args.guild_id, 'guild_id');
    requireSnowflake(args.user_id, 'user_id');
    if (typeof args.duration_seconds !== 'number' || args.duration_seconds < 0) {
      return 'Error: duration_seconds must be a non-negative number (0 to clear timeout).';
    }
    const dur = Math.min(args.duration_seconds, MAX_TIMEOUT_SECONDS);
    const body = dur === 0
      ? { communication_disabled_until: null }
      : { communication_disabled_until: new Date(Date.now() + dur * 1000).toISOString() };
    const res = await discord.patch(`/guilds/${args.guild_id}/members/${args.user_id}`, body, { reason: args.reason });
    if (res.ok) {
      return dur === 0
        ? `Cleared timeout for user ${args.user_id}.`
        : `Timed out user ${args.user_id} for ${dur}s (until ${body.communication_disabled_until}).`;
    }
    return formatResult(res);
  },

  async discord_kick_user(args) {
    requireSnowflake(args.guild_id, 'guild_id');
    requireSnowflake(args.user_id, 'user_id');
    const res = await discord.delete(`/guilds/${args.guild_id}/members/${args.user_id}`, { reason: args.reason });
    if (res.ok) return `Kicked user ${args.user_id} from guild ${args.guild_id}.`;
    return formatResult(res);
  },

  async discord_add_role(args) {
    requireSnowflake(args.guild_id, 'guild_id');
    requireSnowflake(args.user_id, 'user_id');
    requireSnowflake(args.role_id, 'role_id');
    const res = await discord.put(`/guilds/${args.guild_id}/members/${args.user_id}/roles/${args.role_id}`, undefined, { reason: args.reason });
    if (res.ok) return `Added role ${args.role_id} to user ${args.user_id}.`;
    return formatResult(res);
  },

  async discord_remove_role(args) {
    requireSnowflake(args.guild_id, 'guild_id');
    requireSnowflake(args.user_id, 'user_id');
    requireSnowflake(args.role_id, 'role_id');
    const res = await discord.delete(`/guilds/${args.guild_id}/members/${args.user_id}/roles/${args.role_id}`, { reason: args.reason });
    if (res.ok) return `Removed role ${args.role_id} from user ${args.user_id}.`;
    return formatResult(res);
  },
};
