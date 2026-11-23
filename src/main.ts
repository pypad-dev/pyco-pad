import './style.css';
import { Editor } from './editor';
import { SkulptRunner } from './skulpt-runner';
import { HostSync } from './host-sync';
import { AnswerPanel } from './answer-panel';
import { statusView } from './status';
import { FONT_SIZE_KEY, clampFontSize, ptToPx, readSavedFontSize } from './font-size';
import type { HostMessage } from './types';

declare var LZString: any;

const editor = new Editor();

const loadCodeFromHash = () => {
  const hash = window.location.hash;
  if (hash.startsWith('#c=')) {
    try {
      if (typeof LZString !== 'undefined') {
        const compressed = hash.substring(3);
        const code = LZString.decompressFromEncodedURIComponent(compressed);
        if (code) {
          editor.setValue(code);
        }
      }
    } catch (e) {
      console.error("Failed to decompress code from URL", e);
    }
  }
};

loadCodeFromHash();
window.addEventListener('hashchange', loadCodeFromHash);
const runner = new SkulptRunner();

const syncStatus = document.getElementById('sync-status') as HTMLElement;

// --- URL PARAMETERS ---
const urlParams = new URLSearchParams(window.location.search);
const isSyncEnabled = urlParams.get('sync') === 'true';
const isSafeModeVisible = urlParams.get('safeMode') === 'true';
const targetRows = parseInt(urlParams.get('rows') || '0', 10);
// Notes and saved output only mean something when there is an answer to save them with.
const answerOptions = {
    notes: isSyncEnabled && urlParams.get('notes') === 'true',
    output: isSyncEnabled && urlParams.get('saveOutput') === 'true'
};
const panel = new AnswerPanel(editor, runner, answerOptions);

if (isSyncEnabled) {
    document.body.classList.add('is-sync-enabled');
}

if (window.self !== window.top) {
    document.body.classList.add('is-embedded');
}

if (isSafeModeVisible) {
    document.getElementById('safe-mode-container')!.style.display = 'flex';
} else {
    document.getElementById('safe-mode-container')!.style.display = 'none';
}

// UI Setup
document.getElementById('btn-run')?.addEventListener('click', () => {
    panel.beforeRun();
    runner.runCode(editor.getValue());
});

const btnShare = document.getElementById('btn-share');
if (isSyncEnabled && btnShare) {
    btnShare.style.display = 'none';
}
btnShare?.addEventListener('click', () => {
    if (isSyncEnabled) return; // double safety
    if (typeof LZString === 'undefined') return;
    const code = editor.getValue();
    const compressed = LZString.compressToEncodedURIComponent(code);
    const url = new URL(window.location.href);
    url.hash = 'c=' + compressed;
    
    navigator.clipboard.writeText(url.href).then(() => {
        const originalContent = btnShare.innerHTML;
        btnShare.innerHTML = '<span style="color:#4ec9b0;font-weight:bold;">Copied!</span>';
        setTimeout(() => {
            btnShare.innerHTML = originalContent;
        }, 2000);
    });
});

// 1. Talk to the host LMS manager. The pad is read-only until the saved answer has loaded and
// goes read-only again if saves stop being acknowledged (see host-sync.ts).
if (isSyncEnabled) {
    const ui = (key: string, fallback: string): string => (window as any).IDE_UI_STRINGS?.[key] || fallback;
    const syncWarning = document.getElementById('sync-warning') as HTMLElement;

    const sync = new HostSync(
        panel,
        (message) => window.parent.postMessage(message, '*'),
        (state) => {
            const view = statusView(state, ui);
            syncStatus.textContent = view.text;
            syncWarning.textContent = view.warning;
            syncWarning.hidden = !view.warning;
        }
    );

    window.addEventListener('message', (event: MessageEvent) => {
        let msg: HostMessage;
        if (typeof event.data === 'string') {
            try {
                msg = JSON.parse(event.data);
            } catch {
                return;
            }
        } else {
            msg = event.data;
        }
        if (!msg || typeof msg !== 'object') return;
        sync.handleMessage(msg);
    });

    document.getElementById('editing')?.addEventListener('input', () => sync.notifyInput());
    panel.onChange = () => sync.notifyInput();

    sync.start();
}

// --- SETTINGS UI & PERSISTENCE ---
const btnConfig = document.getElementById('btn-config') as HTMLButtonElement;
const settingsModal = document.getElementById('settings-modal') as HTMLElement;
const btnCloseSettings = document.getElementById('btn-close-settings') as HTMLButtonElement;
const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
const btnFontInc = document.getElementById('btn-font-inc') as HTMLButtonElement;
const btnFontDec = document.getElementById('btn-font-dec') as HTMLButtonElement;
const fontSizeDisplay = document.getElementById('font-size-display') as HTMLElement;

// 1. Theme Persistence
function applyTheme(theme: string) {
    document.body.classList.remove('theme-light', 'theme-hc');
    if (theme === 'light') {
        document.body.classList.add('theme-light');
    } else if (theme === 'hc') {
        document.body.classList.add('theme-hc');
    }
    themeSelect.value = theme;
}

let savedTheme = 'dark';
try {
    savedTheme = localStorage.getItem('py_ide_theme') || 'dark';
} catch (e) {
    console.warn('Cannot read theme from localStorage:', e);
}
applyTheme(savedTheme);

themeSelect.addEventListener('change', () => {
    applyTheme(themeSelect.value);
    try {
        localStorage.setItem('py_ide_theme', themeSelect.value);
    } catch (e) {
        console.warn('Cannot save theme to localStorage:', e);
    }
});

// 2. Font Size Persistence & Height Scaling
let currentFontSize = readSavedFontSize(localStorage);

function notifyHeightBasedOnRows() {
    // 41px toolbar + 24px code padding + 10px buffer = 75px; the panels no longer have a CODE bar
    const pixelFontSize = ptToPx(currentFontSize);
    const lineHeight = pixelFontSize * 1.5;
    const chromeHeight = 75;
    let neededHeight: number;
    if (targetRows > 0) {
        neededHeight = Math.round(chromeHeight + (targetRows * lineHeight));
    } else {
        const containerEl = document.getElementById('main-container');
        neededHeight = Math.max(350, containerEl ? containerEl.scrollHeight + 40 : 380);
    }
    window.parent.postMessage({
        type: 'SYNC_HEIGHT',
        payload: { height: neededHeight }
    }, '*');
}

btnConfig.addEventListener('click', () => {
    settingsModal.style.display = 'flex';
});

btnCloseSettings.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.style.display = 'none';
    }
});

// Only a change made with the buttons is saved, so an untouched pad follows whatever the default is.
function updateFontSize(save = false) {
    fontSizeDisplay.textContent = currentFontSize + ' pt';
    document.documentElement.style.setProperty('--editor-font-size', currentFontSize + 'pt');
    if (save) {
        try {
            localStorage.setItem(FONT_SIZE_KEY, String(currentFontSize));
        } catch (e) {
            console.warn('Cannot save font size to localStorage:', e);
        }
    }
    notifyHeightBasedOnRows();
}

function changeFontSize(delta: number) {
    const next = clampFontSize(currentFontSize + delta);
    if (next === currentFontSize) return;
    currentFontSize = next;
    updateFontSize(true);
}

btnFontInc.addEventListener('click', () => changeFontSize(1));
btnFontDec.addEventListener('click', () => changeFontSize(-1));

updateFontSize();
// Notify initial height if rows parameter is set
notifyHeightBasedOnRows();
