# Code as an image

Shows code in a question as a picture, so a student cannot select or copy it. It is a static page in every release, so nothing is sent to a server.

## Making one

Open `https://pythoncodepad.com/v1.1/code-image` (any version folder: it makes iframes that load the same folder). It opens the pad with a Python helper loaded. Put the code between the triple quotes, press Run, and paste the iframe from the output into the question text.

```html
<iframe src="https://pythoncodepad.com/v1.1/code-image#Zm9yIHZhbCBpbiByYW5nZSg2KTo…" title="Code (image)" width="100%" height="152" style="border:0"></iframe>
```

For an exam, use an exact version (`/v1.1.0/code-image`): the picture then never changes. `ALT` in the helper is read aloud by screen readers; empty, they hear only that it is code.

## What the address holds

`code-image#<code>&alt=<text>`: the code as URL-safe base64 (UTF-8, no padding), then an optional description, percent-encoded. The part after `#` never reaches a server. With nothing after the `#`, the page opens the helper instead. The pad opens with `#b=<base64>` the same way (it is how the helper is loaded).

The height is `ceil(lines × 22.4 + 40)` pixels, worked out in whole numbers (`(lines × 224 + 400 + 9) // 10`) so the helper and the page agree exactly. Blank lines at either end are dropped, and a tab is drawn as four spaces. The colours are the pad's.

The helper carries its own few lines of base64 because Skulpt's `base64` module is not implemented. `tests/code-image.test.ts` checks the page's encoding against what real Python gives.

## What it does not stop

It stops selecting and copying. It does not stop a screenshot, a student who reads the address from the page source and decodes it, or a tool that reads text from a picture. A canvas has no text, so a student who uses a screen reader needs the code another way (the description helps only a little): plan for that through your usual adjustments.

The builder's "Use buttons on code blocks" option (the `moodle-pre-decorator.js` script) is the opposite of this: its buttons copy a code block into the pad. Do not turn it on for a question that is a code image. If a page loads that script for every question, add `data-no-use` to any `<pre>` that must not get a button: the script also decorates the blocks of a question that has an iframe.
