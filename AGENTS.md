# Kewkew Cloudflare project

## Purpose

This repository is the independent Cloudflare rebuild of Kewkew, a virtual queue
management system. Visitors join queues from their phones without installing an
app, track their tickets privately, and staff manage queues through a workspace.

This is a product rebuild, not a line-by-line port of the Phoenix/Ash codebase.
Preserve product behavior and domain invariants while using TypeScript, SvelteKit,
Cloudflare Workers, and D1 in ways that fit this stack.

The Phoenix repository, `johnwesonga/kewkew`, remains the behavioral reference
during development. This project is intended for the separate repository
`johnwesonga/kewkew-cf`.

## Product context and scope

Read `docs/cloudflare-rebuild-scope.md` before making product or architecture
changes. It links to the existing user stories and defines the delivery slices,
MVP boundary, key decisions, and cutover constraints.

The initial usable milestone covers:

- Organization setup and staff access
- Queue and session configuration
- Visitor joining and private ticket tracking
- Staff queue operations

Begin with polling or explicit refresh for updates. Real-time synchronization and
visitor notifications are later, separately reviewable work.

Do not migrate production data, change DNS, replace the Phoenix app, or cut over
the public service without a separately approved plan.

## Architecture principles

- Use SvelteKit with TypeScript and the Cloudflare adapter; deploy as a Worker.
- Use D1 as the persistent source of truth.
- Keep Cloudflare bindings and provider APIs behind small server-side modules.
- Put schema changes in reviewed, committed D1 SQL migrations.
- Enforce domain invariants with database constraints and server-side validation.
- Authorize every protected read and write on the server. Hiding UI controls is
  not authorization.
- Use conditional writes and transactions for queue mutations; do not assume
  PostgreSQL row-lock behavior.
- Keep sensitive visitor data and credentials out of public responses and
  broadcasts.
- Add Durable Objects or Cloudflare Queues only when a scoped story calls for
  them. D1 remains authoritative if those are introduced.

## Product and implementation practices

- Before implementing a feature, define its user story, value, and reviewable
  acceptance criteria in `docs/`.
- Keep changes small and independently reviewable. Avoid unrelated refactors.
- Follow the repository’s existing SvelteKit and TypeScript conventions. Prefer
  server-side form actions or endpoints for mutations and keep domain rules out
  of presentation components.
- Use opaque, revocable credentials for private visitor tracking; never expose
  database identifiers as authorization tokens.
- Preserve organization and location boundaries in every query and mutation.
- Do not add dependencies without a clear need; explain material architectural
  choices in the relevant design document.
- Update setup and operating documentation when commands or workflows change.

## Verification

Use the scripts provided by `package.json`. Run relevant checks for the change,
such as `npm run check`, and report which commands were run and their results.
Do not claim a check passed unless it was run.

## Git and delivery

Work in this repository only for Cloudflare implementation changes. Keep the
Phoenix repository as a reference unless a task explicitly asks to change it.

Do not deploy, change production configuration, or perform a production data
migration without explicit approval.