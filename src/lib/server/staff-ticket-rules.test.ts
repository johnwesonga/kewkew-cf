import { describe, expect, it } from 'vitest';
import {
	canCallNext,
	isActiveStaffTicket,
	recallQueueSequence,
	resolveStaffTicketTransition,
	selectNextWaitingTicket
} from './staff-ticket-rules';

describe('resolveStaffTicketTransition', () => {
	it.each([
		['waiting', 'call', 'called'],
		['called', 'start_serving', 'serving'],
		['serving', 'complete', 'completed'],
		['called', 'skip', 'no_show'],
		['waiting', 'cancel', 'cancelled'],
		['called', 'cancel', 'cancelled'],
		['no_show', 'recall', 'waiting']
	] as const)('%s + %s transitions to %s', (status, command, expected) => {
		expect(resolveStaffTicketTransition(status, command)).toBe(expected);
	});

	it.each([
		['waiting', 'start_serving'], ['waiting', 'complete'], ['waiting', 'skip'], ['waiting', 'recall'],
		['called', 'call'], ['called', 'complete'], ['called', 'recall'],
		['serving', 'call'], ['serving', 'start_serving'], ['serving', 'skip'], ['serving', 'cancel'], ['serving', 'recall'],
		['completed', 'call'], ['completed', 'start_serving'], ['completed', 'complete'], ['completed', 'skip'], ['completed', 'cancel'], ['completed', 'recall'],
		['cancelled', 'call'], ['cancelled', 'start_serving'], ['cancelled', 'complete'], ['cancelled', 'skip'], ['cancelled', 'cancel'], ['cancelled', 'recall'],
		['no_show', 'call'], ['no_show', 'start_serving'], ['no_show', 'complete'], ['no_show', 'skip'], ['no_show', 'cancel']
	] as const)('rejects %s + %s', (status, command) => {
		expect(resolveStaffTicketTransition(status, command)).toBeNull();
	});
});

describe('isActiveStaffTicket', () => {
	it.each(['waiting', 'called', 'serving'] as const)('counts %s as active', (status) => {
		expect(isActiveStaffTicket(status)).toBe(true);
	});

	it.each(['completed', 'cancelled', 'no_show'] as const)('does not count %s as active', (status) => {
		expect(isActiveStaffTicket(status)).toBe(false);
	});
});

describe('selectNextWaitingTicket', () => {
	it('selects the waiting ticket with the lowest queue sequence', () => {
		const waitingLater = { id: 'later', status: 'waiting' as const, queueSequence: 8 };
		const calledEarlier = { id: 'called', status: 'called' as const, queueSequence: 2 };
		const waitingNext = { id: 'next', status: 'waiting' as const, queueSequence: 5 };

		expect(selectNextWaitingTicket([waitingLater, calledEarlier, waitingNext])).toBe(waitingNext);
	});

	it('returns null when nobody is waiting', () => {
		expect(selectNextWaitingTicket([
			{ status: 'called', queueSequence: 1 },
			{ status: 'serving', queueSequence: 2 }
		])).toBeNull();
	});
});

describe('canCallNext', () => {
	it.each(['open', 'paused'] as const)('allows calling when a %s session has a waiting ticket', (state) => {
		expect(canCallNext(state, [{ status: 'waiting' }])).toBe(true);
	});

	it.each(['closed', null] as const)('disables calling when the session is %s', (state) => {
		expect(canCallNext(state, [{ status: 'waiting' }])).toBe(false);
	});

	it('disables calling when no ticket is waiting', () => {
		expect(canCallNext('open', [{ status: 'called' }])).toBe(false);
	});
});

describe('recallQueueSequence', () => {
	it('assigns the current next sequence to a recalled ticket', () => {
		expect(recallQueueSequence(12)).toBe(12);
	});

	it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid next sequence %s', (sequence) => {
		expect(recallQueueSequence(sequence)).toBeNull();
	});
});
