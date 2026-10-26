# Kewkew Cloudflare rebuild

Independent Cloudflare rebuild of Kewkew using SvelteKit, TypeScript, Workers,
and D1. The Phoenix application remains the behavioral reference. See
[`docs/cloudflare-rebuild-scope.md`](docs/cloudflare-rebuild-scope.md) and
[`docs/cloudflare-foundation.md`](docs/cloudflare-foundation.md).

## Local development

Install dependencies with `npm install`, then apply local D1 migrations and
start the Worker:

```sh
npm run db:migrate:local
npm run dev
```

Wrangler stores local D1 state under `.wrangler/state`. Local development does
not require Cloudflare authentication.

## Build and checks

```sh
npm run check
npm run build
npm run cf:types
```

## D1 environments

Local development uses the `kewkew-local` D1 database in Wrangler's local
simulator. Preview and production are configured with separate database names
and placeholder IDs in `wrangler.jsonc`; create those resources in Cloudflare
and replace the IDs before applying remote migrations. Use the environment
specific scripts only after that setup:

```sh
npm run db:migrate:preview
npm run db:migrate:production
```

No remote resources or production configuration are created by the local setup.
