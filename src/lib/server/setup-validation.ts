import { supportedTimezones } from '#lib/timezones';

export type InitialSetupInput = {
	organizationName: string;
	locationName: string;
	timezone: string;
	adminName: string;
	email: string;
	password: string;
};

export type InitialSetupDetails = {
	organizationName: string;
	locationName: string;
	timezone: string;
	adminName: string;
	email: string;
	password: string;
};

export function canRunInitialSetup(initializedAt: string | null | undefined): boolean {
	return initializedAt === null;
}

export function validateInitialSetup(input: InitialSetupInput):
	| { valid: true; value: InitialSetupDetails }
	| { valid: false; message: string } {
	const value = {
		organizationName: input.organizationName.trim(),
		locationName: input.locationName.trim(),
		timezone: input.timezone.trim(),
		adminName: input.adminName.trim(),
		email: input.email.trim().toLowerCase(),
		password: input.password
	};

	if (
		!value.organizationName || value.organizationName.length > 160 ||
		!value.locationName || value.locationName.length > 160 ||
		!value.adminName || value.adminName.length > 160 ||
		!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.email) ||
		value.password.length < 8 || value.password.length > 128
	) {
		return { valid: false, message: 'Enter valid organization, location, and administrator details.' };
	}

	if (!supportedTimezones.includes(value.timezone as (typeof supportedTimezones)[number])) {
		return { valid: false, message: 'Select a supported location timezone.' };
	}

	return { valid: true, value };
}
