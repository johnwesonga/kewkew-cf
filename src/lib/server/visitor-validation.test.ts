import { describe, expect, it } from 'vitest';
import { validateVisitorIdentity } from './visitor-validation';
import { digestCredential, generateCredential, isValidCredential } from './visitor-credential';

describe('validateVisitorIdentity', () => {
	it('allows anonymous signup without collecting names', () => {
		expect(validateVisitorIdentity('anonymous', '', ''))
			.toEqual({ valid: true, firstName: null, lastName: null });
	});

	it('rejects names supplied to an anonymous queue', () => {
		const result = validateVisitorIdentity('anonymous', 'Ari', 'Lee');

		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.message).toMatch(/does not collect names/i);
	});

	it('trims names for a name-required queue', () => {
		expect(validateVisitorIdentity('name_required', '  Ari ', ' Lee  '))
			.toEqual({ valid: true, firstName: 'Ari', lastName: 'Lee' });
	});

	it('reports each missing required name field', () => {
		expect(validateVisitorIdentity('name_required', 'Ari', '  '))
			.toEqual({ valid: false, message: 'Enter both your first and last name.', fieldErrors: { lastName: 'Enter your last name.' } });
	});

	it('enforces the maximum field length after trimming', () => {
		const result = validateVisitorIdentity('name_required', 'A'.repeat(101), 'Lee');

		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.fieldErrors.firstName).toBe('Use 100 characters or fewer.');
	});
});

describe('private tracking credentials', () => {
	it('generates a 32-byte URL-safe credential', () => {
		const credential = generateCredential();

		expect(credential).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(isValidCredential(credential)).toBe(true);
	});

	it('rejects malformed credentials', () => {
		expect(isValidCredential('ticket-123')).toBe(false);
		expect(isValidCredential('A'.repeat(42))).toBe(false);
		expect(isValidCredential('A'.repeat(43) + '!')).toBe(false);
	});

	it('stores credentials as SHA-256 digests rather than raw tokens', async () => {
		const credential = 'A'.repeat(43);
		const digest = await digestCredential(credential);

		expect(digest).toMatch(/^[a-f0-9]{64}$/);
		expect(digest).not.toBe(credential);
	});
});
