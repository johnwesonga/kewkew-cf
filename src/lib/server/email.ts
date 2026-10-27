type InvitationEmail = {
	apiKey: string;
	from: string;
	to: string;
	subject: string;
	text: string;
	html: string;
	idempotencyKey: string;
};

export async function sendInvitationEmail(message: InvitationEmail): Promise<void> {
	const response = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${message.apiKey}`,
			'Content-Type': 'application/json',
			'Idempotency-Key': `staff-invitation/${message.idempotencyKey}`
		},
		body: JSON.stringify({
			from: message.from,
			to: [message.to],
			subject: message.subject,
			text: message.text,
			html: message.html
		})
	});

	if (!response.ok) throw new Error(`Resend email request failed with status ${response.status}`);
}
