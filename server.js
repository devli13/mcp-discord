#!/usr/bin/env node
// @devli13/mcp-discord — MCP server for Discord.
//
// Exposes Discord REST API as MCP tools. Works with Claude Code, Paperclip
// agents, Gemini CLI, or any MCP-compatible client. Pure REST — no Gateway
// WebSocket, no inbound event handling (that belongs in a plugin).
//
// Quick start:
//   DISCORD_BOT_TOKEN=<your token> mcp-discord
//
// Claude Code:
//   claude mcp add discord -- node /path/to/server.js \
//     --env DISCORD_BOT_TOKEN=<token>
//
// Built on the @modelcontextprotocol/sdk. Attribution to @mvanhorn's
// paperclip-plugin-discord for Gateway patterns in the companion plugin.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { tools as toolsMessages, handlers as handlersMessages } from './lib/tools-messages.js';
import { tools as toolsReactions, handlers as handlersReactions } from './lib/tools-reactions.js';
import { tools as toolsChannels, handlers as handlersChannels } from './lib/tools-channels.js';
import { tools as toolsModeration, handlers as handlersModeration } from './lib/tools-moderation.js';
import { tools as toolsGuild, handlers as handlersGuild } from './lib/tools-guild.js';

const ALL_TOOLS = [
  ...toolsMessages,
  ...toolsReactions,
  ...toolsChannels,
  ...toolsModeration,
  ...toolsGuild,
];

const ALL_HANDLERS = {
  ...handlersMessages,
  ...handlersReactions,
  ...handlersChannels,
  ...handlersModeration,
  ...handlersGuild,
};

// Sanity check — every tool has a handler, and vice versa.
{
  const toolNames = new Set(ALL_TOOLS.map((t) => t.name));
  const handlerNames = new Set(Object.keys(ALL_HANDLERS));
  for (const n of toolNames) {
    if (!handlerNames.has(n)) {
      console.error(`[mcp-discord] ERROR: tool "${n}" has no handler.`);
      process.exit(1);
    }
  }
  for (const n of handlerNames) {
    if (!toolNames.has(n)) {
      console.error(`[mcp-discord] ERROR: handler "${n}" has no tool definition.`);
      process.exit(1);
    }
  }
}

const server = new Server(
  {
    name: '@devli13/mcp-discord',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  const handler = ALL_HANDLERS[name];
  if (!handler) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    };
  }
  try {
    const text = await handler(args);
    return { content: [{ type: 'text', text: String(text) }] };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Tool error: ${err?.message ?? String(err)}` }],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is the MCP protocol channel.
  console.error(`[mcp-discord] server running — ${ALL_TOOLS.length} tools registered.`);
}

main().catch((err) => {
  console.error(`[mcp-discord] fatal: ${err?.message ?? err}`);
  process.exit(1);
});
