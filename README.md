# Kewkew Cloudflare rebuild

Independent Cloudflare rebuild of Kewkew using SvelteKit, TypeScript, Workers,
and D1. The Phoenix application remains the behavioral reference. See
[`docs/cloudflare-rebuild-scope.md`](docs/cloudflare-rebuild-scope.md) and
[`docs/cloudflare-foundation.md`](docs/cloudflare-foundation.md).

## Local development

Install dependencies with `npm install`. Before using setup or staff sign-in,
create local secret values in `.dev.vars`:

```sh
cp .dev.vars.example .dev.vars
```

Replace the authentication examples with different high-entropy values. For
example, generate each with `openssl rand -base64 32`. Set `RESEND_API_KEY`
from your Resend account, use a sender address on a verified Resend domain, and
keep `.dev.vars` private; it is ignored by Git.

Then apply migrations and start the Worker:

```sh
npm run db:migrate:local
npm run dev
```

The committed D1 migrations include Better Auth's tables and indexes. You do
not need to run `npx auth migrate` for local setup.

Wrangler stores local D1 state under `.wrangler/state`. Local D1 development
does not require Cloudflare authentication.

The first trusted administrator setup is available at `/setup`. It requires
`KEWKEW_BOOTSTRAP_SECRET` and can succeed only once. Public self-registration
is disabled. After setup, staff sign in at `/staff/sign-in`.

Staff invitations use the [Resend email API](https://resend.com/docs/api-reference/emails/send-email).
Set `RESEND_API_KEY` as a Worker secret, and set `INVITATION_FROM_EMAIL` and
`PUBLIC_APP_URL` as variables for each deployed environment. Verify the sender
domain in Resend before using it; localhost is allowed for the local app URL,
while preview and production URLs must use HTTPS. Failed sends remain visible
to administrators; revoke the failed invitation and issue a new one after
restoring delivery.

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
