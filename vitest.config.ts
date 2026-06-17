import { defineConfig } from 'vitest/config';

// Vitest config kept separate from vite.config.ts so the game build stays
// untouched. The MFE bridge talks to window/postMessage, so tests run in jsdom.
export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['src/**/*.test.ts'],
        globals: false,
    },
});
