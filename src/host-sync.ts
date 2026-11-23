import type { HostMessage } from './types';

// The pad is only useful in Moodle if what the student writes can be saved, so it fails closed:
// read-only until the saved answer has loaded, and read-only again if saves stop being acknowledged.
// Every change is sent to the host straight away; the host's write is cheap.
export type SyncState = 'loading' | 'no-host' | 'ready' | 'saving' | 'saved' | 'readonly' | 'save-failed' | 'locked';

export interface SyncEditor {
  readonly isReadOnly: boolean;
  getValue(): string;
  setValue(text: string): void;
  setReadOnly(readOnly: boolean): void;
  insertContent(text: string): void;
}

export interface SyncTiming {
  loadRetryMs: number;
  loadGiveUpMs: number;
  ackTimeoutMs: number;
  savingDelayMs: number;
}

// "Saving" is only shown when an acknowledgement is slow, so the status stays on "Saved" while typing.
export const DEFAULT_TIMING: SyncTiming = { loadRetryMs: 1000, loadGiveUpMs: 5000, ackTimeoutMs: 4000, savingDelayMs: 800 };

type Timer = ReturnType<typeof setTimeout>;

export class HostSync {
  private loaded = false;
  private configReadOnly = false;
  private locked = false;
  private saveFailed = false;
  private loadTimer: Timer | null = null;
  private ackTimer: Timer | null = null;
  private savingTimer: Timer | null = null;
  private loadStartedAt = 0;
  private lastMsgId = '';

  constructor(
    private editor: SyncEditor,
    private post: (message: unknown) => void,
    private onState: (state: SyncState) => void,
    private timing: SyncTiming = DEFAULT_TIMING
  ) {}

  /** Locks the pad and asks the host for the saved answer until it arrives. */
  start() {
    this.editor.setReadOnly(true);
    this.onState('loading');
    this.loadStartedAt = Date.now();
    this.requestContent();
  }

  private requestContent() {
    if (this.loaded) return;
    this.post({ type: 'REQUEST_CONTENT' });
    this.loadTimer = setTimeout(() => {
      if (this.loaded) return;
      if (Date.now() - this.loadStartedAt >= this.timing.loadGiveUpMs) this.onState('no-host');
      this.requestContent();
    }, this.timing.loadRetryMs);
  }

  handleMessage(msg: HostMessage) {
    switch (msg.type) {
      case 'LOAD_CONTENT': {
        const { content, config } = msg.payload || {};
        // Only the first load sets the text; a later one must never overwrite what the student has written.
        if (!this.loaded) {
          this.loaded = true;
          if (this.loadTimer) clearTimeout(this.loadTimer);
          if (content !== undefined) this.editor.setValue(content);
        }
        this.configReadOnly = !!(config && (config.isReadOnly || config.runMode === 'review' || config.runMode === 'grade'));
        this.applyLock();
        this.onState(this.configReadOnly ? 'readonly' : 'ready');
        break;
      }
      case 'SYNC_ACK': {
        if (this.locked) break;
        const wasFailed = this.saveFailed;
        this.saveFailed = false;
        this.applyLock();
        if (wasFailed) {
          this.send(); // the host is answering again: save the latest text
        } else if (msg.msgId === this.lastMsgId) {
          this.clearAck();
          this.onState('saved');
        }
        break;
      }
      case 'INSERT_CONTENT': {
        if (this.locked || this.editor.isReadOnly) return;
        const active = document.activeElement;
        if (active instanceof HTMLElement && (active.isContentEditable || ['TEXTAREA', 'INPUT'].includes(active.tagName))) {
          const { content } = msg.payload || {};
          if (typeof content === 'string') this.editor.insertContent(content);
        }
        break;
      }
      case 'ERROR_LOCKDOWN': {
        this.locked = true;
        this.editor.setReadOnly(true);
        this.onState('locked');
        break;
      }
    }
  }

  /** Call on every edit. */
  notifyInput() {
    if (!this.loaded || this.locked || this.saveFailed || this.editor.isReadOnly) return;
    this.send();
  }

  private send() {
    this.lastMsgId = 'msg-' + Math.random().toString(36).slice(2, 11);
    this.post({ type: 'SYNC_CONTENT', msgId: this.lastMsgId, payload: { content: this.editor.getValue(), msgId: this.lastMsgId } });
    // The timers run from the oldest unacknowledged save, so steady typing can't hide a dead connection.
    // If no acknowledgement comes in time, stop taking work that can't be saved.
    if (!this.savingTimer) this.savingTimer = setTimeout(() => this.onState('saving'), this.timing.savingDelayMs);
    if (!this.ackTimer) {
      this.ackTimer = setTimeout(() => {
        this.saveFailed = true;
        this.editor.setReadOnly(true);
        this.onState('save-failed');
      }, this.timing.ackTimeoutMs);
    }
  }

  private clearAck() {
    if (this.ackTimer) clearTimeout(this.ackTimer);
    if (this.savingTimer) clearTimeout(this.savingTimer);
    this.ackTimer = this.savingTimer = null;
  }

  private applyLock() {
    this.editor.setReadOnly(this.locked || this.saveFailed || this.configReadOnly || !this.loaded);
  }
}
