<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>Set up Kewkew</title>
</svelte:head>

<main>
	<h1>Set up Kewkew</h1>
	<p>Create the first organization and administrator. This setup can only succeed once.</p>
	<form method="POST">
		<label>Trusted setup credential <input name="bootstrapSecret" type="password" autocomplete="off" required /></label>
		<label>Organization name <input name="organizationName" maxlength="160" required /></label>
		<label>First location <input name="locationName" maxlength="160" required /></label>
		<label>Location timezone <input name="timezone" placeholder="Africa/Nairobi" required /></label>
		<label>Administrator name <input name="adminName" maxlength="160" autocomplete="name" required /></label>
		<label>Email <input name="email" type="email" autocomplete="email" required /></label>
		<label>Password <input name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required /></label>
		<button type="submit">Initialize organization</button>
		{#if form?.message}<p role="alert">{form.message}</p>{/if}
	</form>
</main>
