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
Set `RESEND_API_KEY` as a Worker secret and `INVITATION_FROM_EMAIL` for each
deployed environment. Invitation links use the origin of the staff request, so
local, preview, and production emails point back to the host where the admin is
using the app. Use the intended deployment hostname when issuing invitations.
Verify the sender domain in Resend before use. Failed sends remain visible to
administrators; revoke the failed invitation and issue a new one after
restoring delivery.

## Build and checks

```sh
npm run check
npm run build
npm run cf:types
```

## D1 environments

Local development uses the `kewkew-local` D1 database in Wrangler's local
simulator. Preview and production use separate Cloudflare D1 databases
configured in `wrangler.jsonc`. Use the environment-specific migration scripts
after the corresponding databases are created and their IDs are configured:

```sh
npm run db:migrate:preview
npm run db:migrate:production
```

Preview migrations are manual. Apply any new preview migrations before merging
code that depends on them, because the GitHub Actions deployment does not run
migrations:

```sh
npm run db:migrate:preview
```

Deploy locally to the named environment with its matching D1 binding:

```sh
npm run deploy:preview
npm run deploy:production
```

The preview Worker is `kewkew-preview`, bound to the separate
`kewkew-preview` D1 database. Configure `BETTER_AUTH_SECRET`,
`KEWKEW_BOOTSTRAP_SECRET`, `RESEND_API_KEY`, and `INVITATION_FROM_EMAIL` as
Worker secrets for the preview environment. Use unique preview authentication
and bootstrap secrets. Do not reuse local `.dev.vars` or production values.

Before production deployment, apply reviewed migrations to the production
database and configure the same application secrets for the production Worker.
The default `npm run deploy` targets production; use the explicit preview
script when validating a preview release.

No remote resources or production configuration are created by the local setup.

## GitHub Actions

Pull requests targeting `main` run dependency installation, Svelte/TypeScript
checks, unit tests, and a Worker build. Pushes to `main` run the same validation
and then automatically deploy the preview Worker. The workflow does not deploy
on pull requests, apply D1 migrations, or deploy to production.

The GitHub Actions `preview` environment must contain these secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The Worker application secrets are configured directly on the Cloudflare
preview Worker, separately from GitHub Actions. To review schema changes on
preview, apply migrations with `npm run db:migrate:preview` before merging the
code that requires them. Find the deployed preview URL in the Cloudflare
Workers dashboard or in the Wrangler deployment output.
