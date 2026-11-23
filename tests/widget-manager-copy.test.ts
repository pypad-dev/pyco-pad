import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

// public/lms-widget-manager.iife.js is copied by `npm install` (postinstall) from the lms-widget-manager pinned in package.json
// (github:pypad-dev/lms-widget-manager#<tag>, built when installed). A copy that differs is a stale or hand-edited one: run `npm install`.
describe('the widget manager the site ships', () => {
    it('is the pinned version\'s build', () => {
        const built = 'node_modules/lms-widget-manager/dist/lms-widget-manager.iife.js';
        expect(existsSync(built), 'run npm install: the pinned lms-widget-manager is not installed and built').toBe(true);
        expect(existsSync('public/lms-widget-manager.iife.js'), 'run npm install: the copy in public/ is missing').toBe(true);
        expect(readFileSync('public/lms-widget-manager.iife.js', 'utf8') === readFileSync(built, 'utf8'), 'public/ has another build: run npm install').toBe(true);
    });
});
