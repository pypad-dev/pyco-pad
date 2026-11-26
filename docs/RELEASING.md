# Releasing

`npm run release -- <version>` runs the checks on this computer, and only if they all pass tags the commit (`pad-v<version>`) and pushes the tag. GitHub then builds it and publishes it to Cloudflare (about a minute: `.github/workflows/release.yml`).

```bash
cd ~/pynote/pyco-pad-main
npm run release                  # says what the last release was and suggests the next version
npm run release -- 1.0.0-rc.1    # a candidate: published at /v1.0.0-rc.1/ and /latest-rc/ only, to try first
npm run release -- 1.0.0         # check everything, then publish
npm run release -- 1.0.1 --dry   # every check, and stop before tagging
gh run list --workflow Release --limit 1   # watch GitHub publish it
```

Before running it: commit and push everything. It stops if there are uncommitted changes, this is not `main`, or `main` here is not what is on GitHub.

## The addresses

| Address | What it holds | Use it for |
|---|---|---|
| `/v1.0.0/` | that release, and it never changes | an exam |
| `/v1.0/` | the newest release of 1.0: fixes, never a new minor | a course for a term (the question builder's default) |
| `/v1/` | the newest release of major 1 | |
| `/latest/` | the newest release of all | a page that should always have the newest |
| `/v1.0.1-rc.1/`, `/latest-rc/` | candidates | trying what is coming, in Moodle, before releasing it |
| `/` (the site root) | the original site from before versions (15 September 2026, kept in `site-legacy/`), and never changes | questions written before versions, which load `/pycopad-mdl-quiz.js` |

A question loads `<address>/pycopad-mdl-quiz.js`; everything else (the editor page, the lms-widget-manager, the toggle plugin) comes from the same folder, so a question gets exactly the release it names. `/versions.json` lists the releases (the question builder reads it to offer them), and `/releases/` is a page that lists them.

Numbering: a fix is a patch (1.0.1); anything that could change how an existing question behaves or looks is a new minor (1.1.0), so courses on `/v1.0/` do not get it until they choose to.

## Candidates

A candidate (`1.0.1-rc.1`) is published at its own folder and `/latest-rc/` only: nothing a question uses moves, and it is not remembered (the next publish leaves its folder out). Try it in Moodle (a question that loads `/v1.0.1-rc.1/pycopad-mdl-quiz.js`, or the builder set to that version), then release `1.0.1` from the same commit. A version number is never reused.

## How it works

`scripts/release-lib.mjs` decides which folders a version writes (tested in `tests/release.test.ts`; the same rules as PyPad's). `scripts/assemble-site.mjs` puts the site together: `site-legacy/` at the root, every earlier release (from the `releases` branch, built files only), and the new one. Each Cloudflare deployment replaces the whole site, which is why the earlier releases are kept on that branch and published again each time. `site-legacy/` must never be edited.

The lms-widget-manager is pinned in `package.json` (`github:pypad-dev/lms-widget-manager#v1.1.0`); `npm install` builds it and copies it into `public/`, and each release ships the copy it was built with. To move to a newer manager, change the tag, run `npm install`, and release.

## One-time setup

The site is a Cloudflare Worker with static assets (`wrangler.jsonc`: the Worker `pycopad`, serving the folder `site/`, on the domain `pythoncodepad.com`). `npx wrangler deploy` makes the Worker the first time and updates it after, and attaches the domain, so there is no project to create by hand. The domain's zone must be in the same Cloudflare account.

In the GitHub repository's settings: secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The token needs the "Edit Cloudflare Workers" template, plus permission on the domain's zone (Workers Routes: Edit, and DNS: Edit, so the custom domain can be attached). If the site is not `https://pythoncodepad.com`, also the variable `PYCOPAD_SITE` (and `PYCOPAD_SITE=... npm run release` for the message it prints).

The older site, `https://pyco-pad.pages.dev`, is a separate Pages project that Cloudflare builds from another repository. Leave it as it is: questions written before versions load from it, and it keeps working. The new site also holds the same frozen files at its root.
