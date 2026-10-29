import { describe, expect, it } from 'vitest';
import { presentStaffQueueBoard } from './staff-queue-board';

const ticket = (overrides: Partial<Parameters<typeof presentStaffQueueBoard>[1][number]> = {}) => ({
	id: 'ticket', ticketNumber: 7, queueSequence: 7, status: 'waiting' as const,
	identityPolicy: 'name_required' as const, firstName: 'Ada', lastName: 'Lovelace', ...overrides
});

describe('presentStaffQueueBoard', () => {
	it('orders active tickets by stable queue sequence and excludes terminal tickets', () => {
		const board = presentStaffQueueBoard('open', [
			ticket({ id: 'later', queueSequence: 9 }),
			ticket({ id: 'completed', status: 'completed', queueSequence: 1 }),
			ticket({ id: 'first', queueSequence: 2, status: 'called' })
		]);

		expect(board.tickets.map(({ id }) => id)).toEqual(['first', 'later']);
	});

	it('shows a visitor name only when the ticket uses the name-required identity policy', () => {
		const board = presentStaffQueueBoard('open', [
			ticket({ id: 'named' }),
			ticket({ id: 'anonymous', identityPolicy: 'anonymous' })
		]);

		expect(board.tickets[0]).toMatchObject({ firstName: 'Ada', lastName: 'Lovelace' });
		expect(board.tickets[1]).toMatchObject({ firstName: null, lastName: null });
	});

	it.each([
		['open', 'No visitors are currently waiting.'],
		['paused', 'This queue is paused. No visitors are currently waiting.'],
		['closed', 'This queue session is closed.'],
		[null, 'There is no active queue session.']
	] as const)('distinguishes an empty %s queue', (state, message) => {
		expect(presentStaffQueueBoard(state, []).emptyMessage).toBe(message);
	});
});
