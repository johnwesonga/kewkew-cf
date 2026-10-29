export type StaffOrganizationRole = 'admin' | 'operator';

export type StaffQueueMembership = {
	organizationId: string;
	role: StaffOrganizationRole;
	status: 'active' | 'suspended';
	locationIds: readonly string[];
};

export type StaffQueueScope = { organizationId: string; locationId: string };

export function filterStaffQueues<T extends StaffQueueScope>(
	queues: readonly T[],
	membership: StaffQueueMembership | null
): T[] {
	if (!membership || membership.status !== 'active') return [];
	return queues.filter((queue) =>
		queue.organizationId === membership.organizationId &&
		(membership.role === 'admin' || membership.locationIds.includes(queue.locationId))
	);
}
