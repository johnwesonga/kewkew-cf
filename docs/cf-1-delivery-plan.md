# CF-1 delivery plan

CF-1 is split into small changes that can be reviewed and merged in order. The
Phoenix stories in [organization and location administration](organization-location-admin-user-stories.md)
and [staff operations](staff-admin-flow-user-stories.md) remain the behavior
baseline. This plan records the Cloudflare implementation boundaries.

## Shared product rules

- A user identity can belong to multiple organizations; authentication alone
  grants no organization access.
- Membership roles are `admin` and `operator`. Admins have organization-wide
  access. Operators require one or more location assignments.
- Server actions authorize every protected read and write against active
  membership and, for operators, location assignment.
- Locations, services, memberships, and audit history are retained. Availability
  and access changes are represented as state changes.
- Cross-organization references are rejected by both SQL constraints and server
  validation where possible.
- Public self-signup is disabled. Bootstrap is a trusted, one-time operation.

## Reviewable increments

### CF-1A: Tenant data model

**Value** — Establish the D1 constraints that keep organization, location,
service, membership, and location-access records in their tenant boundaries.

**Acceptance criteria**

- Reviewed migration creates organizations, user identities, memberships,
  locations, services, location assignments, and membership audit events.
- SQL rejects duplicate memberships, invalid roles/statuses, and assignments
  that cross organization boundaries.
- Foreign keys preserve history by restricting physical deletion of referenced
  business records.
- No public reads or writes are added in this slice.

### CF-1B: Trusted bootstrap and staff identity

**Value** — Let an operator initialize one organization, location, and first
administrator, then let that administrator sign in.

**Acceptance criteria**

- Email/password sign-in is available; open self-registration is unavailable.
- A trusted, one-time bootstrap creates organization, initial location, user,
  and active admin membership atomically.
- Repeated or concurrent bootstrap attempts cannot create a second initial
  organization; failures leave no partial records.
- Authentication/session secrets are not committed or returned to public pages.

### CF-1C: Organization access and profile

**Value** — Give admins a scoped organization overview and name editing, while
operators only see their assigned locations.

**Acceptance criteria**

- Every read and update is authorized on the server for the current active
  membership.
- An organization outside the actor's active memberships reveals no data.
- Operators cannot update organization details or receive admin controls.

### CF-1D: Location administration

**Value** — Let admins maintain operating locations without breaking queues or
historical records.

**Acceptance criteria**

- Admins can create and update a location's name and valid IANA timezone.
- Admins can deactivate/reactivate a location; inactive locations cannot be
  used for new joins or sessions, while existing operations and history remain.
- Operators cannot manage locations and a location cannot be moved across
  organizations.

### CF-1E: Service administration

**Value** — Let admins manage the services visitors can choose at each location.

**Acceptance criteria**

- Admins can create, update, deactivate, and reactivate services at locations
  in their organization.
- Service edits cannot move a service to another location.
- Inactive services cannot accept joins or open new sessions; existing records
  and staff resolution remain available.

**Implementation note** — Service administration is implemented in the staff
workspace using the existing D1 `services` table. CF-2/CF-3 must enforce the
inactive service and location restrictions when session and join workflows are
added.

### CF-1F: Staff membership lifecycle

**Value** — Let admins securely invite staff and maintain role, location, and
suspension state.

**Acceptance criteria**

- Invitations bind to email and organization, expire, are single-use, and store
  only a digest of the opaque token.
- Acceptance creates/reuses an identity and applies membership plus assignments
  atomically.
- Operators always have at least one same-organization location assignment;
  admin access is organization-wide.
- Role, assignment, and suspension changes are audited. The last active admin
  cannot be demoted or suspended.
- The invitation delivery provider and recovery flow are documented before
  enabling delivery.

**Implementation decision** — Invitation email uses Resend's HTTP email API
through a small server-side sender module. `RESEND_API_KEY` and
`INVITATION_FROM_EMAIL` are configured per environment; invitation links use
the origin of the authenticated staff request, so local, preview, and
production sends target the host currently serving the app. Use the intended
deployment hostname when issuing invitations. The sender domain must be
verified with Resend before use. The API key stays server-side, and sends use
an idempotency key based on the invitation ID. Invitations expire after seven
days, are single-use, and persist only a SHA-256 digest of a 256-bit random
token. If delivery fails, the invite is retained with a failed delivery state;
an administrator revokes it and issues a fresh invitation after fixing
delivery. There is no resend of the same token and no account password recovery
flow in this increment; existing account recovery remains out of scope until
its provider and verification policy are separately decided.

**Implemented behavior** — `/staff/access` is admin-only and supports sending
invitations, replacing member roles and operator locations, suspending or
restoring memberships, and revoking pending invitations. `/staff/invitation/:token`
accepts a valid invitation, creates a verified identity and credential account
or reuses the signed-in invited identity, then applies membership and location
access in a D1 batch. All membership changes are organization-scoped and
audited. Conditional writes prevent demoting or suspending the last active
administrator. Route data access uses Drizzle query builders, including the
conditional writes collected into Drizzle's D1 batch API. Public
self-registration remains disabled.

The staff workspace has separate Live queues and Setup navigation. Live queues
lists queues visible to the signed-in staff member and links to their
operational boards. Setup links are rendered only for active organization
admins, and setup routes enforce that role on the server. Organization,
location, service, queue configuration, and Staff access pages are grouped
under Setup.

## CF-1E implementation note

The staff workspace now lists services for each location and lets active
organization admins create, edit, deactivate, and reactivate them. Service
actions are authorized on the server and bind each service to its existing
organization/location; edits cannot move a service. Operators can view services
only for locations already visible to their active membership and receive no
management actions. The existing `services` table supports this slice, so it
does not require a schema migration.

Queue and session creation, public discovery, and visitor joining are not yet
implemented. CF-2 and CF-3 must reject new sessions and joins when either the
service or its location is inactive, while leaving existing records available
for authorized staff resolution.

## Implementation notes

- Email/password was selected to preserve the Phoenix staff sign-in behavior.
- Better Auth provides the email/password and SvelteKit integration with its
  native D1 support. Public password sign-up is disabled. Trusted bootstrap
  provisions the initial identity with Better Auth's password hashing in the
  same D1 batch as the organization records.
- Better Auth's rate-limit table includes its implicit `id` primary key. The
  committed D1 migration rebuilds that table to match Better Auth's schema, so
  local setup does not need a separate `npx auth migrate` step.
- D1 remains the source of truth. Multi-row changes use D1 batches and
  conditional writes; no PostgreSQL row-lock assumptions are carried over.
- Invitation delivery remains a separate decision for CF-1F.
