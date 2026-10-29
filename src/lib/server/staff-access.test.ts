import { describe, expect, it } from 'vitest';
import { filterStaffQueues } from './staff-access';

const queues = [
	{ id: 'admin-east', organizationId: 'org-a', locationId: 'east' },
	{ id: 'admin-west', organizationId: 'org-a', locationId: 'west' },
	{ id: 'other-org-east', organizationId: 'org-b', locationId: 'east' }
];

describe('filterStaffQueues', () => {
	it('shows an active administrator all queues in their organization only', () => {
		expect(filterStaffQueues(queues, {
			organizationId: 'org-a', role: 'admin', status: 'active', locationIds: []
		}).map((queue) => queue.id)).toEqual(['admin-east', 'admin-west']);
	});

	it('shows an active operator queues only at assigned locations', () => {
		expect(filterStaffQueues(queues, {
			organizationId: 'org-a', role: 'operator', status: 'active', locationIds: ['west']
		}).map((queue) => queue.id)).toEqual(['admin-west']);
	});

	it('does not allow a shared location identifier to cross organization boundaries', () => {
		expect(filterStaffQueues(queues, {
			organizationId: 'org-a', role: 'operator', status: 'active', locationIds: ['east']
		}).map((queue) => queue.id)).toEqual(['admin-east']);
	});

	it('returns no queues for missing or suspended membership', () => {
		expect(filterStaffQueues(queues, null)).toEqual([]);
		expect(filterStaffQueues(queues, {
			organizationId: 'org-a', role: 'admin', status: 'suspended', locationIds: []
		})).toEqual([]);
	});
});
