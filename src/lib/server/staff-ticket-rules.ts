export type StaffTicketStatus = 'waiting' | 'called' | 'serving' | 'completed' | 'cancelled' | 'no_show';
export type StaffTicketCommand = 'call' | 'start_serving' | 'complete' | 'skip' | 'cancel' | 'recall';

const activeStatuses = new Set<StaffTicketStatus>(['waiting', 'called', 'serving']);

export function resolveStaffTicketTransition(
	status: StaffTicketStatus,
	command: StaffTicketCommand
): StaffTicketStatus | null {
	if (command === 'call' && status === 'waiting') return 'called';
	if (command === 'start_serving' && status === 'called') return 'serving';
	if (command === 'complete' && status === 'serving') return 'completed';
	if (command === 'skip' && status === 'called') return 'no_show';
	if (command === 'cancel' && (status === 'waiting' || status === 'called')) return 'cancelled';
	if (command === 'recall' && status === 'no_show') return 'waiting';
	return null;
}

export function isActiveStaffTicket(status: StaffTicketStatus): boolean {
	return activeStatuses.has(status);
}

export function selectNextWaitingTicket<T extends { status: StaffTicketStatus; queueSequence: number }>(
	tickets: readonly T[]
): T | null {
	let next: T | null = null;
	for (const ticket of tickets) {
		if (ticket.status !== 'waiting') continue;
		if (!next || ticket.queueSequence < next.queueSequence) next = ticket;
	}
	return next;
}

export function canCallNext(
	sessionState: 'open' | 'paused' | 'closed' | null,
	tickets: readonly { status: StaffTicketStatus }[]
): boolean {
	return (sessionState === 'open' || sessionState === 'paused') && tickets.some((ticket) => ticket.status === 'waiting');
}

export function canStartServing(status: StaffTicketStatus): boolean {
	return resolveStaffTicketTransition(status, 'start_serving') === 'serving';
}

export function canCompleteService(status: StaffTicketStatus): boolean {
	return resolveStaffTicketTransition(status, 'complete') === 'completed';
}

export function canSkipTicket(status: StaffTicketStatus): boolean {
	return resolveStaffTicketTransition(status, 'skip') === 'no_show';
}

export function canRecallTicket(status: StaffTicketStatus): boolean {
	return resolveStaffTicketTransition(status, 'recall') === 'waiting';
}

export function recallQueueSequence(nextQueueSequence: number): number | null {
	if (!Number.isSafeInteger(nextQueueSequence) || nextQueueSequence < 1) return null;
	return nextQueueSequence;
}
