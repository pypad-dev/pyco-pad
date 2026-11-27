(function () {
  // Puts text on the clipboard. The browser refuses navigator.clipboard when the page itself does not have focus, which is the
  // case while the cursor is in the pad (an iframe), so the copy is first done from a temporary box, and the clipboard call is
  // the fallback. Focus is given back afterwards. Resolves true only if one of them worked.
  function copyText(text, returnFocusTo) {
    let ok = false;
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
        const copied = copyText(text, activeEl);

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

  function init() {
    // 1. If script is placed inside a specific question block, only decorate that block
    const script = document.currentScript;
    const currentBlock = script ? script.closest('.que, .moodle-question, .formulation, form') : null;
    if (currentBlock) {
      decoratePreTagsInBlock(currentBlock);
      return;
    }

    // 2. If question blocks exist on the page, decorate each question block containing a widget
    const questionBlocks = document.querySelectorAll('.que, .moodle-question');
    if (questionBlocks.length > 0) {
      questionBlocks.forEach(block => {
        if (block.querySelector('.python-ide-embed, iframe[data-lms-widget], iframe')) {
          decoratePreTagsInBlock(block);
        }
      });
      return;
    }

    // 3. Fallback for standalone pages / test snippets
    decoratePreTagsInBlock(document);
  }

  // Run as soon as DOM is ready or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
