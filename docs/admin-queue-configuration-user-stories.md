# Admin queue configuration

## Goal

Let organization administrators configure reusable queues for their locations and services, publish a safe public entry point, and control queue operating sessions. Keep queue setup separate from each session so configuration can be reused without changing existing tickets or history.

**Behavior reference** — [Phoenix admin queue configuration user stories](https://github.com/johnwesonga/kewkew/blob/main/docs/admin-queue-configuration-user-stories.md). This document adapts those behaviors to the Cloudflare rebuild; it does not require Phoenix/Ash implementation details.

## Scope and related stories

This document covers queue discovery and configuration, public queue links, activation, manual session lifecycle, and deletion eligibility. Visitor joining and ticket privacy are specified in [visitor flow user stories](visitor-flow-user-stories.md); staff ticket transitions are specified in [staff admin flow user stories](staff-admin-flow-user-stories.md); recurring schedules and scheduled service starts are specified separately in [queue scheduling user stories](queue-scheduling-user-stories.md).

All stories below are **Planned**. The AQ identifiers follow the Phoenix reference where applicable.

## Shared rules

- A queue is reusable configuration permanently associated with one location and one service in the same organization. A session is one operating period for that queue.
- Queue activation and session state are separate: a queue can be active or inactive; a session can be open, paused, or closed. A queue must be active, and its location and service must be active, before visitors can join or staff can open a new session.
- Authorize every queue read and write on the server using the active organization membership, role, and location assignment. Administrators manage configuration; an authorized operator can perform the session operations specified below. UI visibility does not grant access.
- Preserve organization and location boundaries in queries and mutations. Validate that the selected service belongs to the selected location and organization.
- Use D1 constraints and conditional writes/transactions for state changes that can race, including opening a session and deleting a queue. Do not rely on row locks. Competing requests must not create duplicate open sessions or bypass eligibility checks.
- Queue edits affect future joins only. They do not rewrite existing tickets, session history, ticket order, or sequence counters.
- The optional active-ticket capacity limits tickets in `waiting`, `called`, and `serving` states in the current session. A `no_show` ticket does not consume capacity; recalling it makes it active again and subject to capacity. Capacity is unlimited when unset and otherwise a positive integer.
- A public queue link identifies the reusable queue across sessions. Use an opaque public identifier, never a database ID or private visitor/staff credential. The identifier grants no staff or private ticket access.
- Do not physically delete a queue after it has session history. Deactivation preserves the queue and its history.
- Recurring signup schedules, per-occurrence ticket caps, and scheduled service-start times are covered by the queue-scheduling stories. This document covers manual session opening and must not introduce conflicting schedule behavior.

## AQ-1: View queues

**Status** — Complete

**User story** — As an organization administrator or authorized operator, I want to find queues for my organization and assigned locations so I can review their configuration and current operating state.

### Acceptance criteria

- An administrator can view queues in the organization and filter or group them by location, service, and active/inactive state.
- An operator can view only queues at locations to which they are assigned; they cannot access another organization's queue by changing a URL or submitted identifier.
- Each queue row shows its name, location, service, activation state, active session state (or that no session is open), and configured capacity.
- The view does not expose private visitor credentials or unrelated organizations' data.
- The server rechecks authorization for the page load and any detail request.

## AQ-2: Create a queue

**Status** — Planned

**User story** — As an organization administrator, I want to create a queue for a location and service so visitors can join the correct line when a session is operating.

### Acceptance criteria

- An administrator can enter a queue name, choose a location and a service at that location, choose the visitor identity policy, and optionally set active-ticket capacity.
- Identity policy supports anonymous tickets or requiring both first and last name.
- Capacity may be unset (unlimited) or a positive integer. Invalid values and services outside the selected location are rejected with clear validation errors.
- Queue creation does not open a session. The new queue is inactive until explicitly activated.
- The server verifies administrator access and all organization/location relationships before writing.
- Duplicate submissions do not create duplicate queues when the same create request is retried.

## AQ-3: Edit queue configuration

**Status** — Planned

**User story** — As an organization administrator, I want to update a queue's visitor-facing rules so future visitors use the latest configuration.

### Acceptance criteria

- An administrator can change the queue name, identity policy, and active-ticket capacity.
- Location and service are fixed after creation. Moving a queue requires a separately reviewed migration or replacement workflow.
- Changes apply to future joins and do not modify tickets already issued, their captured names, session history, ticket order, or sequence counters.
- Reducing capacity below the current number of active tickets is allowed; it blocks additional joins until active count is below the new limit and does not cancel existing tickets.
- The server validates values and administrator authorization at write time.
- The saved configuration is shown after refresh and is used by subsequent server-side join validation.

## AQ-4: Share a queue link and QR code

**Status** — Planned

**User story** — As an organization administrator, I want a reusable public link and printable QR code for a queue so visitors can reach its current signup page.

### Acceptance criteria

- An administrator can copy the queue's public URL and view or download a QR code that resolves to it.
- The link identifies the queue, not a particular session, and remains valid across sessions unless the queue is deactivated or its public identifier is explicitly revoked.
- The URL contains no database identifier, visitor tracking credential, or staff authorization token.
- Opening the link reveals only the public queue page and does not grant staff access or access to private ticket tracking.
- An inactive queue or a queue without an available session cannot accept a join through the link; the visitor receives a clear unavailable state.
- Access to the link-management controls is restricted to authorized organization administrators.

## AQ-5: Activate or deactivate a queue

**Status** — Planned

**User story** — As an organization administrator, I want to deactivate a queue temporarily and reactivate it later while preserving its setup and history.

### Acceptance criteria

- An administrator can activate or deactivate a queue without deleting it.
- Deactivation prevents new visitor joins and prevents opening a new session. It does not erase or alter sessions, tickets, or history.
- Staff can continue resolving tickets in an already open or paused session according to staff-operation rules; deactivation does not silently close the session.
- Reactivation makes the queue eligible for future joins or session opening when the location and service are also active and the session rules allow it.
- Unauthorized users cannot change activation state by submitting a crafted request.

## AQ-6: Open a manual queue session

**Status** — Planned

**User story** — As an organization administrator or authorized operator, I want to open a session for an active queue so visitors can join and staff can serve a new line.

### Acceptance criteria

- An authorized administrator or operator can open a session only when the queue, its location, and its service are active.
- A session can be opened only if the queue has no open or paused session. A closed session remains historical and does not prevent a later session.
- A new session starts its ticket sequence at 1; each session has an independent sequence.
- Concurrent open requests produce at most one open session. Losing requests receive a clear already-open result and do not create extra sessions.
- The write records the session and its initial state atomically. Retrying a request cannot create a second session for the same operation.
- For queues with recurring schedules, the schedule-specific occurrence rules apply; this manual story does not authorize an extra session alongside an active occurrence.

## AQ-7: Pause and resume a session

**Status** — Planned

**User story** — As an authorized operator or administrator, I want to pause and resume a session so I can temporarily stop visitor signups while continuing to manage the current line.

### Acceptance criteria

- An authorized operator or administrator can pause an open session and resume a paused session.
- A paused session cannot accept new joins. Staff can continue permitted operations on existing tickets under the staff-operation rules.
- Pausing and resuming preserve ticket numbers, ordering, ticket states, and session history.
- Repeated requests that would leave the state unchanged are handled safely and do not create duplicate transition history.
- A closed session cannot be paused or resumed.

## AQ-8: Close a session

**Status** — Planned

**User story** — As an authorized operator or administrator, I want to close a completed session so its final state is preserved and a later operating period can start cleanly.

### Acceptance criteria

- An authorized operator or administrator can close an open or paused session.
- A session cannot be closed while tickets remain in `waiting`, `called`, or `serving` states. Those tickets must first be resolved under the staff-operation rules. Tickets in terminal states, including `no_show`, may remain in the history.
- Closing prevents further joins and ticket transitions for that session, except any explicitly defined administrative correction flow.
- Closure preserves session and ticket history. Existing private tracking pages continue to show their final ticket state.
- A later session is opened explicitly by an authorized user (or through the separate recurring schedule flow) and begins its ticket sequence at 1.
- Conditional state changes prevent a close request racing with a ticket transition from closing a session with active tickets.

## AQ-9: Delete a queue with no session history

**Status** — Planned

**User story** — As an organization administrator, I want to remove a queue that was created by mistake and never operated so obsolete setup and its public link are no longer available.

### Acceptance criteria

- An administrator can delete a queue only if it has never had a session.
- A queue with any session history cannot be deleted; the administrator is directed to deactivate it instead.
- Deletion removes or disables the public link and QR target so it can no longer be used to join.
- The server rechecks authorization and session-history eligibility as part of the delete operation. If session opening races with deletion, at most one operation succeeds and no sessionless deletion can erase a queue that acquired history.
- A failed deletion leaves the queue and related records intact.

## Open product decisions

- **Configuration audit history:** Confirm whether each configuration change must record actor, timestamp, and before/after values. Organization/location administration already calls for audit history; queue changes should align with that policy.
- **Public link revocation:** Confirm whether administrators need a rotate/revoke action for a shared URL. The draft assumes a stable identifier until explicitly revoked or the queue is deleted/deactivated.
- **Session correction:** Define the permitted administrative correction path, if any, after session close. The draft treats closed sessions as immutable for normal staff actions.
- **No-show recall at capacity:** The shared capacity rule makes recalled no-shows active again. Define whether recalling one should be rejected when it would exceed the configured limit, and what message staff see.

## Suggested delivery order

1. Queue listing, creation, editing, and server-side tenant/location authorization.
2. Queue activation, public link/QR display, and unavailable states.
3. Manual session open, pause, resume, and close with D1-safe concurrent transitions.
4. Deletion eligibility and race handling, then integration with visitor signup and staff operations.
