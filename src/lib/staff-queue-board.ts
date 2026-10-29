export type StaffQueueBoardSessionState = 'open' | 'paused' | 'closed' | null;

export type StaffQueueBoardTicket = {
	id: string;
	ticketNumber: number;
	queueSequence: number;
	status: 'waiting' | 'called' | 'serving' | 'completed' | 'cancelled' | 'no_show';
	identityPolicy: 'anonymous' | 'name_required';
	firstName: string | null;
	lastName: string | null;
};

export function presentStaffQueueBoard(
	sessionState: StaffQueueBoardSessionState,
	tickets: readonly StaffQueueBoardTicket[]
) {
	const activeTickets = tickets
		.filter((ticket) => ['waiting', 'called', 'serving'].includes(ticket.status))
		.slice()
		.sort((a, b) => a.queueSequence - b.queueSequence)
		.map((ticket) => ({
			...ticket,
			firstName: ticket.identityPolicy === 'name_required' ? ticket.firstName : null,
			lastName: ticket.identityPolicy === 'name_required' ? ticket.lastName : null
		}));

	return {
		tickets: activeTickets,
		emptyMessage: activeTickets.length > 0
			? null
			: sessionState === 'paused'
				? 'This queue is paused. No visitors are currently waiting.'
				: sessionState === 'closed'
					? 'This queue session is closed.'
					: sessionState === 'open'
						? 'No visitors are currently waiting.'
						: 'There is no active queue session.'
	};
}
