<script lang="ts">
	import { onMount } from 'svelte';
	import QRCode from 'qrcode';

	let { publicId, queueName, expanded = false }: { publicId: string; queueName: string; expanded?: boolean } = $props();
	let canvas: HTMLCanvasElement;
	let message = $state('');
	let publicUrl = $state('');
	let qrReady = $state(false);

	onMount(() => {
		if (!/^[0-9a-f]{32}$/i.test(publicId)) {
			message = 'The public queue link is unavailable. Refresh the page and try again.';
			return;
		}
		publicUrl = new URL(`/q/${publicId}`, window.location.origin).toString();
		QRCode.toCanvas(canvas, publicUrl, {
			width: 240,
			margin: 2,
			errorCorrectionLevel: 'Q',
			color: { dark: '#173b2a', light: '#ffffff' }
		}, (error) => {
			if (error) message = 'The QR code could not be generated.';
			else qrReady = true;
		});
	});

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(publicUrl);
			message = 'Queue link copied.';
		} catch {
			message = 'Copy is unavailable here. Select and copy the link above.';
		}
	}

	function downloadQr() {
		if (!qrReady) return;
		const download = document.createElement('a');
		download.href = canvas.toDataURL('image/png');
		download.download = 'kewkew-queue-qr.png';
		download.click();
	}
</script>

<details class="queue-share-details" class:expanded open={expanded}>
	<summary>Share link &amp; QR</summary>
	<div class="queue-share-panel">
		<p>Reusable link for <strong>{queueName}</strong></p>
		{#if publicUrl}
			<a class="queue-public-url" href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>
		{:else}
			<p class="queue-share-message" role="status">{message || 'Preparing public link…'}</p>
		{/if}
		<canvas bind:this={canvas} aria-label={`QR code for ${queueName}`}>QR code for {queueName}</canvas>
		<div class="queue-share-actions">
			<button type="button" onclick={copyLink} disabled={!publicUrl}>Copy link</button>
			<button type="button" onclick={downloadQr} disabled={!qrReady}>Download QR</button>
		</div>
		{#if message}<p class="queue-share-message" role="status">{message}</p>{/if}
	</div>
</details>
