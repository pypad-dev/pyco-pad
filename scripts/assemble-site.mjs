// Builds the folder that is published: the frozen original site at the root, every earlier release untouched, and the new one.
//   node scripts/assemble-site.mjs --version 1.0.0 --dist dist --releases releases-checkout --out site
// `releases-checkout` holds the earlier version folders (it may be empty or missing for the first release).
//
// The root (/pycopad-mdl-quiz.js, /lms-widget-manager.iife.js, /) is the site as it was before versions (15 September 2026, kept in site-legacy/), and never
// changes: Moodle questions written before then load it from there. New questions load a version folder (/v1.0/pycopad-mdl-quiz.js).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isReleaseFolder, planRelease, versionsList } from './release-lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const { version, dist = 'dist', releases = 'releases', out = 'site', legacy = 'site-legacy' } = args;
if (!version) throw new Error('--version is required, e.g. --version 1.0.0');
if (!existsSync(join(dist, 'pycopad-mdl-quiz.js'))) throw new Error(`${dist} has no pycopad-mdl-quiz.js: run npm run build first`);
if (!existsSync(join(legacy, 'pycopad-mdl-quiz.js'))) throw new Error(`${legacy} is missing: the root must keep the site that questions from before versions load`);

const earlier = existsSync(releases) ? readdirSync(releases).filter((n) => isReleaseFolder(n) && statSync(join(releases, n)).isDirectory()) : [];
const { write, fill } = planRelease(earlier, version);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(legacy, out, { recursive: true });
for (const name of earlier) cpSync(join(releases, name), join(out, name), { recursive: true });
for (const name of write) {
    rmSync(join(out, name), { recursive: true, force: true }); // only ever a moving folder (latest, the minor's, the major's): planRelease refused any exact version that exists
    cpSync(dist, join(out, name), { recursive: true });
}
for (const [name, from] of fill) cpSync(join(out, from), join(out, name), { recursive: true });

const folders = [...new Set([...earlier, ...write, ...fill.map(([name]) => name)])].sort();
writeFileSync(join(out, 'versions.json'), JSON.stringify(versionsList(folders), null, 2) + '\n');

// A plain list of every published version, for anyone who needs an exact address
mkdirSync(join(out, 'releases'), { recursive: true });
writeFileSync(join(out, 'releases', 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Releases: PycoPad</title><link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.5}code{background:#f2f2f2;padding:0 .2em}</style></head>
<body><h1>PycoPad releases</h1>
<p>Load the quiz script from a version folder, e.g. <code>/v1.0/pycopad-mdl-quiz.js</code>. An exact version (<code>/v1.0.0/</code>) never changes: use it for an exam.
A minor's folder (<code>/v1.0/</code>) gets that minor's fixes: use it for a course. <code>/latest/</code> always has the newest release. The site root is the original version from before releases, and never changes.</p>
<ul>${folders.map((f) => `<li><a href="/${f}/">${f}</a></li>`).join('')}</ul></body></html>\n`);
console.log(`Wrote ${write.join(', ')}${fill.length ? `, and ${fill.map(([n, f]) => `${n} (from ${f})`).join(', ')}` : ''} (kept ${earlier.length} earlier folders) into ${out}`);
