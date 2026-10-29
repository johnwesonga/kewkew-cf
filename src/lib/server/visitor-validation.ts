export type VisitorIdentityPolicy = 'anonymous' | 'name_required';

export type VisitorIdentityValidation =
	| { valid: true; firstName: string | null; lastName: string | null }
	| { valid: false; message: string; fieldErrors: { firstName?: string; lastName?: string } };

export function validateVisitorIdentity(
	policy: VisitorIdentityPolicy,
	firstNameInput: string,
	lastNameInput: string,
	maxLength = 100
): VisitorIdentityValidation {
	const firstName = firstNameInput.trim();
	const lastName = lastNameInput.trim();

	if (policy === 'anonymous') {
		if (firstName || lastName) {
			return { valid: false, message: 'This queue does not collect names. Refresh the page and try again.', fieldErrors: {} };
		}
		return { valid: true, firstName: null, lastName: null };
	}

	const fieldErrors: { firstName?: string; lastName?: string } = {};
	if (!firstName) fieldErrors.firstName = 'Enter your first name.';
	else if (firstName.length > maxLength) fieldErrors.firstName = `Use ${maxLength} characters or fewer.`;
	if (!lastName) fieldErrors.lastName = 'Enter your last name.';
	else if (lastName.length > maxLength) fieldErrors.lastName = `Use ${maxLength} characters or fewer.`;

	if (Object.keys(fieldErrors).length) {
		return {
			valid: false,
			message: !firstName || !lastName ? 'Enter both your first and last name.' : 'Names must be 100 characters or fewer.',
			fieldErrors
		};
	}
	return { valid: true, firstName, lastName };
}
