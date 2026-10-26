<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>Staff sign in</title>
</svelte:head>

<main>
	<h1>Staff sign in</h1>
	<form method="POST">
		<label>Email <input name="email" type="email" autocomplete="username" required /></label>
		<label>Password <input name="password" type="password" autocomplete="current-password" required /></label>
		<button type="submit">Sign in</button>
		{#if form?.message}<p role="alert">{form.message}</p>{/if}
	</form>
</main>
