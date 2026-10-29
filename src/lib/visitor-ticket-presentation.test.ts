import { describe, expect, it } from 'vitest';
import { getVisitorTicketPresentation } from './visitor-ticket-presentation';

describe('getVisitorTicketPresentation', () => {
	it('gives called tickets a direct, ticket-specific service desk instruction', () => {
		expect(getVisitorTicketPresentation('called', 27, 'Dental care')).toEqual({
			label: 'Your turn is now',
			message: 'Please go to the service desk for Dental care and show ticket number 27.',
			isCalled: true,
			showPosition: true,
			shouldPoll: true
		});
	});

	it('shows no-show as distinct from serving and completion', () => {
		const noShow = getVisitorTicketPresentation('no_show', 27, 'Dental care');
		expect(noShow.label).toBe('Marked as no-show');
		expect(noShow.message).toMatch(/no-show/i);
		expect(noShow.showPosition).toBe(false);
		expect(noShow.shouldPoll).toBe(true);
		expect(getVisitorTicketPresentation('serving', 27, 'Dental care').label).toBe('You are being served');
		expect(getVisitorTicketPresentation('completed', 27, 'Dental care').label).toBe('Complete');
	});

	it.each(['waiting', 'called', 'serving'] as const)('shows position and refreshes while %s', (status) => {
		const presentation = getVisitorTicketPresentation(status, 27, 'Dental care');
		expect(presentation.showPosition).toBe(true);
		expect(presentation.shouldPoll).toBe(true);
	});

	it.each(['completed', 'cancelled'] as const)('stops refreshing and hides position for %s', (status) => {
		const presentation = getVisitorTicketPresentation(status, 27, 'Dental care');
		expect(presentation.showPosition).toBe(false);
		expect(presentation.shouldPoll).toBe(false);
	});
});
