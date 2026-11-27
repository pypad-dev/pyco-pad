// Rules for releases: what folders a new version creates. Kept free of file access so it can be tested.

/** The folder that follows the newest candidate (or the release after it). */
const LATEST_RC = 'latest-rc';
/** The folder that follows the newest release (never a candidate), whatever its major. */
const LATEST = 'latest';

const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/;

/** A candidate for a release (1.4.2-rc.1): published at its own address and at /latest-rc/, to be tried on the real site; never moves a minor's or a major's folder, and is not remembered. */
export const isCandidate = (version) => /-rc\.\d+$/.test(version);

export function parseVersion(text) {
    const m = VERSION.exec(text);
    if (!m) throw new Error(`"${text}" is not a version like 1.4.2`);
    return m.slice(1, 4).map(Number);
}

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * `existing` is the folder names already published ("v1.4.1", "v1", "next"...).
 * Returns the folders to write for `version`, or throws if the release would change something already published.
 *   v<version>        always, and never over an existing one: exams rely on it never changing
 *   v<major>.<minor>  only if this is the newest release of that minor: it follows the fixes of one minor (while the major is 0, a new minor may change things a course relies on)
 *   v<major>          only if this is the newest release of that major (a late patch to an old release must not move it backwards)
 *   latest            only if this is the newest release of all (a candidate never moves it)
 *   latest-rc         the newest candidate, to try (a pilot's link that need not change with each one); a release that is newer than every other moves it too, so it is never
 *                     left on a candidate older than what was released
 * and `fill`: a moving folder that is missing (a minor released before minors had folders, or `latest`) gets one, a copy of the release it would hold, as [folder, copied from];
 * with a candidate too, so it is there at once (a candidate is not remembered, so it is made again with each one until a release keeps it).
 */
export function planRelease(existing, version) {
    const v = parseVersion(version);
    const exact = `v${version}`;
    if (existing.includes(exact)) throw new Error(`${exact} is already published and never changes. Use a new version.`);
    const published = existing.filter((n) => /^v\d+\.\d+\.\d+$/.test(n)).map((n) => parseVersion(n.slice(1)));
    const newest = !published.some((p) => compare(p, v) >= 0);                    // (newer than every release: a candidate for an old line does not move latest-rc back)
    const fillFor = (minor) => {                                                       // (a moving folder that is missing gets a copy of what it would hold: made at once, not only at the next release)
        const fill = [];
        const newestFirst = [...published].sort((a, b) => compare(b, a));
        for (const p of newestFirst) {                                                 // (the first of each minor is its newest)
            const folder = `v${p[0]}.${p[1]}`;
            if (folder === minor || existing.includes(folder) || fill.some(([f]) => f === folder)) continue;
            fill.push([folder, `v${p.join('.')}`]);
        }
        if (newestFirst.length && !existing.includes(LATEST) && !(minor && newest)) fill.push([LATEST, `v${newestFirst[0].join('.')}`]);
        return fill;
    };
    if (isCandidate(version)) return { write: newest ? [exact, LATEST_RC] : [exact], fill: fillFor(null) }; // a candidate: its own address, and latest-rc

    const newerInMajor = published.some((p) => p[0] === v[0] && compare(p, v) > 0);
    const newerInMinor = published.some((p) => p[0] === v[0] && p[1] === v[1] && compare(p, v) > 0);
    const minor = `v${v[0]}.${v[1]}`;
    const write = [exact, ...(newerInMinor ? [] : [minor]), ...(newerInMajor ? [] : [`v${v[0]}`]), ...(newest ? [LATEST, LATEST_RC] : [])];
    return { write, fill: fillFor(minor) };
}

/**
 * Cloudflare's headers file, at the site's root. The list of versions is public, and the question builder reads it from the site; a copy of the
 * builder opened from a file (or from another address) can only read it if the site allows that.
 */
export const SITE_HEADERS = `/versions.json
  Access-Control-Allow-Origin: *
`;

/** The folder names that are releases (everything else in the releases area is left alone). */
export const isReleaseFolder = (name) => /^v\d+(\.\d+(\.\d+(-rc\.\d+)?)?)?$/.test(name) || name === 'next' || name === LATEST_RC || name === LATEST;

const versionKey = (f) => { const m = /^v(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/.exec(f); return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? Infinity : Number(m[4])]; };   // (a candidate comes before the release it leads to)
const newestFirst = (a, b) => { const x = versionKey(a), y = versionKey(b); return y[0] - x[0] || y[1] - x[1] || y[2] - x[2] || (y[3] === x[3] ? 0 : y[3] > x[3] ? 1 : -1); };

/**
 * The list of releases (/versions.json, which the question builder reads), from the published folder names.
 *   latest     the newest release (not a candidate), or the newest candidate when there is no release yet.
 *   stable     the newest release.
 *   candidate  the newest candidate, when it is newer than every release (else null).
 *   releases   every exact version, newest first.
 */
export function versionsList(folders) {
    const releases = folders.filter((f) => /^v\d+\.\d+\.\d+(-rc\.\d+)?$/.test(f)).sort(newestFirst);
    const stable = releases.find((f) => !isCandidate(f.slice(1))) ?? null;
    const newest = releases[0] ?? null;
    return { latest: stable ?? newest, stable, candidate: newest && isCandidate(newest.slice(1)) ? newest : null, releases };
}
