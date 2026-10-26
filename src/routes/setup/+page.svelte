<script lang="ts">
	import { supportedTimezones } from '../../lib/timezones';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>Set up Kewkew</title>
	<meta
		name="description"
		content="Create your Kewkew organization and administrator account."
	/>
</svelte:head>

<div class="setup-page">
	<header class="topbar">
		<a class="brand" href="/" aria-label="Kewkew home">
			<span class="brand-mark" aria-hidden="true">k</span>
			<span class="brand-name">Kewkew<small>Queue, without the wait</small></span>
		</a>
		<span class="setup-tag">Workspace setup</span>
	</header>

	<main>
		<section class="intro" aria-labelledby="setup-title">
			<p class="eyebrow">A smoother way to serve</p>
			<h1 id="setup-title">Your queue starts here.</h1>
			<p class="intro-copy">
				Set up your organization and first location, then invite your team to manage
				queues with Kewkew.
			</p>
			<div class="setup-note">
				<span class="note-icon" aria-hidden="true">✓</span>
				<span><strong>One-time secure setup</strong><small>This creates your first administrator account.</small></span>
			</div>
		</section>

		<section class="form-card" aria-labelledby="form-title">
			<div class="form-heading">
				<div>
					<p class="eyebrow">Get started</p>
					<h2 id="form-title">Set up your workspace</h2>
				</div>
				<span class="step-badge">01 <span>of 01</span></span>
			</div>
			<p class="form-intro">Add your organization details and create the administrator login.</p>

			<form method="POST">
				<label class="field field-wide" for="bootstrap-secret">
					Trusted setup credential
					<input id="bootstrap-secret" name="bootstrapSecret" type="password" autocomplete="off" placeholder="Enter your setup credential" required />
					<span class="field-hint">Use the credential configured for this installation.</span>
				</label>

				<div class="section-label"><span>Organization</span><i></i></div>
				<div class="field-grid">
					<label class="field" for="organization-name">
						Organization name
						<input id="organization-name" name="organizationName" maxlength="160" autocomplete="organization" placeholder="e.g. Riverside Community Hub" required />
					</label>
					<label class="field" for="location-name">
						First location
						<input id="location-name" name="locationName" maxlength="160" placeholder="e.g. Riverside" required />
					</label>
					<label class="field field-wide" for="timezone">
						Location timezone
						<select id="timezone" name="timezone" required>
							{#each supportedTimezones as timezone}
								<option value={timezone}>{timezone}</option>
							{/each}
						</select>
					</label>
				</div>

				<div class="section-label"><span>Administrator</span><i></i></div>
				<div class="field-grid">
					<label class="field field-wide" for="admin-name">
						Full name
						<input id="admin-name" name="adminName" maxlength="160" autocomplete="name" placeholder="Your name" required />
					</label>
					<label class="field field-wide" for="email">
						Work email
						<input id="email" name="email" type="email" autocomplete="email" placeholder="you@organization.com" required />
					</label>
					<label class="field field-wide" for="password">
						Password
						<input id="password" name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" placeholder="At least 8 characters" required />
						<span class="field-hint">Use 8 to 128 characters.</span>
					</label>
				</div>

				<button type="submit">Create workspace <span aria-hidden="true">→</span></button>
				{#if form?.message}<p class="error-message" role="alert">{form.message}</p>{/if}
			</form>
			<p class="form-footnote"><span aria-hidden="true">⌑</span> Your information stays within your organization.</p>
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
	:global(button), :global(input), :global(select) { font: inherit; }
	.setup-page { min-height: 100vh; overflow: hidden; background: radial-gradient(ellipse at 14% 38%, rgba(212, 240, 120, .17), transparent 34%), #f4f7f4; }
	.topbar { height: 76px; display: flex; align-items: center; justify-content: space-between; padding: 0 clamp(20px, 5vw, 72px); border-bottom: 1px solid #e4eae5; background: rgba(255,255,255,.92); }
	.brand { display: inline-flex; align-items: center; gap: 11px; color: #17251f; text-decoration: none; font-size: 22px; font-weight: 800; letter-spacing: -.04em; }
	.brand-mark { width: 36px; height: 36px; display: grid; place-items: center; color: #fff; background: #176b4b; border-radius: 12px; font-size: 19px; letter-spacing: 0; }
	.brand-name small { display: block; margin-top: 2px; color: #718078; font-size: 9px; font-weight: 650; letter-spacing: .11em; text-transform: uppercase; }
	.setup-tag { padding: 8px 12px; border: 1px solid #e4eae5; border-radius: 99px; background: #fff; color: #66736b; font-size: 11px; font-weight: 700; }
	main { display: grid; grid-template-columns: minmax(240px, .8fr) minmax(420px, 1.2fr); align-items: center; gap: clamp(42px, 7vw, 100px); width: min(1050px, calc(100% - 48px)); margin: 0 auto; padding: 58px 0 64px; }
	.intro { padding-bottom: 22px; }
	.eyebrow { margin: 0 0 13px; color: #176b4b; font-size: 10px; font-weight: 850; letter-spacing: .14em; text-transform: uppercase; }
	h1 { max-width: 410px; margin: 0; font-size: clamp(36px, 4.5vw, 54px); line-height: 1.02; letter-spacing: -.06em; }
	.intro-copy { max-width: 380px; margin: 18px 0 0; color: #718078; font-size: 14px; line-height: 1.7; }
	.setup-note { display: flex; align-items: center; gap: 12px; margin-top: 34px; }
	.note-icon { width: 30px; height: 30px; display: grid; place-items: center; flex: 0 0 30px; border-radius: 50%; background: #e6f4ec; color: #176b4b; font-size: 14px; font-weight: 900; }
	.setup-note strong, .setup-note small { display: block; }
	.setup-note strong { font-size: 12px; }
	.setup-note small { margin-top: 4px; color: #718078; font-size: 11px; }
	.form-card { padding: clamp(24px, 3vw, 36px); border: 1px solid #e4eae5; border-radius: 20px; background: #fff; box-shadow: 0 18px 50px rgba(26, 52, 39, .08); }
	.form-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
	.form-heading .eyebrow { margin-bottom: 7px; }
	h2 { margin: 0; font-size: 23px; letter-spacing: -.045em; }
	.step-badge { padding: 7px 9px; border-radius: 9px; background: #e6f4ec; color: #10523a; font-size: 10px; font-weight: 850; white-space: nowrap; }
	.step-badge span { color: #718078; font-weight: 650; }
	.form-intro { margin: 9px 0 23px; color: #718078; font-size: 12px; line-height: 1.5; }
	form { display: grid; gap: 15px; }
	.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
	.field { display: grid; gap: 7px; min-width: 0; color: #34443b; font-size: 11px; font-weight: 750; }
	.field-wide { grid-column: 1 / -1; }
	.field input, .field select { width: 100%; min-height: 43px; padding: 0 12px; border: 1px solid #dfe7e0; border-radius: 10px; outline: none; background: #fff; color: #17251f; font-size: 12px; font-weight: 450; transition: border-color .15s, box-shadow .15s; }
	.field input::placeholder { color: #a0aaa3; }
	.field input:focus, .field select:focus { border-color: #176b4b; box-shadow: 0 0 0 3px rgba(23,107,75,.11); }
	.field-hint { margin-top: -2px; color: #87948c; font-size: 10px; font-weight: 450; }
	.section-label { display: flex; align-items: center; gap: 11px; margin: 3px 0 -1px; color: #99a39d; font-size: 9px; font-weight: 850; letter-spacing: .13em; text-transform: uppercase; }
	.section-label i { height: 1px; flex: 1; background: #edf1ed; }
	button[type='submit'] { display: flex; justify-content: center; align-items: center; gap: 10px; min-height: 46px; margin-top: 3px; border: 0; border-radius: 11px; background: #176b4b; color: white; box-shadow: 0 5px 12px rgba(23,107,75,.17); font-size: 12px; font-weight: 800; cursor: pointer; transition: background .15s, transform .15s; }
	button[type='submit']:hover { background: #10523a; }
	button[type='submit']:active { transform: translateY(1px); }
	button[type='submit']:focus-visible { outline: 3px solid #d4f078; outline-offset: 3px; }
	.error-message { margin: 0; padding: 11px 12px; border-radius: 9px; background: #fff0ed; color: #a64338; font-size: 11px; line-height: 1.5; }
	.form-footnote { display: flex; justify-content: center; align-items: center; gap: 7px; margin: 17px 0 0; color: #87948c; font-size: 10px; }
	.form-footnote span { color: #176b4b; font-size: 14px; }
	footer { padding: 0 20px 24px; color: #99a39d; text-align: center; font-size: 10px; }
	footer span { padding: 0 4px; }
	@media (max-width: 760px) {
		main { grid-template-columns: 1fr; gap: 28px; width: min(560px, calc(100% - 32px)); padding: 38px 0 46px; }
		.intro { padding: 0; }
		h1 { max-width: 500px; font-size: clamp(35px, 9vw, 46px); }
		.intro-copy { margin-top: 12px; }
		.setup-note { margin-top: 18px; }
	}
	@media (max-width: 480px) {
		.topbar { height: 66px; padding: 0 16px; }
		.brand { font-size: 20px; }
		.brand-mark { width: 33px; height: 33px; }
		.setup-tag { padding: 7px 9px; font-size: 10px; }
		main { width: calc(100% - 24px); padding: 29px 0 36px; }
		.form-card { padding: 21px 17px; border-radius: 16px; }
		.field-grid { grid-template-columns: 1fr; gap: 13px; }
		.field-wide { grid-column: auto; }
		h2 { font-size: 21px; }
	}
	@media (prefers-reduced-motion: reduce) {
		*, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
	}
</style>
