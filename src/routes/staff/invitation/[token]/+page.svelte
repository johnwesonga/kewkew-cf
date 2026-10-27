<script lang="ts">
	import type { PageProps } from './$types';
	let { data, form, params }: PageProps = $props();
</script>

<svelte:head><title>Accept staff invitation · Kewkew</title></svelte:head>
<div class="signin-page">
	<header class="topbar"><a class="brand" href="/staff/sign-in"><span class="brand-mark">k</span><span class="brand-name">Kewkew<small>Staff access</small></span></a></header>
	<main>
		<section class="welcome"><p class="eyebrow">Staff invitation</p><h1>Join {data.organizationName}.</h1><p class="welcome-copy">You were invited as an {data.role}. Accept with the invited email address {data.invitedEmail}.</p></section>
		<section class="form-card"><div class="form-heading"><div><p class="eyebrow">Secure access</p><h2>Accept invitation</h2></div></div>
			<form method="POST">
				<input type="hidden" name="token" value={params.token} />
				<label class="field" for="name">Your name<input id="name" name="name" autocomplete="name" maxlength="160" placeholder="Full name" /></label>
				<label class="field" for="password">Create a password<input id="password" name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" placeholder="8 to 128 characters" /></label>
				<p class="field-hint">If you already have a Kewkew account, sign in first with the invited email, then reopen this link.</p>
				<button type="submit">Accept invitation <span aria-hidden="true">→</span></button>
				{#if form?.message}<p class="error-message" role="alert">{form.message}</p>{/if}
			</form>
		</section>
	</main>
</div>
