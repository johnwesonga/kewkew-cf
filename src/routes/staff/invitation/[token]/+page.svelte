<script lang="ts">
	import type { PageProps } from "./$types";
	let { data, form, params }: PageProps = $props();
</script>

<svelte:head><title>Accept staff invitation · Kewkew</title></svelte:head>
<div class="signin-page">
	<header class="topbar">
		<a class="brand" href="/staff/sign-in" aria-label="Kewkew staff sign in"
			><span class="brand-mark" aria-hidden="true">k</span><span
				class="brand-name">Kewkew<small>Staff access</small></span
			></a
		><span class="access-tag">Invitation</span>
	</header>
	<main>
		<section class="welcome" aria-labelledby="invitation-title">
			<p class="eyebrow">Staff invitation</p>
			<h1 id="invitation-title">Join {data.organizationName}.</h1>
			<p class="welcome-copy">
				You were invited as an {data.role}. Accept with the invited
				email address <strong>{data.invitedEmail}</strong>.
			</p>
			<p class="welcome-note">
				<span class="note-icon" aria-hidden="true">✓</span><span
					><strong>Your account, your access</strong><small
						>This invitation grants access to the organization shown
						here.</small
					></span
				>
			</p>
		</section>
		<section class="form-card" aria-labelledby="form-title">
			<div class="form-heading">
				<div>
					<p class="eyebrow">Secure access</p>
					<h2 id="form-title">Accept invitation</h2>
				</div>
				<span class="lock-mark" aria-hidden="true">⌑</span>
			</div>
			<p class="form-intro">
				Create your staff sign-in details to join {data.organizationName}.
			</p>
			<form method="POST">
				<input type="hidden" name="token" value={params.token} />
				<label class="field" for="name"
					>Your name<input
						id="name"
						name="name"
						autocomplete="name"
						maxlength="160"
						placeholder="Full name"
						required
					/></label
				>
				<label class="field" for="password"
					>Create a password<input
						id="password"
						name="password"
						type="password"
						autocomplete="new-password"
						minlength="8"
						maxlength="128"
						placeholder="8 to 128 characters"
						required
					/></label
				>
				<p class="welcome-copy">
					If you already have a Kewkew account, <a
						href="/staff/sign-in">sign in</a
					> first with the invited email, then reopen this link.
				</p>
				<button type="submit"
					>Accept invitation <span aria-hidden="true">→</span></button
				>
				{#if form?.message}<p class="error-message" role="alert">
						{form.message}
					</p>{/if}
			</form>
			<p class="form-footnote">
				<span aria-hidden="true">✓</span> Invitation for {data.invitedEmail}
			</p>
		</section>
	</main>
</div>

<style>
	.signin-page {
		background: radial-gradient(
				ellipse at 84% 40%,
				rgba(212, 240, 120, 0.18),
				transparent 35%
			),
			#f4f7f4;
	}
	.signin-page main {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(340px, 1.1fr);
		align-items: center;
		gap: clamp(36px, 7vw, 88px);
		width: min(940px, calc(100% - 48px));
		margin: 0 auto;
		padding: clamp(48px, 8vw, 88px) 0;
	}
	.welcome {
		padding-bottom: 18px;
	}
	.welcome h1 {
		max-width: 430px;
		margin: 0;
		font-size: clamp(36px, 4.5vw, 52px);
		line-height: 1.04;
		letter-spacing: -0.06em;
	}
	.welcome-copy {
		max-width: 400px;
		margin: 18px 0 0;
		color: #718078;
		font-size: 14px;
		line-height: 1.7;
		overflow-wrap: anywhere;
	}
	.welcome-copy strong {
		color: #34443b;
		font-weight: 700;
	}
	.welcome-note {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 30px;
	}
	.note-icon {
		width: 30px;
		height: 30px;
		display: grid;
		place-items: center;
		flex: 0 0 30px;
		border-radius: 50%;
		background: #e6f4ec;
		color: #176b4b;
		font-size: 14px;
		font-weight: 900;
	}
	.welcome-note strong,
	.welcome-note small {
		display: block;
	}
	.welcome-note strong {
		font-size: 12px;
	}
	.welcome-note small {
		margin-top: 4px;
		color: #718078;
		font-size: 11px;
		line-height: 1.5;
	}
	.signin-page .form-card {
		min-width: 0;
		padding: clamp(25px, 4vw, 38px);
	}
	.signin-page .form-heading {
		margin-bottom: 14px;
	}
	.signin-page .form-card form {
		gap: 16px;
	}
	.signin-page .form-footnote {
		margin-top: 20px;
	}
	.lock-mark {
		width: 36px;
		height: 36px;
		display: grid;
		place-items: center;
		flex: 0 0 36px;
		border-radius: 11px;
		background: #e6f4ec;
		color: #176b4b;
		font-size: 20px;
	}
	@media (max-width: 760px) {
		.signin-page main {
			grid-template-columns: 1fr;
			gap: 26px;
			width: min(540px, calc(100% - 32px));
			padding: 42px 0 52px;
		}
		.welcome {
			padding: 0;
		}
		.welcome h1 {
			max-width: 500px;
			font-size: clamp(34px, 8vw, 44px);
		}
		.welcome-copy {
			margin-top: 12px;
		}
		.welcome-note {
			margin-top: 18px;
		}
	}
	@media (max-width: 480px) {
		.signin-page main {
			width: calc(100% - 24px);
			padding: 30px 0 38px;
		}
		.signin-page .form-card {
			padding: 22px 18px;
		}
		.signin-page .form-heading h2 {
			font-size: 21px;
		}
	}
</style>
