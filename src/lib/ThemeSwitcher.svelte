<script lang="ts">
	import { onMount } from 'svelte';

	type Theme = 'system' | 'light' | 'dark';
	let theme = $state<Theme>('system');

	function applyTheme(value: Theme) {
		theme = value;
		const root = document.documentElement;
		root.dataset.theme = value;
		root.dataset.colorScheme = value === 'system'
			? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
			: value;
		localStorage.setItem('kewkew-theme', value);
	}

	onMount(() => {
		const saved = localStorage.getItem('kewkew-theme');
		const initial: Theme = saved === 'light' || saved === 'dark' ? saved : 'system';
		applyTheme(initial);

		const preference = window.matchMedia('(prefers-color-scheme: dark)');
		const syncSystemTheme = () => {
			if (theme === 'system') {
				document.documentElement.dataset.colorScheme = preference.matches ? 'dark' : 'light';
			}
		};
		preference.addEventListener('change', syncSystemTheme);
		return () => preference.removeEventListener('change', syncSystemTheme);
	});
</script>

<label class="theme-switcher">
	<span>Theme</span>
	<select aria-label="Choose color theme" bind:value={theme} onchange={() => applyTheme(theme)}>
		<option value="system">System</option>
		<option value="light">Light</option>
		<option value="dark">Dark</option>
	</select>
</label>
