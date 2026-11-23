// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TIMING, HostSync, type SyncEditor, type SyncState } from '../src/host-sync';

class FakeEditor implements SyncEditor {
  value = '';
  isReadOnly = false;
  getValue() { return this.value; }
  setValue(t: string) { this.value = t; }
  setReadOnly(r: boolean) { this.isReadOnly = r; }
  insertContent(t: string) { this.value += t; }
}

let editor: FakeEditor;
let sent: any[];
let states: SyncState[];
let sync: HostSync;

const load = (content = 'saved answer', config: any = { runMode: 'attempt', isReadOnly: false }) =>
  sync.handleMessage({ type: 'LOAD_CONTENT', payload: { content, config } } as any);
const type = (text: string) => { editor.value = text; sync.notifyInput(); };
// The manager puts the id at the top level of the message, not in the payload.
const ack = (msgId?: string) => sync.handleMessage({ type: 'SYNC_ACK', msgId, payload: { serverHash: 'abc', success: true } } as any);
const syncs = () => sent.filter((m) => m.type === 'SYNC_CONTENT');
const lastState = () => states[states.length - 1];
const lastSyncId = () => syncs()[syncs().length - 1].msgId;

beforeEach(() => {
  vi.useFakeTimers();
  editor = new FakeEditor();
  sent = [];
  states = [];
  sync = new HostSync(editor, (m) => sent.push(m), (s) => states.push(s));
});
afterEach(() => vi.useRealTimers());

describe('loading', () => {
  it('is read-only and asks for the saved answer on start', () => {
    sync.start();
    expect(editor.isReadOnly).toBe(true);
    expect(lastState()).toBe('loading');
    expect(sent).toEqual([{ type: 'REQUEST_CONTENT' }]);
  });

  it('loads the saved answer and unlocks', () => {
    sync.start();
    load('print(1)');
    expect(editor.value).toBe('print(1)');
    expect(editor.isReadOnly).toBe(false);
    expect(lastState()).toBe('ready');
  });

  it('keeps asking, then reports it cannot reach Moodle, and stays locked', () => {
    sync.start();
    vi.advanceTimersByTime(DEFAULT_TIMING.loadGiveUpMs + 100);
    expect(sent.filter((m) => m.type === 'REQUEST_CONTENT').length).toBeGreaterThan(3);
    expect(lastState()).toBe('no-host');
    expect(editor.isReadOnly).toBe(true);
  });

  it('accepts a late answer after giving up, because nothing could have been typed', () => {
    sync.start();
    vi.advanceTimersByTime(DEFAULT_TIMING.loadGiveUpMs + 100);
    load('late');
    expect(editor.value).toBe('late');
    expect(editor.isReadOnly).toBe(false);
    expect(lastState()).toBe('ready');
  });

  it('stays read-only in review or grade mode', () => {
    sync.start();
    load('x', { runMode: 'review', isReadOnly: false });
    expect(editor.isReadOnly).toBe(true);
    expect(lastState()).toBe('readonly');
  });

  it('never lets a second load overwrite what the student has written', () => {
    sync.start();
    load('first');
    type('first plus my work');
    load('first');
    expect(editor.value).toBe('first plus my work');
  });

  it('sends nothing to the host before the first load', () => {
    sync.start();
    sync.notifyInput();
    expect(syncs()).toHaveLength(0);
  });
});

describe('saving', () => {
  beforeEach(() => { sync.start(); load(); });

  it('sends every change straight away and shows saved once the latest is acknowledged', () => {
    type('a');
    type('ab');
    expect(syncs().map((m) => m.payload.content)).toEqual(['a', 'ab']);
    ack(syncs()[0].msgId);
    expect(lastState()).toBe('ready'); // the latest change is not acknowledged yet
    ack(lastSyncId());
    expect(lastState()).toBe('saved');
  });

  it('never flashes "saving" while acknowledgements arrive promptly', () => {
    type('a'); ack(lastSyncId());
    type('ab'); ack(lastSyncId());
    type('abc'); ack(lastSyncId());
    vi.advanceTimersByTime(DEFAULT_TIMING.ackTimeoutMs);
    expect(states).not.toContain('saving');
    expect(lastState()).toBe('saved');
  });

  it('keeps showing saved while typing continues between acknowledgements', () => {
    type('a'); ack(lastSyncId());
    type('ab'); // new change in flight, acknowledgement still to come
    vi.advanceTimersByTime(DEFAULT_TIMING.savingDelayMs - 100);
    expect(lastState()).toBe('saved');
  });

  it('shows saving only when an acknowledgement is slow, then saved again', () => {
    type('a'); ack(lastSyncId());
    type('ab');
    vi.advanceTimersByTime(DEFAULT_TIMING.savingDelayMs + 10);
    expect(lastState()).toBe('saving');
    ack(lastSyncId());
    expect(lastState()).toBe('saved');
  });

  it('goes read-only with a visible failure when a save is not acknowledged', () => {
    type('work');
    vi.advanceTimersByTime(DEFAULT_TIMING.ackTimeoutMs + 10);
    expect(editor.isReadOnly).toBe(true);
    expect(editor.value).toBe('work');
    expect(lastState()).toBe('save-failed');
  });

  it('still fails when typing continues but nothing is ever acknowledged', () => {
    for (let i = 0; i < 40; i++) {
      type('x'.repeat(i + 1));
      vi.advanceTimersByTime(200); // steady typing, 8 s in total
    }
    expect(editor.isReadOnly).toBe(true);
    expect(lastState()).toBe('save-failed');
  });

  it('does not fail while acknowledgements keep arriving', () => {
    for (let i = 0; i < 5; i++) {
      type('x'.repeat(i + 1));
      ack(lastSyncId());
      vi.advanceTimersByTime(DEFAULT_TIMING.ackTimeoutMs - 100);
    }
    expect(editor.isReadOnly).toBe(false);
  });

  it('unlocks and saves the latest text when the host answers again', () => {
    type('work');
    const id = lastSyncId();
    vi.advanceTimersByTime(DEFAULT_TIMING.ackTimeoutMs + 10);
    expect(editor.isReadOnly).toBe(true);
    ack(id);
    expect(editor.isReadOnly).toBe(false);
    expect(syncs()).toHaveLength(2);
    expect(syncs()[1].payload.content).toBe('work');
  });

  it('stays read-only after ERROR_LOCKDOWN, even if acknowledgements follow', () => {
    sync.handleMessage({ type: 'ERROR_LOCKDOWN' } as any);
    expect(editor.isReadOnly).toBe(true);
    expect(lastState()).toBe('locked');
    ack();
    expect(editor.isReadOnly).toBe(true);
  });

  it('does not unlock a read-only (review) pad on acknowledgement', () => {
    load('x', { runMode: 'review' });
    ack();
    expect(editor.isReadOnly).toBe(true);
  });
});
