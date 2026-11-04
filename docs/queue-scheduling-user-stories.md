# Queue scheduling for recurring signup and service start

## Goal

Let an organization schedule recurring signup openings and service start times for a queue. Visitors can see the scheduled start for the specific session they join, and staff can prepare for and serve that occurrence under the existing queue rules.

**Behavior reference** — [Phoenix recurring queue signup and service start stories](https://github.com/johnwesonga/kewkew/blob/main/docs/queue-scheduling-user-stories.md). This document carries those product rules into `kewkew-cf` and describes a Cloudflare implementation without requiring Phoenix/Ash modules.

Related stories: [admin queue configuration](admin-queue-configuration-user-stories.md), [visitor flow](visitor-flow-user-stories.md), and [staff operations](staff-admin-flow-user-stories.md).

## Shared rules

- A recurring schedule belongs to a queue. Its times use the queue location's IANA time zone.
- Schedule configuration is a template. Each occurrence is a concrete queue session that records its signup-open time and scheduled service-start timestamp. Tickets refer to that session and show its recorded start time.
- A scheduled service start is an operating time, not an estimated wait or a promise that any individual visitor will be served then.
- A per-occurrence signup cap counts all tickets issued for that occurrence. Completing or cancelling a ticket does not free a slot. This cap is distinct from the queue's active-ticket limit.
- Do not show the configured occurrence cap to visitors. At capacity, show a generic signup-unavailable/full message.
- Schedule edits affect future occurrences. Existing sessions and their tickets retain their recorded scheduled service-start time.
- Queues without a recurring schedule keep the existing manual session-opening flow. An authorized user may optionally set a service-start time when opening a manual session.
- Do not create a second open session for a queue. If the preceding session has not closed by the next scheduled occurrence, do not silently open another; surface the missed occurrence to staff.

## AQ-9: Schedule recurring queue signup and service start

**Status** — Implemented in the Cloudflare rebuild

**User story** — As an organization administrator, I want to schedule recurring signup and service times for a queue so visitors can claim tickets before service begins and staff know when to start calling them.

### Acceptance criteria

- An administrator can configure one or more weekdays, a local signup-open time, a later local service-start time, and an optional per-occurrence ticket cap.
- The schedule uses the queue location's time zone. Invalid weekdays, times, timezone values, or a service start earlier than signup opening are rejected with clear errors.
- At the scheduled signup opening, the system creates or opens one queue-session occurrence and makes public signup available without requiring staff to open it manually.
- Schedule processing is idempotent: retries, reconnects, and application restarts cannot create duplicate sessions or issue duplicate ticket numbers for one occurrence.
- Staff can view the waiting line before service starts, but cannot call the next visitor until the occurrence's service-start time.
- The occurrence cap applies to total tickets issued in that occurrence, does not replenish when tickets become terminal, and is enforced for concurrent join attempts.
- Reaching the cap prevents further joins and presents a generic full/unavailable state to visitors without exposing the cap value.
- Editing a recurring schedule affects future occurrences. Existing sessions and their tickets retain their recorded scheduled service-start time.
- Queues without a recurring schedule retain the current manual session-opening behavior.

**Dependencies** — AQ-1, AQ-2, AQ-6, OLA-4, visitor signup and ticket tracking.

## AQ-10: Set a service start time for a manual queue session

**Status** — Implemented in the Cloudflare rebuild

**User story** — As an organization administrator or authorized staff member opening a manual queue session, I want to optionally set when service is scheduled to start so visitors and staff know the planned start time even when the queue has no recurring schedule.

### Acceptance criteria

- When opening a queue session manually, authorized staff can leave the scheduled service start unset or provide a date and time.
- The entered local date and time is interpreted in the queue location's IANA time zone and stored on that specific session as an unambiguous timestamp.
- Invalid or nonexistent local times are rejected with a clear message. Ambiguous daylight-saving times require an explicit, documented choice by the staff member or a consistent product rule.
- A manual session's scheduled service start is shown on its public queue page and join form before signup, and is retained for tickets issued in that session.
- A manual session with no scheduled start continues to work as it does today and shows no scheduled service-start message.
- Staff can see the session's scheduled start in the live queue view. This story does not prevent staff from calling visitors before that time; start-time gating is scoped to AQ-9 scheduled occurrences.
- Recurring schedules continue to provide the start time for sessions they create. Editing a recurring schedule does not alter existing sessions.
- If a session has a scheduled start, that occurrence value is authoritative for display even if the recurring schedule or location timezone changes later.

### Scope

- Add an optional scheduled service-start timestamp to queue sessions and its migration.
- Add the field to the manual session-opening flow, validate it in the location timezone, and persist it atomically with session creation.
- Include the session value in public queue, join, ticket tracking, and staff live queue views.
- Keep recurring queue configuration separate. AQ-9 schedule values are templates for future occurrences; AQ-10's session timestamp is the value for one concrete occurrence.

### Out of scope

- Automatically opening sessions or scheduling background jobs; covered by AQ-9.
- Preventing staff from calling visitors before a manual session's scheduled start.
- Changing ticket order, estimates, or queue capacity behavior.
- A start time attached to the reusable service or queue without a specific session date.

**Dependencies** — AQ-1, AQ-2, AQ-9, visitor signup and ticket tracking.

**AQ-10 implementation note** — Manual session opening accepts an optional local date and time and resolves it with the queue location's timezone. Nonexistent daylight-saving times are rejected. When the local time is ambiguous, the earlier instant is selected, matching AQ-9's documented rule. The resolved instant is stored in the session's `scheduled_service_start_at` field, which was added for recurring occurrences; ticket tracking reads that session value. The public queue page, private ticket page, and staff board format the stored instant in the location timezone. Manual sessions remain callable before this time.

## VF-11: See when queue service is scheduled to begin

**Status** — Planned

**User story** — As a visitor considering or joining a scheduled queue, I want to see when service is scheduled to begin so I can decide whether to join and when to arrive.

### Acceptance criteria

- Before joining, the public queue page and join form show the next occurrence's service-start weekday, date, time, and location timezone.
- After joining, confirmation and the private tracking page show the service-start time recorded for that ticket's occurrence, even if the recurring schedule is later edited.
- The time is formatted using the location's timezone and is clearly labeled as the scheduled service start, not a personal wait estimate.
- If signup is not open yet, show when it opens. If the occurrence is full or unavailable, explain that visitors cannot join without revealing the configured cap.
- A stale page cannot create a ticket for an occurrence that has closed or reached its cap; the visitor receives a clear unavailable message.

**Dependencies** — AQ-9; VF-1, VF-2, VF-4, VF-5, VF-6, and VF-7.

## Initial policy decisions

- Signup opens at the configured local time. It remains available after service begins until the occurrence reaches its cap or staff close it under the existing queue-session rules. A separate signup-close time is out of scope for this first slice.
- Service-start times are recurring wall-clock times in the location timezone. Daylight-saving changes follow the timezone database rules for that local date; repeated times use the earlier instant and nonexistent times move to the first valid minute after the gap.
- If a prior session has not been closed by the next scheduled occurrence, the system must not silently create a second open session. Surface the missed occurrence to staff for resolution.
- The business must decide how staff close an occurrence with unserved visitors before production scheduling is enabled; current queue-session close rules require active tickets to be resolved first.

## Cloudflare implementation shape

**AQ-9 implementation note** — Recurring schedules are configured by organization administrators from each queue's Schedule page. The Worker cron runs once per minute and reconciles enabled schedules by location-local date; queue sessions store the schedule version, local occurrence key, persisted UTC signup opening and service start, and the lifetime ticket cap. Reconciliation uses a unique `(schedule_id, occurrence_key)` index and inserts a closed `blocked` occurrence when an existing session prevents opening. The staff queue list surfaces these blocked dates. Ticket allocation conditionally checks both current active-ticket capacity and total issued tickets for that session in the same D1 batch that allocates the session's ticket counters. Staff call-next writes check the stored scheduled service-start timestamp; manual sessions remain unaffected.

For daylight-saving resolution, repeated local times select the earlier UTC instant. Nonexistent local times move forward to the first valid local minute after the gap. This policy is applied when resolving an occurrence and the resolved UTC timestamps are persisted on its session.

### Data model

- Add a `queue_schedules` table keyed to a queue, holding enabled state, weekday selection, local signup-open time, local service-start time, optional per-occurrence cap, version, and audit metadata. The time zone is read from the queue's location so configuration follows the shared product rule.
- Add a concrete occurrence representation. Prefer extending the existing queue session with an occurrence key, signup-open timestamp, and scheduled service-start timestamp; add a schedule ID/version reference if needed to identify the template version. This avoids creating a parallel session abstraction and lets existing tickets reference the same session.
- Enforce uniqueness for `(schedule_id, occurrence_key)` and retain the existing partial unique invariant allowing at most one current (`open` or `paused`) session for a queue.
- Store UTC instants consistently with the existing schema. Keep the occurrence's resolved service-start instant fixed after session creation, even if schedule or location configuration later changes.
- Enforce per-occurrence capacity atomically with ticket allocation. Use a conditional increment/counter or equivalent D1-safe conditional write in the same transaction/batch as ticket creation. Do not derive lifetime issued count from active ticket states because terminal tickets continue consuming slots.

### Scheduled Worker and D1 flow

1. Configure a Cloudflare Cron Trigger to run reconciliation regularly. Cron is a trigger, not a precise alarm; signup availability is determined from persisted timestamps and current time, not the exact arrival time of the cron event.
2. Find enabled schedules with an occurrence due to open, compute the local occurrence date/time using the queue location's IANA timezone, and resolve it to UTC. Document and implement a deterministic rule for ambiguous/nonexistent local times.
3. Insert or find the occurrence using its unique key. In a conditional D1 transaction/batch, create/open exactly one session only when the queue, location, and service are active and there is no current session. Store the schedule's service-start instant on the session.
4. Retries return the existing occurrence/session. If another open or paused session blocks the occurrence, record it as missed/blocked for staff and do not open it later as a stale session.
5. At join time, the server verifies that the session is the current eligible occurrence and the signup opening has passed; it atomically verifies both queue active-ticket capacity and lifetime tickets issued for the occurrence before creating the ticket, initial history event, tracking credential, and browser claim.
6. For scheduled occurrences, staff `call next` and related call transitions are rejected until the stored service-start timestamp is reached. Validate this in the server-side conditional transition, not only by hiding the button. Manual sessions retain their existing call behavior regardless of an optional AQ-10 display timestamp.
7. Public availability and all joins enforce session closure and occurrence capacity without depending on a cron job to close signup. Staff reads show the line before service begins and the scheduled milestone.

Keep the scheduled handler idempotent and bounded. Process a limited batch and let later invocations continue recovery. D1 remains the authority; add Cloudflare Queues only if measured reconciliation workload requires it. Notifications and real-time synchronization remain separate work.

### Authorization and user interface

- Restrict recurring schedule creation/editing to authorized administrators, scoped to their organization and queue location.
- The manual session-opening action remains available to authorized administrators and assigned operators and accepts the optional AQ-10 local date/time.
- Show the next service-start date/time and timezone on the public queue page and join form. Show signup opening when not yet available and a generic unavailable message when full.
- Persist and display the session's service-start value in join confirmation and private ticket tracking; include it in staff live queue reads.
- Keep the public queue identifier stable across occurrences. Continue using opaque visitor tracking credentials; never use schedule or session database IDs as authorization tokens.

## Suggested implementation slices

1. Add recurring schedule configuration and administrator validation for a queue.
2. Add the session scheduled-start field, optional manual-entry flow, and location-timezone validation (AQ-10).
3. Create idempotent scheduled session occurrences, enforce per-occurrence caps, and gate staff calling until service start (AQ-9).
4. Show next-occurrence time in public discovery and join screens; persist and display the occurrence start on tickets and tracking pages (VF-11).
5. Add focused tests for timezone boundaries, scheduler retries, concurrent signup at capacity, stale pages, and queue-session state transitions.

## Rollout dependency

Before enabling recurring schedules for a business, define how staff close an occurrence with unserved visitors. The current AQ-8 rule requires active tickets to be resolved before close; scheduling must surface a blocked next occurrence rather than override that rule.
