export type VisitorTicketStatus = 'waiting' | 'called' | 'serving' | 'completed' | 'cancelled' | 'no_show';

export function getVisitorTicketPosition(status: VisitorTicketStatus, queuePosition: number): number {
	return status === 'serving' ? 1 : queuePosition;
}

export function getVisitorTicketPresentation(
	status: VisitorTicketStatus,
	ticketNumber: number,
	serviceName: string
) {
	const base = {
		waiting: { label: 'Waiting', message: 'Please wait until staff call your ticket number.' },
		called: {
			label: 'Your turn is now',
			message: `Please go to the service desk for ${serviceName} and show ticket number ${ticketNumber}.`
		},
		serving: { label: 'You are being served', message: 'Your service is in progress.' },
		completed: { label: 'Complete', message: 'Your service is complete. Thank you for visiting.' },
		cancelled: { label: 'Cancelled', message: 'This ticket was cancelled. Please speak with staff if you need help.' },
		no_show: { label: 'Marked as no-show', message: 'Staff marked this ticket as no-show. Please speak with staff for next steps.' }
	}[status];

	return {
		...base,
		isCalled: status === 'called',
		showPosition: status === 'waiting' || status === 'called' || status === 'serving',
		shouldPoll: status === 'waiting' || status === 'called' || status === 'serving' || status === 'no_show'
	};
}
