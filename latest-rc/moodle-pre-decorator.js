(function () {
  // Puts the code on the clipboard, trying in turn until one works. Resolves true only if it did.
  //  1. Ask the browser to copy and give it the text when it fires its copy event. The block is selected for the purpose, and the
  //     selection is put back; no box, and the focus stays where it is (in the pad, say).
  //  2. Copy from a temporary box, which takes the focus for a moment and gives it back.
  //  3. navigator.clipboard, which the browser refuses while the page itself has no focus (the cursor is in the pad's iframe),
  //     and which does not exist on a page that is not https.
  function copyText(text, pre, returnFocusTo) {
    let ok = false;
    const selection = window.getSelection ? window.getSelection() : null;
    const saved = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
    const onCopy = (e) => {
      if (!e.clipboardData) return;
      e.clipboardData.setData('text/plain', text);
      e.preventDefault();
      ok = true;
    };
    document.addEventListener('copy', onCopy, true);
    try {
      if (selection) selection.selectAllChildren(pre);
      document.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    document.removeEventListener('copy', onCopy, true);
    if (selection) {
      selection.removeAllRanges();
      if (saved) selection.addRange(saved);
    }
    if (ok) return Promise.resolve(true);

    const box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.cssText = 'position: fixed; top: 0; left: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none;';
    try {
      document.body.appendChild(box);
      box.focus({ preventScroll: true });
      box.select();
      ok = document.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    box.remove();
    if (returnFocusTo && returnFocusTo.focus) returnFocusTo.focus();
    if (ok) return Promise.resolve(true);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true, err => {
        console.error('[Moodle Decorator] Clipboard failed:', err);
        return false;
      });
    }
    return Promise.resolve(false);
  }

  function decoratePreTagsInBlock(questionBlock) {
    // A question can switch the buttons off: data-use-buttons="false" on its script
    if (questionBlock.querySelector('[data-use-buttons="false"]')) return;
    // Automatically close any <details> tags that might have been saved in an open state by TinyMCE
    questionBlock.querySelectorAll('details').forEach(details => details.removeAttribute('open'));

    const preTags = questionBlock.querySelectorAll('pre:not(#notice pre):not(.debugging pre):not(.no-use):not([data-no-use])');

    preTags.forEach(pre => {
      if (pre.hasAttribute('data-decorated')) return;
      pre.setAttribute('data-decorated', 'true');

      // Create a wrapper to safely absolute-position the button over the pre (even if it scrolls)
      const wrapper = document.createElement('div');
      wrapper.className = 'moodle-pre-wrapper';
      wrapper.style.position = 'relative';

      // Copy margins and font-size so layout and button scale perfectly with the pre
      const style = window.getComputedStyle(pre);
      wrapper.style.marginTop = style.marginTop;
      wrapper.style.marginBottom = style.marginBottom;
      wrapper.style.fontSize = style.fontSize;
      pre.style.marginTop = '0';
      pre.style.marginBottom = '0';

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      // Create a button wrapper
      const btn = document.createElement('div');
      btn.textContent = 'Use';
      // Consistent sizing that won't shrink if the pre font-size is small
      btn.style.cssText = 'position: absolute; right: 8px; bottom: 8px; z-index: 10; user-select: none; cursor: pointer; background: #0e639c; color: white; padding: 5px 12px; border-radius: 4px; font-family: sans-serif; font-size: 13px; line-height: 1.2; font-weight: 500; box-shadow: 0 1px 3px rgba(0,0,0,0.15); transition: background 0.2s;';

      // Hover feedback
      btn.addEventListener('mouseenter', () => {
        if (btn.textContent === 'Use') btn.style.background = '#1177bb';
      });
      btn.addEventListener('mouseleave', () => {
        if (btn.textContent === 'Use') btn.style.background = '#0e639c';
      });

      // Prevent focus loss when clicking the button
      btn.addEventListener('mousedown', (e) => e.preventDefault());

      btn.addEventListener('click', () => {
        const text = pre.innerText + '\n';
        const activeEl = document.activeElement;

        // 1. Put it on the clipboard (the cursor's place is given back afterwards)
        const copied = copyText(text, pre, activeEl);

        // 2. Attempt live insertion scoped to this question block
        if (activeEl && activeEl.tagName === 'IFRAME' && questionBlock.contains(activeEl)) {
          console.log('[Moodle Decorator] Sending code to active iframe in this question block');
          activeEl.contentWindow.postMessage({ type: 'INSERT_CONTENT', payload: { content: text } }, '*');
        } else if (activeEl && (activeEl.isContentEditable || ['TEXTAREA', 'INPUT'].includes(activeEl.tagName)) && questionBlock.contains(activeEl)) {
          console.log('[Moodle Decorator] Inserting code into active element in this question block');
          if (activeEl.setRangeText) {
            activeEl.setRangeText(text, activeEl.selectionStart, activeEl.selectionEnd, 'end');
          } else if (document.execCommand) {
            document.execCommand('insertText', false, text);
          } else {
            activeEl.value += text;
          }
        }
        // Visual feedback: only "Copied!" if it really is on the clipboard
        copied.then(ok => {
          btn.textContent = ok ? 'Copied!' : 'Not copied';
          btn.style.background = ok ? '#4ec9b0' : '#c0392b';
          setTimeout(() => {
            btn.textContent = 'Use';
            btn.style.background = '#0e639c';
          }, 1200);
        });

      });

      // Insert button inside the wrapper, overlapping the <pre>
      wrapper.appendChild(btn);
    });
  }

  // Copy policy, set by flags on the question's script (they reach the embed as data attributes):
  //   data-use-buttons="false"  no Use button on the code blocks (they are on by default)
  //   data-lock-text="true"     the question text cannot be selected, copied, cut, dragged or opened with the right-click menu
  // This is a courtesy to the student, not security: scripts can be switched off, and a screenshot still works. For an exam, SEB enforces more.
  function lockTextInBlock(questionBlock) {
    if (!questionBlock.querySelector('[data-lock-text="true"]')) return;
    const text = questionBlock.querySelector('.qtext'); // the text only, never the answer box or the pad
    if (!text || text.hasAttribute('data-locked')) return;
    text.setAttribute('data-locked', 'true');
    text.style.userSelect = 'none';
    text.style.webkitUserSelect = 'none';
    ['copy', 'cut', 'contextmenu', 'dragstart', 'selectstart'].forEach(type => text.addEventListener(type, e => e.preventDefault()));
  }

  function applyPolicy(questionBlock) {
    decoratePreTagsInBlock(questionBlock);
    lockTextInBlock(questionBlock);
  }

  function init() {
    // 1. If script is placed inside a specific question block, only decorate that block
    const script = document.currentScript;
    const currentBlock = script ? script.closest('.que, .moodle-question, .formulation, form') : null;
    if (currentBlock) {
      applyPolicy(currentBlock);
      return;
    }

    // 2. If question blocks exist on the page, decorate each question block containing a widget
    const questionBlocks = document.querySelectorAll('.que, .moodle-question');
    if (questionBlocks.length > 0) {
      questionBlocks.forEach(block => {
        if (block.querySelector('.python-ide-embed, iframe[data-lms-widget], iframe')) {
          applyPolicy(block);
        }
      });
      return;
    }

    // 3. Fallback for standalone pages / test snippets
    applyPolicy(document);
  }

  // Run as soon as DOM is ready or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
