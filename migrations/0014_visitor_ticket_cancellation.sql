CREATE UNIQUE INDEX ticket_events_visitor_cancel_once
	ON ticket_events (ticket_id)
	WHERE from_status = 'waiting' AND to_status = 'cancelled' AND actor_type = 'visitor';
