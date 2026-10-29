export type QueueIdentityPolicy = 'anonymous' | 'name_required';

export type QueueConfiguration = {
	name: string;
	identityPolicy: QueueIdentityPolicy;
	activeTicketCapacity: number | null;
};

export type QueueConfigurationResult =
	| { valid: true; value: QueueConfiguration }
	| { valid: false; message: string };

export function validateQueueConfiguration(input: {
	name: string;
	identityPolicy: string;
	capacityInput: string;
}): QueueConfigurationResult {
	const name = input.name.trim();
	const capacityInput = input.capacityInput.trim();
	if (!name || name.length > 160) {
		return { valid: false, message: 'Enter a queue name between 1 and 160 characters.' };
	}
	if (input.identityPolicy !== 'anonymous' && input.identityPolicy !== 'name_required') {
		return { valid: false, message: 'Choose a valid visitor identity policy.' };
	}
	if (capacityInput && (!/^[1-9]\d*$/.test(capacityInput) || !Number.isSafeInteger(Number(capacityInput)))) {
		return { valid: false, message: 'Capacity must be a positive whole number, or leave it blank for unlimited capacity.' };
	}
	return {
		valid: true,
		value: {
			name,
			identityPolicy: input.identityPolicy,
			activeTicketCapacity: capacityInput ? Number(capacityInput) : null
		}
	};
}

export type QueueSessionState = 'open' | 'paused' | 'closed';
export type QueueSessionCommand = 'pause' | 'resume' | 'close';

export function resolveSessionTransition(
	currentState: QueueSessionState,
	command: QueueSessionCommand
): { nextState: QueueSessionState; changed: boolean } | null {
	if (currentState === 'closed') return null;
	const nextState: QueueSessionState = command === 'pause'
		? 'paused'
		: command === 'resume'
			? 'open'
			: 'closed';
	return { nextState, changed: currentState !== nextState };
}

export function canOpenQueueSession(queueActive: number, locationActive: number, serviceActive: number): boolean {
	return queueActive === 1 && locationActive === 1 && serviceActive === 1;
}
