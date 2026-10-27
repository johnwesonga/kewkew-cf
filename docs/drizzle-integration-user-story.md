# Drizzle ORM integration user story

## Status

Scoped for review. No package or application code changes are part of this story.

## Context

Kewkew runs on SvelteKit and Cloudflare Workers with D1 as its persistent source
of truth. Application routes currently use D1's prepared SQL statements
directly. Better Auth also connects to D1 through its supported adapter.

Drizzle ORM offers a typed query API for D1. The goal is to evaluate whether it
improves the safety and maintainability of Kewkew's application queries while
preserving the product's tenant boundaries, conditional writes, and D1
transaction behavior.

## User story

As a Kewkew developer, I want a small, representative part of the application
to use the stable Drizzle ORM release with D1, so I can decide from real code
whether typed queries are worth adopting without disrupting authentication,
data integrity, or the existing migration workflow.

## Value

- Give application queries compile-time table and column checks.
- Make query intent and result types easier to follow as queue and membership
  features grow.
- Establish clear boundaries for Drizzle while retaining D1-specific SQL where
  conditional writes or batches express domain invariants most clearly.
- Decide whether the ORM improves the codebase enough to justify its runtime
  dependency and ongoing maintenance.

## Acceptance criteria

- The implementation uses the latest stable `drizzle-orm` release available
  when implementation begins; it does not use a prerelease tag. The selected
  version is recorded in the lockfile.
- A typed schema describes only the existing tables needed by the pilot and
  matches the committed D1 schema, including column names, nullability,
  defaults, keys, and SQLite representations.
- A small server-side pilot converts representative organization/location
  reads and at least one authorization-scoped query from raw SQL to Drizzle.
- The pilot preserves server-side authorization and organization/location
  scoping. Query results do not grant access based only on a client-provided ID.
- Existing D1 conditional writes and multi-statement batches remain correct;
  the story does not weaken predicates, transaction boundaries, or constraints
  to fit the ORM API. Raw D1 SQL may remain where it is clearer or necessary.
- Better Auth continues to use its supported D1 integration. The pilot does not
  wrap Better Auth's database connection in Drizzle.
- Wrangler D1 SQL migrations remain the sole schema migration and deployment
  workflow. Drizzle Kit and generated ORM migrations are not introduced in this
  story, avoiding competing migration histories.
- `npm run check` and `npm run build` pass after the pilot, and the local D1
  migration workflow remains usable. Any verification not run is reported
  explicitly.
- A short decision record in this document reports the pilot's tradeoffs and
  recommends one of: adopt Drizzle for application queries, extend the pilot,
  or keep direct D1 SQL. Broader conversion is a separate story.

## Scope boundaries

### Included

- Add the stable `drizzle-orm` runtime dependency if the pilot proceeds.
- Define a small typed schema for existing organization and location data used
  by the pilot.
- Add a server-only D1-to-Drizzle construction helper that receives the D1
  binding explicitly.
- Convert representative read paths and retain explicit authorization scopes.
- Document the result and recommendation below.

### Excluded

- Rewriting all routes or all existing SQL.
- Replacing Better Auth's database adapter.
- Adding `drizzle-kit`, generated migrations, or a second schema authority.
- Changing D1 schema, migrations, production data, bindings, or deployment
  configuration.
- Refactoring queue mutations before their domain workflows are implemented.

## Design constraints

- D1 remains authoritative; schema changes continue as reviewed SQL migrations
  under Wrangler.
- Keep the Drizzle instance and D1 binding server-side and request/runtime
  scoped as appropriate for Cloudflare Workers. Do not cache request bindings
  in mutable module-global state.
- Use SQLite-compatible column definitions and preserve existing database
  constraints.
- Prefer Drizzle for readable, typed queries where it helps. Keep parameterized
  D1 SQL for conditional mutations or batch workflows when that is clearer.
- Do not claim type safety replaces runtime validation, authorization, tenant
  predicates, or database constraints.

## Decision record

### Pilot outcome (2026-10-26)

- Stable package version: `drizzle-orm` 0.45.4, installed as an exact version.
- Converted the staff workspace's active membership read and its admin/operator
  location reads to Drizzle. They retain the active membership and organization
  scope predicates in the query itself.
- Organization profile and location create, update, and activation mutations
  use Drizzle. Authorization remains inside each conditional statement,
  including the location insert-select. The trusted setup flow retains its
  existing seven-statement D1 batch because it atomically initializes several
  tables; Better Auth continues to receive the D1 binding directly.
- Wrangler SQL migrations remain the only migration workflow. No Drizzle Kit
  dependency or generated migration files were added.
- `npm run check` passed with 0 errors and 0 warnings. `npm run build` passed.
- The existing queries explicitly used SQLite `COLLATE NOCASE`. The pilot
  preserves case-insensitive name ordering with a Drizzle `lower(...)` SQL
  expression. This is a small example of retaining SQL where dialect details
  matter; the ordering remains deterministic by adding the ID as a tie-breaker.

**Recommendation: adopt Drizzle selectively for application reads and
single-statement writes.** The pilot keeps tenant filters visible while
providing inferred result types, with no schema or auth migration. Use it for
similar paths as they are touched. Keep multi-statement domain batches in D1
SQL unless a separate change demonstrates equal clarity and safety. Do not
rewrite existing paths solely for ORM uniformity. Revisit migration tooling
separately only if maintaining the typed schema alongside SQL migrations
becomes a demonstrated source of drift.
