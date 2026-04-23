// Category A — Message operations.
//
// Tools:
//   discord_send_message
//   discord_edit_message
//   discord_delete_message
//   discord_bulk_delete_messages
//   discord_get_message
//   discord_list_messages
//   discord_pin_message
//   discord_unpin_message

import { discord, formatResult, requireSnowflake } from './discord.js';

export const tools = [
  {
    name: 'discord_send_message',
    description: 'Send a new message to a Discord channel. Supports plain text, embeds, replies, and allowed_mentions control. Returns the created message object including its ID.',
    inputSchema: {
      type: 'object',
      required: ['channel_id'],
      properties: {
        channel_id: { type: 'string', description: 'Snowflake ID of the target channel.' },
        content: { type: 'string', description: 'Message text (up to 2000 chars). Either content or embeds is required.' },
        embeds: {
          type: 'array',
          description: 'Array of Discord embed objects (up to 10). Each embed is a rich card with title, description, fields, color, etc.',
          items: { type: 'object' },
        },
        reply_to_message_id: {
          type: 'string',
          description: 'Optional — reply to this message ID. The message must be in the same channel.',
        },
        allowed_mentions: {
          type: 'object',
          description: 'Control which mentions actually ping. E.g. {"parse": ["users"]} to allow user pings but suppress @everyone.',
        },
        suppress_embeds: {
          type: 'boolean',
          description: 'If true, no link previews are auto-generated.',
        },
      },
    },
  },
  {
    name: 'discord_edit_message',
    description: "Edit a message the bot previously sent. Can edit content and embeds. Cannot edit other users' messages.",
    inputSchema: {
      type: 'object',
      required: ['channel_id', 'message_id'],
      properties: {
        channel_id: { type: 'string' },
        message_id: { type: 'string' },
        content: { type: 'string' },
        embeds: { type: 'array', items: { type: 'object' } },
      },
    },
  },
  {
    name: 'discord_delete_message',
    description: 'Delete a single message. Requires Manage Messages for other users\' messages; bot can always delete its own.',
    inputSchema: {
      type: 'object',
      required: ['channel_id', 'message_id'],
      properties: {
        channel_id: { type: 'string' },
        message_id: { type: 'string' },
        reason: { type: 'string', description: 'Audit log reason (shown in Discord\'s audit log).' },
      },
    },
  },
  {
    name: 'discord_bulk_delete_messages',
    description: 'Bulk delete 2-100 messages from a channel. All messages must be less than 14 days old. Useful for raid cleanup. Requires Manage Messages permission.',
    inputSchema: {
      type: 'object',
      required: ['channel_id', 'message_ids'],
      properties: {
        channel_id: { type: 'string' },
        message_ids: {
          type: 'array',
          description: 'Array of message snowflake IDs to delete (min 2, max 100).',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 100,
        },
        reason: { type: 'string' },
      },
    },
  },
  {
    name: 'discord_get_message',
    description: 'Fetch a single message by ID. Useful for reading context before acting.',
    inputSchema: {
      type: 'object',
      required: ['channel_id', 'message_id'],
      properties: {
        channel_id: { type: 'string' },
        message_id: { type: 'string' },
      },
    },
  },
  {
    name: 'discord_list_messages',
    description: 'Fetch recent messages from a channel. Paginate with before/after/around cursors. Default limit is 50, max 100.',
    inputSchema: {
      type: 'object',
      required: ['channel_id'],
      properties: {
        channel_id: { type: 'string' },
        limit: { type: 'number', description: 'Number of messages to fetch (1-100, default 50).' },
        before: { type: 'string', description: 'Return messages before this message ID.' },
        after: { type: 'string', description: 'Return messages after this message ID.' },
        around: { type: 'string', description: 'Return messages around this message ID.' },
      },
    },
  },
  {
    name: 'discord_pin_message',
    description: 'Pin a message in a channel. Requires Manage Messages. Channels max 50 pinned messages.',
    inputSchema: {
      type: 'object',
      required: ['channel_id', 'message_id'],
      properties: {
        channel_id: { type: 'string' },
        message_id: { type: 'string' },
        reason: { type: 'string' },
      },
    },
  },
  {
    name: 'discord_unpin_message',
    description: 'Unpin a previously pinned message.',
    inputSchema: {
      type: 'object',
      required: ['channel_id', 'message_id'],
      properties: {
        channel_id: { type: 'string' },
        message_id: { type: 'string' },
        reason: { type: 'string' },
      },
    },
  },
];

export const handlers = {
  async discord_send_message(args) {
    requireSnowflake(args.channel_id, 'channel_id');
    if (!args.content && !(args.embeds && args.embeds.length)) {
      return 'Error: either content or embeds is required.';
    }
    const body = {};
    if (args.content !== undefined) body.content = args.content;
    if (args.embeds) body.embeds = args.embeds;
    if (args.allowed_mentions) body.allowed_mentions = args.allowed_mentions;
    if (args.reply_to_message_id) {
      body.message_reference = {
        message_id: args.reply_to_message_id,
        channel_id: args.channel_id,
        fail_if_not_exists: false,
      };
    }
    if (args.suppress_embeds) body.flags = 4; // SUPPRESS_EMBEDS = 1 << 2
    return formatResult(await discord.post(`/channels/${args.channel_id}/messages`, body));
  },

  async discord_edit_message(args) {
    requireSnowflake(args.channel_id, 'channel_id');
    requireSnowflake(args.message_id, 'message_id');
    const body = {};
    if (args.content !== undefined) body.content = args.content;
    if (args.embeds !== undefined) body.embeds = args.embeds;
    if (Object.keys(body).length === 0) return 'Error: nothing to edit — provide content or embeds.';
    return formatResult(await discord.patch(`/channels/${args.channel_id}/messages/${args.message_id}`, body));
  },

  async discord_delete_message(args) {
    requireSnowflake(args.channel_id, 'channel_id');
    requireSnowflake(args.message_id, 'message_id');
    const res = await discord.delete(`/channels/${args.channel_id}/messages/${args.message_id}`, { reason: args.reason });
    if (res.ok) return `Deleted message ${args.message_id} from channel ${args.channel_id}.`;
    return formatResult(res);
  },

  async discord_bulk_delete_messages(args) {
    requireSnowflake(args.channel_id, 'channel_id');
    if (!Array.isArray(args.message_ids) || args.message_ids.length < 2 || args.message_ids.length > 100) {
      return 'Error: message_ids must be an array of 2-100 snowflake IDs.';
    }
    for (const id of args.message_ids) requireSnowflake(id, 'message_ids[]');
    const res = await discord.post(`/channels/${args.channel_id}/messages/bulk-delete`, { messages: args.message_ids }, { reason: args.reason });
    if (res.ok) return `Bulk-deleted ${args.message_ids.length} messages from channel ${args.channel_id}.`;
    return formatResult(res);
  },

  async discord_get_message(args) {
    requireSnowflake(args.channel_id, 'channel_id');
    requireSnowflake(args.message_id, 'message_id');
    return formatResult(await discord.get(`/channels/${args.channel_id}/messages/${args.message_id}`));
  },

  async discord_list_messages(args) {
    requireSnowflake(args.channel_id, 'channel_id');
    const params = new URLSearchParams();
    if (args.limit !== undefined) params.set('limit', String(Math.min(100, Math.max(1, args.limit))));
    if (args.before) params.set('before', args.before);
    if (args.after) params.set('after', args.after);
    if (args.around) params.set('around', args.around);
    const qs = params.toString();
    const path = `/channels/${args.channel_id}/messages${qs ? `?${qs}` : ''}`;
    return formatResult(await discord.get(path));
  },

  async discord_pin_message(args) {
    requireSnowflake(args.channel_id, 'channel_id');
    requireSnowflake(args.message_id, 'message_id');
    const res = await discord.put(`/channels/${args.channel_id}/pins/${args.message_id}`, undefined, { reason: args.reason });
    if (res.ok) return `Pinned message ${args.message_id}.`;
    return formatResult(res);
  },

  async discord_unpin_message(args) {
    requireSnowflake(args.channel_id, 'channel_id');
    requireSnowflake(args.message_id, 'message_id');
    const res = await discord.delete(`/channels/${args.channel_id}/pins/${args.message_id}`, { reason: args.reason });
    if (res.ok) return `Unpinned message ${args.message_id}.`;
    return formatResult(res);
  },
};
