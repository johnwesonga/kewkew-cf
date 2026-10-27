export const supportedTimezones = [
	'America/Los_Angeles',
	'US/Mountain',
	'America/New_York',
	'Africa/Nairobi'
] as const;

export function isValidIanaTimezone(timezone: string): boolean {
	if (!timezone || timezone.length > 100) return false;

	try {
		new Intl.DateTimeFormat('en-US', { timeZone: timezone });
		return true;
	} catch {
		return false;
	}
}
