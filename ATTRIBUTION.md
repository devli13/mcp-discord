# Attribution

## Upstream inspiration

This MCP is net-new code, but its sibling project — the companion Paperclip plugin for inbound Discord Gateway events — is a fork of
**[paperclip-plugin-discord](https://github.com/mvanhorn/paperclip-plugin-discord) by [@mvanhorn](https://github.com/mvanhorn)**.

While this MCP does not reuse code from that project, its design choices (REST-first, per-route rate-limit buckets, structured error results) were informed by patterns established in @mvanhorn's plugin. Acknowledging that foundational work here.

If you also need inbound Discord event handling inside Paperclip (bot receives @mentions and DMs), use @mvanhorn's plugin or its fork at [`@devli13/paperclip-plugin-discord`](https://github.com/devli13/paperclip-plugin-discord).

## Dependencies

- [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) — Anthropic's official MCP server SDK. MIT licensed.

## License

MIT — see [LICENSE](./LICENSE).
