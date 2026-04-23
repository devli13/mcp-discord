// Smoke tests — no live Discord calls. Validates:
//   - Server boots and announces 26 tools over stdio
//   - All tool schemas are well-formed JSON Schema
//   - Every registered tool has a handler and vice versa
//   - isSnowflake helper rejects bad IDs
//
// Run live-Discord tests only when DISCORD_BOT_TOKEN is a real token AND
// DISCORD_LIVE_TEST=1 is set.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { isSnowflake, requireSnowflake, encodeEmoji } from '../lib/discord.js';
import { tools as toolsMessages, handlers as handlersMessages } from '../lib/tools-messages.js';
import { tools as toolsReactions, handlers as handlersReactions } from '../lib/tools-reactions.js';
import { tools as toolsChannels, handlers as handlersChannels } from '../lib/tools-channels.js';
import { tools as toolsModeration, handlers as handlersModeration } from '../lib/tools-moderation.js';
import { tools as toolsGuild, handlers as handlersGuild } from '../lib/tools-guild.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, '..', 'server.js');

test('isSnowflake validates Discord ID format', () => {
  assert.equal(isSnowflake('1480724851256983694'), true);
  assert.equal(isSnowflake('1234567890123456'), true);
  assert.equal(isSnowflake('notanid'), false);
  assert.equal(isSnowflake(''), false);
  assert.equal(isSnowflake(1480724851256983694), false);
  assert.equal(isSnowflake('12345'), false); // too short
});

test('requireSnowflake throws on bad ID', () => {
  assert.throws(() => requireSnowflake('bad', 'channel_id'), /channel_id must be a Discord snowflake/);
  // Valid IDs pass through
  assert.equal(requireSnowflake('1480724851256983694', 'x'), '1480724851256983694');
});

test('encodeEmoji handles unicode + custom', () => {
  assert.equal(encodeEmoji('👍'), encodeURIComponent('👍'));
  assert.equal(encodeEmoji('rekt:1234'), encodeURIComponent('rekt:1234'));
  assert.throws(() => encodeEmoji(''), /emoji must be/);
  assert.throws(() => encodeEmoji(null), /emoji must be/);
});

test('every tool has a handler', () => {
  const all = [
    { tools: toolsMessages, handlers: handlersMessages, label: 'messages' },
    { tools: toolsReactions, handlers: handlersReactions, label: 'reactions' },
    { tools: toolsChannels, handlers: handlersChannels, label: 'channels' },
    { tools: toolsModeration, handlers: handlersModeration, label: 'moderation' },
    { tools: toolsGuild, handlers: handlersGuild, label: 'guild' },
  ];
  for (const cat of all) {
    const toolNames = cat.tools.map((t) => t.name);
    const handlerNames = Object.keys(cat.handlers);
    for (const n of toolNames) {
      assert.ok(handlerNames.includes(n), `Tool ${n} in category ${cat.label} has no handler`);
    }
    for (const n of handlerNames) {
      assert.ok(toolNames.includes(n), `Handler ${n} in category ${cat.label} has no tool`);
    }
  }
});

test('all tool schemas are well-formed', () => {
  const cats = [toolsMessages, toolsReactions, toolsChannels, toolsModeration, toolsGuild];
  let total = 0;
  for (const cat of cats) {
    for (const t of cat) {
      total++;
      assert.equal(typeof t.name, 'string', `Tool missing name: ${JSON.stringify(t)}`);
      assert.ok(t.name.startsWith('discord_'), `Tool name must start with discord_: ${t.name}`);
      assert.equal(typeof t.description, 'string', `Tool ${t.name} missing description`);
      assert.ok(t.description.length > 20, `Tool ${t.name} description too short`);
      assert.equal(typeof t.inputSchema, 'object', `Tool ${t.name} missing inputSchema`);
      assert.equal(t.inputSchema.type, 'object', `Tool ${t.name} inputSchema.type must be "object"`);
    }
  }
  assert.ok(total >= 22, `Expected at least 22 tools, got ${total}`);
});

test('server boots and lists tools over MCP stdio', async (t) => {
  const child = spawn('node', [SERVER], {
    env: { ...process.env, DISCORD_BOT_TOKEN: 'fake-token-for-smoke-test' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Collect stdout
  let out = '';
  child.stdout.on('data', (d) => { out += String(d); });

  let stderrBuf = '';
  child.stderr.on('data', (d) => { stderrBuf += String(d); });

  // Write initialize + tools/list
  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } },
  }) + '\n');

  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n');

  // Wait for responses
  await new Promise((r) => setTimeout(r, 500));
  child.kill();

  assert.match(stderrBuf, /server running — \d+ tools registered/, 'Expected startup message on stderr');

  // Parse the tools/list response
  const lines = out.split('\n').filter(Boolean);
  const listResp = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((r) => r && r.id === 2);
  assert.ok(listResp, 'Expected tools/list response');
  assert.ok(Array.isArray(listResp.result.tools), 'tools should be an array');
  assert.ok(listResp.result.tools.length >= 22, `Expected at least 22 tools, got ${listResp.result.tools.length}`);
});
