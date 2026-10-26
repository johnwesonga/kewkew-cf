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
	:global(*) { box-sizing: border-box; }
	:global(body) {
		margin: 0;
		color: #17251f;
		background: #f4f7f4;
		font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}
	:global(button), :global(input) { font: inherit; }
	.signin-page { min-height: 100vh; overflow: hidden; background: radial-gradient(ellipse at 84% 40%, rgba(212, 240, 120, .18), transparent 35%), #f4f7f4; }
	.topbar { height: 76px; display: flex; align-items: center; justify-content: space-between; padding: 0 clamp(20px, 5vw, 72px); border-bottom: 1px solid #e4eae5; background: rgba(255,255,255,.92); }
	.brand { display: inline-flex; align-items: center; gap: 11px; color: #17251f; text-decoration: none; font-size: 22px; font-weight: 800; letter-spacing: -.04em; }
	.brand-mark { width: 36px; height: 36px; display: grid; place-items: center; color: #fff; background: #176b4b; border-radius: 12px; font-size: 19px; letter-spacing: 0; }
	.brand-name small { display: block; margin-top: 2px; color: #718078; font-size: 9px; font-weight: 650; letter-spacing: .11em; text-transform: uppercase; }
	.access-tag { padding: 8px 12px; border: 1px solid #e4eae5; border-radius: 99px; background: #fff; color: #66736b; font-size: 11px; font-weight: 700; }
	main { display: grid; grid-template-columns: minmax(240px, .9fr) minmax(360px, 1.1fr); align-items: center; gap: clamp(42px, 8vw, 112px); width: min(980px, calc(100% - 48px)); margin: 0 auto; padding: 80px 0 88px; }
	.welcome { padding-bottom: 20px; }
	.eyebrow { margin: 0 0 13px; color: #176b4b; font-size: 10px; font-weight: 850; letter-spacing: .14em; text-transform: uppercase; }
	h1 { max-width: 430px; margin: 0; font-size: clamp(36px, 4.5vw, 54px); line-height: 1.02; letter-spacing: -.06em; }
	.welcome-copy { max-width: 390px; margin: 18px 0 0; color: #718078; font-size: 14px; line-height: 1.7; }
	.welcome-note { display: flex; align-items: center; gap: 12px; margin-top: 34px; }
	.note-icon { width: 30px; height: 30px; display: grid; place-items: center; flex: 0 0 30px; border-radius: 50%; background: #e6f4ec; color: #176b4b; font-size: 14px; font-weight: 900; }
	.welcome-note strong, .welcome-note small { display: block; }
	.welcome-note strong { font-size: 12px; }
	.welcome-note small { margin-top: 4px; color: #718078; font-size: 11px; }
	.form-card { padding: clamp(25px, 4vw, 40px); border: 1px solid #e4eae5; border-radius: 20px; background: #fff; box-shadow: 0 18px 50px rgba(26, 52, 39, .08); }
	.form-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
	.form-heading .eyebrow { margin-bottom: 7px; }
	h2 { margin: 0; font-size: 24px; letter-spacing: -.045em; }
	.lock-mark { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 11px; background: #e6f4ec; color: #176b4b; font-size: 20px; }
	.form-intro { margin: 10px 0 25px; color: #718078; font-size: 12px; line-height: 1.5; }
	form { display: grid; gap: 18px; }
	.field { display: grid; gap: 8px; min-width: 0; color: #34443b; font-size: 11px; font-weight: 750; }
	.field input { width: 100%; min-height: 46px; padding: 0 13px; border: 1px solid #dfe7e0; border-radius: 10px; outline: none; background: #fff; color: #17251f; font-size: 12px; font-weight: 450; transition: border-color .15s, box-shadow .15s; }
	.field input::placeholder { color: #a0aaa3; }
	.field input:focus { border-color: #176b4b; box-shadow: 0 0 0 3px rgba(23,107,75,.11); }
	button[type='submit'] { display: flex; justify-content: center; align-items: center; gap: 10px; min-height: 47px; margin-top: 2px; border: 0; border-radius: 11px; background: #176b4b; color: white; box-shadow: 0 5px 12px rgba(23,107,75,.17); font-size: 12px; font-weight: 800; cursor: pointer; transition: background .15s, transform .15s; }
	button[type='submit']:hover { background: #10523a; }
	button[type='submit']:active { transform: translateY(1px); }
	button[type='submit']:focus-visible { outline: 3px solid #d4f078; outline-offset: 3px; }
	.error-message { margin: 0; padding: 11px 12px; border-radius: 9px; background: #fff0ed; color: #a64338; font-size: 11px; line-height: 1.5; }
	.form-footnote { display: flex; justify-content: center; align-items: center; gap: 7px; margin: 20px 0 0; color: #87948c; font-size: 10px; }
	.form-footnote span { color: #176b4b; font-size: 13px; }
	footer { padding: 0 20px 24px; color: #99a39d; text-align: center; font-size: 10px; }
	footer span { padding: 0 4px; }
	@media (max-width: 760px) {
		main { grid-template-columns: 1fr; gap: 28px; width: min(540px, calc(100% - 32px)); padding: 48px 0 56px; }
		.welcome { padding: 0; }
		h1 { max-width: 500px; font-size: clamp(35px, 9vw, 46px); }
		.welcome-copy { margin-top: 12px; }
		.welcome-note { margin-top: 18px; }
	}
	@media (max-width: 480px) {
		.topbar { height: 66px; padding: 0 16px; }
		.brand { font-size: 20px; }
		.brand-mark { width: 33px; height: 33px; }
		.access-tag { padding: 7px 9px; font-size: 10px; }
		main { width: calc(100% - 24px); padding: 34px 0 42px; }
		.form-card { padding: 23px 18px; border-radius: 16px; }
		h2 { font-size: 22px; }
	}
	@media (prefers-reduced-motion: reduce) {
		*, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
	}
</style>
