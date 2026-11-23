import type { SyncState } from './host-sync';

export type UiStrings = (key: string, fallback: string) => string;

export interface StatusView {
  /** Short text for the toolbar; empty when there is nothing to say. */
  text: string;
  /** Full-width red banner; empty when there is no problem. */
  warning: string;
}

// Saved is the normal state, so it is silent: the toolbar speaks only while loading, saving slowly or read-only,
// and anything that needs the student to act (work not saved, no connection, locked) is a banner.
export function statusView(state: SyncState, ui: UiStrings): StatusView {
  switch (state) {
    case 'loading':
      return { text: ui('statusLoading', 'Loading...'), warning: '' };
    case 'saving':
      return { text: ui('statusSyncing', 'Saving...'), warning: '' };
    case 'readonly':
      return { text: ui('statusReadOnly', 'Read-only'), warning: '' };
    case 'no-host':
      return { text: '', warning: ui('warningNoHost', "Can't reach Moodle, so your work can't be saved. Reload the page.") };
    case 'save-failed':
      return { text: '', warning: ui('warningSaveFailed', 'Your latest work is not saved. Copy it before leaving this page.') };
    case 'locked':
      return { text: '', warning: ui('warningLocked', 'This answer is locked and can no longer be changed.') };
    default:
      return { text: '', warning: '' }; // ready, saved
  }
}
