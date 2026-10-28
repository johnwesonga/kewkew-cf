<script lang="ts">
	import favicon from "#lib/assets/favicon.svg";
	import ThemeSwitcher from "../lib/ThemeSwitcher.svelte";
	import "../app.css";
	import type { LayoutProps } from "./$types";

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ThemeSwitcher />
{@render children()}
