# Ideas

Things talked about and left for later. None of this is decided or planned; each has what it would involve and what was said for and against.

## Copying and the question text

- **A "Use selection" button.** Select text by hand anywhere in the question (a sentence, an inline `code` snippet) and a small button next to the selection copies it and inserts it into the pad, as the Use button does for a whole code block. Covers text that has no block of its own. Would live in `moodle-pre-decorator.js` (the copy policy plugin, docs/COPY-POLICY.md), probably as a `selectionchange` listener inside questions that have a pad.
- **A lock that still allows selecting.** Text can be highlighted and read, but copy, cut and drag are blocked. Weak: anything highlightable can be copied with the keyboard shortcut anyway. Only worth it if "no selecting at all" is too harsh for readers.
- **A real clipboard check for the Use button.** The copy tries three methods and says "Not copied" if none worked, but this has only been shown in tests and a preview where the clipboard could not be read. Try it in the browsers students use (and in Safe Exam Browser) and note which method works where.

## Code images

- **Server-side encryption (not recommended).** A Worker holding a secret decrypts a sealed address and returns a PNG, so view-source shows nothing readable. Raises the bar from "decode base64" to "OCR or screenshot", which is the realistic route anyway. Costs: the site stops being static, an SVG-to-PNG renderer with embedded fonts, a secret that must live forever (rotating it breaks every old exam), and the code travels to the server (in logs). A passphrase in the embed code adds nothing.
- **Author recovery page.** A page that takes a passphrase and decrypts a sealed copy back to the original text, entirely in the browser (Web Crypto, no server). Useful when the source of a code image is lost. Cheap and separate from the server idea.
- **Accessible alternative.** A canvas has no text, so a screen reader user cannot read the code. The optional description helps only a little. Needs a plan through the usual adjustments route; possibly a flag that shows the code as text on request.
- **A light theme, and a font size,** for the image.
- **A maker without Python.** The Python helper runs in the pad. A plain form on the page that does the same would suit authors who do not want to run code.

## The pad

- **Local history and undo that survives navigating away.** Discussed early: it must never become a second source of truth next to Moodle's saved answer. Would need a lease so that two windows on the same question cannot both write.
- **A blinking or pulsing `_` in the logo** to show that saves are happening. Unclear whether it would distract; a one-shot pulse on each acknowledged save is the quieter version.
- **Full-screen notes** as a layout state. Decided against: it hides the code, which is what is marked, and it adds a fourth state to the layout button. A higher drag limit (95%) gives most of it.
- **Accessibility, still open:** the output as `role="log"`, labels on every icon button, a visible focus ring on the editor, lighter line numbers.
- **Check where `postMessage` is trusted.** The pad posts with `'*'` and does not check the sender's origin or source on what it receives.
- **The embed's first height** (`115 + rows × 24`) was not updated for the bars that were removed; the pad corrects it on load, so there is a brief jump.
- **Light and high-contrast themes** and **touch dragging** of the divider have not been tried with the newer layout, the notes view and the rail.

## Releases and the site

- **Keep candidates until they are replaced on purpose.** A new candidate currently removes the one before it, so a question that points at an old candidate breaks. A short list of kept candidates would avoid that, at the cost of more folders.
- **Redirect http to https** at the Cloudflare zone ("Always Use HTTPS"), since the site answers a plain http address with a 404.
- **A "this version has code images" check in the builder,** so a question that uses one cannot be exported with a version older than 1.1.
