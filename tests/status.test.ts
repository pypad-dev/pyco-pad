import { describe, expect, it } from 'vitest';
import { statusView } from '../src/status';

const plain = (_key: string, fallback: string) => fallback;

describe('statusView', () => {
  it.each(['ready', 'saved'] as const)('says nothing when %s', (state) => {
    expect(statusView(state, plain)).toEqual({ text: '', warning: '' });
  });

  it.each([
    ['loading', 'Loading...'],
    ['saving', 'Saving...'],
    ['readonly', 'Read-only'],
  ] as const)('shows short toolbar text while %s, with no banner', (state, text) => {
    expect(statusView(state, plain)).toEqual({ text, warning: '' });
  });

  it.each(['no-host', 'save-failed', 'locked'] as const)('shows a banner and no toolbar text when %s', (state) => {
    const view = statusView(state, plain);
    expect(view.text).toBe('');
    expect(view.warning.length).toBeGreaterThan(10);
  });

  it('uses overriding strings from the host page', () => {
    const ui = (key: string, fallback: string) => (key === 'statusLoading' ? 'Wird geladen...' : fallback);
    expect(statusView('loading', ui).text).toBe('Wird geladen...');
  });
});
