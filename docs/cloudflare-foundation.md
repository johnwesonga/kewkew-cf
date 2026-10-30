# Cloudflare foundation

## User story

As a developer, I want Kewkew's SvelteKit app to run on Cloudflare Workers with
a local D1 database so I can build and validate the rebuild without affecting
the Phoenix app or production data.

## Value

This establishes the independent Worker and persistent data workflow required
for organization setup and queue operations.

## Acceptance criteria

- SvelteKit builds with the Cloudflare adapter and Wrangler has separate local,
  preview, and production D1 bindings.
- Local D1 schema is applied through committed SQL migrations.
- The home page reads a schema version from D1 and reports database readiness.
- Local development and migration commands are documented.
- No remote Cloudflare resources, public domain, or Phoenix data are changed.

## Environment setup

The local D1 binding works with Wrangler's local simulator and needs no account.
Preview and production use independent D1 databases named `kewkew-preview`
and `kewkew-production`, with their IDs configured in `wrangler.jsonc`. Do not
point either binding at production Phoenix data.
