# Copying from a question

Two flags on a question's script (`<script src=".../pycopad-mdl-quiz.js" data-create-pad ...>`) set what a student can take from the question text. The question builder writes them (the two options under "Answer size"). They reach the embed as data attributes, and `moodle-pre-decorator.js` (loaded by the quiz script from its own folder, so the same version) applies them. Nothing in lms-widget-manager is involved.

| Flag | Default | Does |
|---|---|---|
| `data-use-buttons="false"` | buttons on | no "Use" button on the code blocks |
| `data-lock-text="true"` | not locked | the question text cannot be selected, copied, cut, dragged or opened with the right-click menu |

The Use button still works in a locked question: it copies the block itself. It tries three ways in turn: the browser's copy command with a copy event that supplies the exact text (no focus change), a temporary box, then `navigator.clipboard` (refused while the cursor is in the pad's iframe, and missing on a page that is not https). It says "Copied!" only if one of them worked, and "Not copied" if none did.

Code images (see CODE-IMAGE.md) want the opposite of the buttons: turn the buttons off for a question that is a code image.

## What it does not do

Both flags are a courtesy, not security: a student can switch scripts off, read the page source, or take a screenshot. To enforce more in an exam, use Safe Exam Browser's own clipboard and right-click settings. The flags only touch the question text (`.qtext`), never the answer box or the pad.
