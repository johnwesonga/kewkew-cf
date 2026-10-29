import { describe, expect, it } from 'vitest';
import { canOpenQueueSession, resolveSessionTransition, validateQueueConfiguration } from './queue-rules';

describe('validateQueueConfiguration', () => {
	it('trims and accepts a valid anonymous queue with unlimited capacity', () => {
		expect(validateQueueConfiguration({ name: '  Main line  ', identityPolicy: 'anonymous', capacityInput: '' }))
			.toEqual({
				valid: true,
				value: { name: 'Main line', identityPolicy: 'anonymous', activeTicketCapacity: null }
			});
	});

	it('accepts name-required queues and a positive integer capacity', () => {
		expect(validateQueueConfiguration({ name: 'Appointments', identityPolicy: 'name_required', capacityInput: '25' }))
			.toEqual({
				valid: true,
				value: { name: 'Appointments', identityPolicy: 'name_required', activeTicketCapacity: 25 }
			});
	});

	it.each(['', '   ', 'a'.repeat(161)])('rejects invalid queue names (%j)', (name) => {
		const result = validateQueueConfiguration({ name, identityPolicy: 'anonymous', capacityInput: '' });

		expect(result).toEqual({ valid: false, message: 'Enter a queue name between 1 and 160 characters.' });
	});

	it('rejects unsupported identity policies', () => {
		expect(validateQueueConfiguration({ name: 'Main', identityPolicy: 'email_required', capacityInput: '' }))
			.toEqual({ valid: false, message: 'Choose a valid visitor identity policy.' });
	});

	it.each(['0', '-1', '1.5', '1e3', '01', '9007199254740992'])('rejects invalid capacity %s', (capacityInput) => {
		const result = validateQueueConfiguration({ name: 'Main', identityPolicy: 'anonymous', capacityInput });

		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.message).toMatch(/positive whole number/i);
	});
});

describe('canOpenQueueSession', () => {
	it('requires the queue, location, and service to be active', () => {
		expect(canOpenQueueSession(1, 1, 1)).toBe(true);
		expect(canOpenQueueSession(0, 1, 1)).toBe(false);
		expect(canOpenQueueSession(1, 0, 1)).toBe(false);
		expect(canOpenQueueSession(1, 1, 0)).toBe(false);
	});
});

describe('resolveSessionTransition', () => {
	it.each([
		['open', 'pause', 'paused'],
		['paused', 'resume', 'open'],
		['open', 'close', 'closed'],
		['paused', 'close', 'closed']
	] as const)('allows %s -> %s', (current, command, next) => {
		expect(resolveSessionTransition(current, command)).toEqual({ nextState: next, changed: true });
	});

	it.each([
		['open', 'resume'],
		['paused', 'pause']
	] as const)('treats repeated %s/%s commands as unchanged', (current, command) => {
		expect(resolveSessionTransition(current, command)).toEqual({ nextState: current, changed: false });
	});

	it.each(['pause', 'resume', 'close'] as const)('rejects %s after a session is closed', (command) => {
		expect(resolveSessionTransition('closed', command)).toBeNull();
	});
});
