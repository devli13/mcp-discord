// Discord REST client — v10 API wrapper with rate-limit + retry.
//
// Token and base URL resolved from env:
//   DISCORD_BOT_TOKEN       required
//   DISCORD_API_BASE        default https://discord.com/api/v10
//   DISCORD_TIMEOUT_MS      default 15000
//   DISCORD_MAX_RETRIES     default 3
//
// All public methods return one of:
//   { ok: true, data }                       — HTTP 2xx
//   { ok: false, error: { code, message, status, retryable } }
//
// Never throws on HTTP errors — always returns a structured result.
// Throws only on programmer errors (missing token, malformed input).

const API_BASE = (process.env.DISCORD_API_BASE || 'https://discord.com/api/v10').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.DISCORD_TIMEOUT_MS || 15_000);
const MAX_RETRIES = Number(process.env.DISCORD_MAX_RETRIES || 3);

function getToken() {
  const t = process.env.DISCORD_BOT_TOKEN;
  if (!t) throw new Error('DISCORD_BOT_TOKEN is not set. Create a bot at discord.com/developers/applications, then set the env var before launching mcp-discord.');
  return t;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Serialize requests per "bucket" — Discord's rate limiter is per-route.
// A single in-flight queue per bucket ensures we don't burst past a 429.
const bucketLocks = new Map();
async function acquireBucket(bucket) {
  const prior = bucketLocks.get(bucket) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => { release = resolve; });
  bucketLocks.set(bucket, prior.then(() => next));
  await prior;
  return () => { release(); if (bucketLocks.get(bucket) === next) bucketLocks.delete(bucket); };
}

// Extract a bucket key from a request. Discord's rate-limit buckets are
// keyed by (method, route template) PLUS major parameters — channel_id,
// guild_id, webhook_id — which are NOT collapsed into {id}. Previously this
// code replaced every snowflake, over-serializing requests across unrelated
// channels/guilds. See Discord docs:
// https://discord.com/developers/docs/topics/rate-limits#rate-limits
function bucketFor(method, path) {
  const majorMatch = path.match(/^\/(channels|guilds|webhooks)\/(\d{15,20})/);
  const major = majorMatch ? `${majorMatch[1]}:${majorMatch[2]}` : '';
  const normalized = path.replace(/\d{15,20}/g, '{id}');
  return `${method}:${major}:${normalized}`;
}

// Global rate limit gate — set when Discord returns a 429 with `global: true`.
// All requests wait for this to elapse. Per-bucket locks (above) handle
// non-global 429s separately.
let globalLimitedUntil = 0;
async function waitForGlobalLimit() {
  const delay = globalLimitedUntil - Date.now();
  if (delay > 0) await sleep(Math.min(delay, 30_000));
}

// X-Audit-Log-Reason has a 512-char limit AFTER URL encoding. Naive
// `encodeURIComponent(reason).slice(0, 512)` can cut a `%XX` escape sequence
// in half and produce invalid HTTP headers. Truncate by Unicode codepoints
// first, then encode; if the encoded form exceeds 512, scale back by 20%
// iteratively until we fit. String reason is coerced from whatever the tool
// passed (handler-level validation happens separately).
function buildAuditReason(reason) {
  if (reason == null) return '';
  let s = typeof reason === 'string' ? reason : String(reason);
  // Strip control characters that would be ugly in audit log.
  s = s.replace(/[\x00-\x1f\x7f]/g, ' ');
  // Start by trimming to a reasonable codepoint budget (512 is header-encoded
  // max; most chars encode to 1-3 bytes post-URL-encoding).
  let codepoints = Array.from(s);
  if (codepoints.length > 512) codepoints = codepoints.slice(0, 512);
  let encoded = encodeURIComponent(codepoints.join(''));
  while (encoded.length > 512 && codepoints.length > 0) {
    codepoints = codepoints.slice(0, Math.max(1, Math.floor(codepoints.length * 0.8)));
    encoded = encodeURIComponent(codepoints.join(''));
  }
  return encoded;
}

/**
 * Perform a Discord REST request. Internal workhorse.
 * Respects rate-limit headers. Retries on 5xx and 429.
 */
async function request(method, path, { body, headers: extraHeaders = {}, reason } = {}) {
  const url = `${API_BASE}${path}`;
  const bucket = bucketFor(method, path);
  const releaseBucket = await acquireBucket(bucket);

  try {
    let attempt = 0;
    while (true) {
      attempt++;
      // Wait out any global rate-limit window before sending.
      await waitForGlobalLimit();
      const headers = {
        'Authorization': `Bot ${getToken()}`,
        'User-Agent': 'DiscordBot (https://github.com/devli13/mcp-discord, 0.1.0)',
        ...extraHeaders,
      };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (reason) headers['X-Audit-Log-Reason'] = buildAuditReason(reason);

      let res;
      try {
        res = await fetch(url, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (err) {
        if (attempt <= MAX_RETRIES) {
          await sleep(250 * 2 ** (attempt - 1));
          continue;
        }
        return {
          ok: false,
          error: { code: 'NETWORK_ERROR', message: String(err?.message ?? err), status: 0, retryable: true },
        };
      }

      // Parse body (may be empty on 204 etc).
      let payload = null;
      const text = await res.text();
      if (text) {
        try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
      }

      // 429 — rate limited. Honor retry_after (seconds, float). If `global`
      // is true, set the process-wide gate so all other requests wait too.
      if (res.status === 429) {
        const retryAfter = Number(payload?.retry_after ?? res.headers.get('retry-after') ?? 1);
        const waitMs = Math.max(250, Math.min(30_000, retryAfter * 1000));
        if (payload?.global === true) {
          globalLimitedUntil = Date.now() + waitMs;
        }
        if (attempt <= MAX_RETRIES) {
          await sleep(waitMs);
          continue;
        }
        return {
          ok: false,
          error: { code: 'RATE_LIMITED', message: `Rate limited for ${retryAfter}s`, status: 429, retryable: true, retryAfterMs: waitMs, global: payload?.global === true },
        };
      }

      // 5xx — transient. Retry with backoff.
      if (res.status >= 500 && res.status < 600) {
        if (attempt <= MAX_RETRIES) {
          await sleep(500 * 2 ** (attempt - 1));
          continue;
        }
        return {
          ok: false,
          error: { code: 'DISCORD_SERVER_ERROR', message: payload?.message || `HTTP ${res.status}`, status: res.status, retryable: true },
        };
      }

      if (res.ok) {
        return { ok: true, data: payload };
      }

      // 4xx — caller error. Don't retry. Pass structured info back.
      return {
        ok: false,
        error: {
          code: payload?.code ? `DISCORD_${payload.code}` : 'HTTP_ERROR',
          message: payload?.message || `HTTP ${res.status}`,
          status: res.status,
          retryable: false,
          details: payload?.errors,
        },
      };
    }
  } finally {
    releaseBucket();
  }
}

export const discord = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts = {}) => request('POST', path, { ...opts, body }),
  put: (path, body, opts = {}) => request('PUT', path, { ...opts, body }),
  patch: (path, body, opts = {}) => request('PATCH', path, { ...opts, body }),
  delete: (path, opts) => request('DELETE', path, opts),
};

// Small helper: format a result into a string safe to return to the MCP client.
// If ok, returns JSON-stringified data. If error, returns a readable error message.
export function formatResult(result) {
  if (result.ok) {
    return typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
  }
  const err = result.error;
  const parts = [`Error (${err.code}, HTTP ${err.status}): ${err.message}`];
  if (err.details) parts.push(`Details: ${JSON.stringify(err.details)}`);
  if (err.retryable) parts.push('(This error is transient and may succeed on retry.)');
  return parts.join('\n');
}

// URL-encode an emoji for reaction endpoints. Supports unicode + custom `name:id`.
export function encodeEmoji(emoji) {
  if (typeof emoji !== 'string' || !emoji) {
    throw new Error('emoji must be a non-empty string');
  }
  return encodeURIComponent(emoji);
}

// Discord snowflake validation — 15-20 digits.
export function isSnowflake(id) {
  return typeof id === 'string' && /^\d{15,20}$/.test(id);
}

export function requireSnowflake(id, field) {
  if (!isSnowflake(id)) {
    throw new Error(`${field} must be a Discord snowflake ID (15-20 digit string). Got: ${JSON.stringify(id)}`);
  }
  return id;
}
