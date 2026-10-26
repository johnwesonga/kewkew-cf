<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>Staff sign in · Kewkew</title>
	<meta name="description" content="Sign in to manage your Kewkew queues." />
</svelte:head>

<div class="signin-page">
	<header class="topbar">
		<a class="brand" href="/" aria-label="Kewkew home">
			<span class="brand-mark" aria-hidden="true">k</span>
			<span class="brand-name">Kewkew<small>Queue, without the wait</small></span>
		</a>
		<span class="access-tag">Staff access</span>
	</header>

	<main>
		<section class="welcome" aria-labelledby="welcome-title">
			<p class="eyebrow">Welcome back</p>
			<h1 id="welcome-title">Good service starts with a smooth queue.</h1>
			<p class="welcome-copy">
				Sign in to see your workspace, keep things moving, and help every visitor
				know what comes next.
			</p>
			<div class="welcome-note">
				<span class="note-icon" aria-hidden="true">✓</span>
				<span><strong>Your team workspace</strong><small>Manage queues and serve visitors in one place.</small></span>
			</div>
		</section>

		<section class="form-card" aria-labelledby="form-title">
			<div class="form-heading">
				<div>
					<p class="eyebrow">Staff workspace</p>
					<h2 id="form-title">Sign in to Kewkew</h2>
				</div>
				<span class="lock-mark" aria-hidden="true">⌑</span>
			</div>
			<p class="form-intro">Use your staff email and password to continue.</p>

			<form method="POST">
				<label class="field" for="email">
					Email address
					<input id="email" name="email" type="email" autocomplete="username" placeholder="you@organization.com" required />
				</label>
				<label class="field" for="password">
					Password
					<input id="password" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required />
				</label>
				<button type="submit">Sign in <span aria-hidden="true">→</span></button>
				{#if form?.message}<p class="error-message" role="alert">{form.message}</p>{/if}
			</form>
			<p class="form-footnote"><span aria-hidden="true">✓</span> Your account is protected by secure sign-in.</p>
		</section>
	</main>
	<footer>© Kewkew <span>·</span> Queue, without the wait</footer>
</div>

<style>
	.signin-page { background: radial-gradient(ellipse at 84% 40%, rgba(212, 240, 120, .18), transparent 35%), #f4f7f4; }
	.signin-page main { display: grid; grid-template-columns: minmax(240px, .9fr) minmax(360px, 1.1fr); align-items: center; gap: clamp(42px, 8vw, 112px); width: min(980px, calc(100% - 48px)); margin: 0 auto; padding: 80px 0 88px; }
	.welcome { padding-bottom: 20px; }
	.welcome h1 { max-width: 430px; margin: 0; font-size: clamp(36px, 4.5vw, 54px); line-height: 1.02; letter-spacing: -.06em; }
	.welcome-copy { max-width: 390px; margin: 18px 0 0; color: #718078; font-size: 14px; line-height: 1.7; }
	.welcome-note { display: flex; align-items: center; gap: 12px; margin-top: 34px; }
	.note-icon { width: 30px; height: 30px; display: grid; place-items: center; flex: 0 0 30px; border-radius: 50%; background: #e6f4ec; color: #176b4b; font-size: 14px; font-weight: 900; }
	.welcome-note strong, .welcome-note small { display: block; }
	.welcome-note strong { font-size: 12px; }
	.welcome-note small { margin-top: 4px; color: #718078; font-size: 11px; }
	.lock-mark { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 11px; background: #e6f4ec; color: #176b4b; font-size: 20px; }
	.signin-page .form-intro { margin-bottom: 25px; }
	.signin-page .form-card form { gap: 18px; }
	.signin-page .form-card { padding: clamp(25px, 4vw, 40px); }
	.signin-page .form-footnote { margin-top: 20px; }
	@media (max-width: 760px) {
		.signin-page main { grid-template-columns: 1fr; gap: 28px; width: min(540px, calc(100% - 32px)); padding: 48px 0 56px; }
		.welcome { padding: 0; }
		.welcome h1 { max-width: 500px; font-size: clamp(35px, 9vw, 46px); }
		.welcome-copy { margin-top: 12px; }
		.welcome-note { margin-top: 18px; }
	}
	@media (max-width: 480px) {
		.signin-page main { width: calc(100% - 24px); padding: 34px 0 42px; }
		.signin-page .form-card { padding: 23px 18px; }
		.signin-page .form-heading h2 { font-size: 22px; }
	}
</style>
