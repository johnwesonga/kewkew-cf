export async function digestCredential(value: string): Promise<string> {
	const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function generateCredential(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function isValidCredential(value: string): boolean {
	if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return false;
	try {
		const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '=';
		return atob(base64).length === 32;
	} catch {
		return false;
	}
}
