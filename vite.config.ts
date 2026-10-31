import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter(),
			csrf: {
				// Trust the preview custom domain if the Worker derives a different
				// request origin behind Cloudflare's custom-domain routing.
				trustedOrigins: ['https://kewkew-preview.projozangu.com']
			},
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			}
		})
	],
	server: {
		allowedHosts: ['john-mac']
	}
});
