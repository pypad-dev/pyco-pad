// `npm run release -- 1.0.1`: runs every check on this computer, and only if all of them pass, tags the commit (pad-v1.0.1) and pushes the tag, which makes GitHub
// publish it (.github/workflows/release.yml). `-- 1.0.1-rc.1` publishes a candidate at /v1.0.1-rc.1/ and /latest-rc/ only, to try on the real site first;
// `--dry` runs every check and stops before tagging. docs/RELEASING.md.
import { execFileSync, spawnSync } from 'node:child_process';
import { isCandidate, parseVersion } from './release-lib.mjs';

const SITE = process.env.PYCOPAD_SITE || 'https://pyco-pad.pages.dev';
const PREFIX = 'pad-v';
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const version = args.find((a) => !a.startsWith('--'));
const fail = (message) => { console.error(`\nrelease: ${message}`); process.exit(1); };

if (!version) {
    const last = execFileSync('git', ['tag', '--list', `${PREFIX}*`, '--sort=-v:refname'], { encoding: 'utf8' }).split('\n').find((t) => /^pad-v\d+\.\d+\.\d+$/.test(t));
    const [major, minor, patch] = last ? parseVersion(last.slice(PREFIX.length)) : [0, 9, 9];
    const next = last ? `${major}.${minor}.${patch + 1}` : '1.0.0';
    fail(`say the version.${last ? ` The last release is ${last.slice(PREFIX.length)}; the next could be ${next}.` : ' There is no release yet; the first is 1.0.0.'}\n  npm run release -- ${next}          (everything checked, then published)\n  npm run release -- ${next}-rc.1     (a candidate, to try on the real site first)`);
}
try { parseVersion(version); } catch (error) { fail(error.message); }
const tag = `${PREFIX}${version}`;

const out = (command, ...rest) => execFileSync(command, rest, { encoding: 'utf8' }).trim();
const run = (title, command, ...rest) => {
    console.log(`\n=== ${title}`);
    const result = spawnSync(command, rest, { stdio: 'inherit', env: process.env });
    if (result.status !== 0) fail(`"${title}" did not pass, so nothing was tagged.`);
};

// The commit that is tagged is the one that was tested, and the one GitHub will build
if (out('git', 'status', '--porcelain')) fail('there are uncommitted changes. Commit them first.');
if (out('git', 'rev-parse', '--abbrev-ref', 'HEAD') !== 'main') fail('this is not the main branch.');
execFileSync('git', ['fetch', '--tags', '--quiet', 'origin']);
if (out('git', 'rev-parse', 'HEAD') !== out('git', 'rev-parse', 'origin/main')) fail('main here is not the same as main on GitHub. Push (or pull) first.');
if (out('git', 'tag', '--list', tag)) fail(`${tag} already exists. A published version never changes: use a new one.`);

run('Type check', 'npm', 'run', 'typecheck');
run('Tests', 'npm', 'test');
run('Build', 'npm', 'run', 'build');

if (dry) { console.log(`\nAll checks passed. (--dry: ${tag} was not made.)`); process.exit(0); }
console.log(`\n=== Tagging ${tag}`);
execFileSync('git', ['tag', tag], { stdio: 'inherit' });
execFileSync('git', ['push', 'origin', tag], { stdio: 'inherit' });
console.log(`\nPushed ${tag}. GitHub is publishing it (about a minute): ${SITE}/v${version}/${isCandidate(version) ? ' (a candidate: nothing else moves)' : ''}\n  gh run list --workflow Release --limit 1`);
