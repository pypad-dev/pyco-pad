# PycoPad

A small Python code pad (Skulpt, in the browser) that can replace the answer box of a Moodle essay question, saving the student's code into it through [lms-widget-manager](https://github.com/pypad-dev/lms-widget-manager).

## In a Moodle question

Add to the question text (the question builder, `/CodepadQuestionBuilder.html`, writes it for you):

```html
<script src="https://pythoncodepad.com/v1.0/pycopad-mdl-quiz.js" data-create-pad data-strategy="default"></script>
```

The essay question's response format must be "Plain text" (or "Plain text, monospaced font"), and Moodle must allow scripts in question text.

Pick the version in the address: `/v1.0.0/` never changes (exams), `/v1.0/` gets that minor's fixes (a course), `/latest/` always has the newest. Questions from before versions load from the site root, which never changes. See [docs/RELEASING.md](docs/RELEASING.md).

## Developing

```bash
npm install      # also builds the pinned lms-widget-manager and copies it into public/
npm run dev
npm test
npm run build
```

Releases: `npm run release -- <version>` ([docs/RELEASING.md](docs/RELEASING.md)).

## Licence

MIT
