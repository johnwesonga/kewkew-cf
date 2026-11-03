import { describe, expect, it } from 'vitest';
import { canRunInitialSetup, validateInitialSetup } from './setup-validation';

const validInput = {
	organizationName: 'Riverside Community Hub',
	locationName: 'Riverside',
	timezone: 'America/Los_Angeles',
	adminName: 'Jordan Lee',
	email: 'ADMIN@EXAMPLE.COM ',
	password: 'correct-horse'
};

describe('validateInitialSetup', () => {
	it('trims names, normalizes email, and accepts supported timezone and password', () => {
		expect(validateInitialSetup({
			...validInput,
			organizationName: ' Riverside Community Hub ',
			locationName: ' Riverside ',
			adminName: ' Jordan Lee '
		})).toEqual({
			valid: true,
			value: {
				organizationName: 'Riverside Community Hub',
				locationName: 'Riverside',
				timezone: 'America/Los_Angeles',
				adminName: 'Jordan Lee',
				email: 'admin@example.com',
				password: 'correct-horse'
			}
		});
	});

	it.each([
		{ organizationName: '' },
		{ organizationName: 'x'.repeat(161) },
		{ locationName: ' ' },
		{ locationName: 'x'.repeat(161) },
		{ adminName: '' },
		{ adminName: 'x'.repeat(161) },
		{ email: 'not-an-email' },
		{ password: 'short' },
		{ password: 'p'.repeat(129) }
	])('rejects invalid account or organization details %#', (override) => {
		const result = validateInitialSetup({ ...validInput, ...override });

		expect(result).toEqual({
			valid: false,
			message: 'Enter valid organization, location, and administrator details.'
		});
	});

	it('rejects timezones outside the supported setup list', () => {
		expect(validateInitialSetup({ ...validInput, timezone: 'Mars/Olympus_Mons' })).toEqual({
			valid: false,
			message: 'Select a supported location timezone.'
		});
	});

	it.each([8, 128])('accepts a password with %i characters', (length) => {
		expect(validateInitialSetup({ ...validInput, password: 'p'.repeat(length) }).valid).toBe(true);
	});
});

describe('canRunInitialSetup', () => {
	it('allows setup only when the installation marker exists and is uninitialized', () => {
		expect(canRunInitialSetup(null)).toBe(true);
		expect(canRunInitialSetup(undefined)).toBe(false);
		expect(canRunInitialSetup('2026-11-03T12:00:00.000Z')).toBe(false);
	});
});
