<script lang="ts">
	type Props = {
		name: string;
		size?: 'default' | 'large';
	};
	let { name, size = 'default' }: Props = $props();
	let initials = $derived(name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join(''));
</script>

<span class="staff-avatar" class:large={size === 'large'} aria-hidden="true">{initials}</span>
