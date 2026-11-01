<script lang="ts">
	import StaffAvatar from '#lib/StaffAvatar.svelte';
	type Props = {
		name: string;
		email: string;
	};
	let { name, email }: Props = $props();
</script>

<div class="staff-account-chip">
	<StaffAvatar name={name} />
	<span class="staff-account-copy"><strong>{name}</strong><small>{email}</small></span>
</div>
