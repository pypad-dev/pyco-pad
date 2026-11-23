(function() {
  console.warn('[PycoPad] You are loading embed.js, which is deprecated. It is automatically loading pycopad-mdl-quiz.js for backwards compatibility. Please update your embed codes to point to pycopad-mdl-quiz.js directly.');
  
  const currentScript = document.currentScript;
  let base = 'https://pyco-pad.pages.dev';
  if (currentScript && currentScript.src) {
    try {
      base = new URL('.', currentScript.src).href.replace(/\/$/, '');
    } catch (e) { }
  }

  const script = document.createElement('script');
  script.src = `${base}/pycopad-mdl-quiz.js`;
  
  // Copy all data attributes so pycopad-mdl-quiz.js inherits them
  if (currentScript) {
    Array.from(currentScript.attributes).forEach(attr => {
      if (attr.name.startsWith('data-')) {
        script.setAttribute(attr.name, attr.value);
      }
    });
  }

  document.head.appendChild(script);
})();
