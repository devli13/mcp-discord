// Category E — Guild & server info.
//
// Tools:
//   discord_list_guilds
//   discord_get_guild
//   discord_list_roles
//   discord_get_audit_log

import { discord, formatResult, requireSnowflake } from './discord.js';

export const tools = [
  {
    name: 'discord_list_guilds',
    description: 'List all guilds (servers) the bot is a member of. Useful for multi-server setups.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '1-200, default 200.' },
      },
    },
  },
  {
    name: 'discord_get_guild',
    description: 'Fetch details for a single guild — name, icon, owner, member count, features, etc.',
    inputSchema: {
      type: 'object',
      required: ['guild_id'],
      properties: {
        guild_id: { type: 'string' },
        with_counts: { type: 'boolean', description: 'Include approximate member/presence counts.' },
      },
    },
  },
  {
    name: 'discord_list_roles',
    description: 'List all roles in a guild. Returns role objects sorted by position (highest first).',
    inputSchema: {
      type: 'object',
      required: ['guild_id'],
      properties: {
        guild_id: { type: 'string' },
      },
    },
  },
  {
    name: 'discord_get_audit_log',
    description: 'Fetch recent audit log entries. Filter by action_type (Discord AuditLogEvent enum integer) and/or user_id. Requires View Audit Log permission.',
    inputSchema: {
      type: 'object',
      required: ['guild_id'],
      properties: {
        guild_id: { type: 'string' },
        user_id: { type: 'string', description: 'Filter to actions by this user.' },
        action_type: {
          type: 'number',
          description: 'Discord AuditLogEvent integer — e.g. 20 = MEMBER_KICK, 22 = MEMBER_BAN_ADD, 24 = MEMBER_UPDATE, 72 = MESSAGE_DELETE, 74 = MESSAGE_BULK_DELETE. See https://discord.com/developers/docs/resources/audit-log#audit-log-entry-object-audit-log-events',
        },
        before: { type: 'string', description: 'Audit entry ID cursor.' },
        limit: { type: 'number', description: '1-100, default 50.' },
      },
    },
  },
];

export const handlers = {
  async discord_list_guilds(args) {
    const params = new URLSearchParams();
    if (args?.limit !== undefined) params.set('limit', String(Math.min(200, Math.max(1, args.limit))));
    const qs = params.toString();
    const path = `/users/@me/guilds${qs ? `?${qs}` : ''}`;
    return formatResult(await discord.get(path));
  },

  async discord_get_guild(args) {
    requireSnowflake(args.guild_id, 'guild_id');
    const qs = args.with_counts ? '?with_counts=true' : '';
    return formatResult(await discord.get(`/guilds/${args.guild_id}${qs}`));
  },

  async discord_list_roles(args) {
    requireSnowflake(args.guild_id, 'guild_id');
    return formatResult(await discord.get(`/guilds/${args.guild_id}/roles`));
  },

  async discord_get_audit_log(args) {
    requireSnowflake(args.guild_id, 'guild_id');
    const params = new URLSearchParams();
    if (args.user_id) {
      requireSnowflake(args.user_id, 'user_id');
      params.set('user_id', args.user_id);
    }
    if (args.action_type !== undefined) params.set('action_type', String(args.action_type));
    if (args.before) params.set('before', args.before);
    if (args.limit !== undefined) params.set('limit', String(Math.min(100, Math.max(1, args.limit))));
    const qs = params.toString();
    const path = `/guilds/${args.guild_id}/audit-logs${qs ? `?${qs}` : ''}`;
    return formatResult(await discord.get(path));
  },
};
