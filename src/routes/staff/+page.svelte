<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Staff</title>
</svelte:head>

<main>
	<h1>Signed in</h1>
	<p>{data.user.name} · {data.user.email}</p>
	<form method="POST" action="?/signOut"><button type="submit">Sign out</button></form>
</main>
