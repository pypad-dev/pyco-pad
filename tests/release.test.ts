import { describe, it, expect } from 'vitest';
import { planRelease, parseVersion, isReleaseFolder, isCandidate, versionsList } from '../scripts/release-lib.mjs';

describe('release plan', () => {
    it('the first release makes its own folder, its minor\'s and the major', () => expect(planRelease([], '1.0.0').write).toEqual(['v1.0.0', 'v1.0', 'v1', 'latest', 'latest-rc']));
    it('a newer release moves its minor and the major forward', () => expect(planRelease(['v1.0.0', 'v1.0', 'v1', 'v1.4.1', 'v1.4'], '1.4.2').write).toEqual(['v1.4.2', 'v1.4', 'v1', 'latest', 'latest-rc']));
    it('latest follows the newest release of all, a new major too; a late patch to an old line does not move it, nor does a candidate', () => {
        expect(planRelease(['v1.9.0', 'v1', 'latest'], '2.0.0').write).toContain('latest');
        expect(planRelease(['v2.0.0', 'v2', 'v1.9.0', 'v1', 'latest'], '1.9.1').write).not.toContain('latest');
        expect(planRelease(['v1.9.0', 'v1', 'latest'], '2.0.0-rc.1').write).not.toContain('latest');
    });
    it('a late patch to an old minor moves that minor, not the major backwards', () => expect(planRelease(['v1.4.8', 'v1.4', 'v1.5.0', 'v1.5', 'v1'], '1.4.9').write).toEqual(['v1.4.9', 'v1.4']));
    it('a new major leaves the old major alone', () => expect(planRelease(['v1.9.0', 'v1.9', 'v1'], '2.0.0').write).toEqual(['v2.0.0', 'v2.0', 'v2', 'latest', 'latest-rc']));
    it('a minor released before minors had folders gets one, a copy of its newest release; the minor being released is written, not copied', () => {
        expect(planRelease(['v0.2.20', 'v0.2.21', 'v0.3.0', 'v0.3.1', 'v0', 'v0.4.0-rc.17'], '0.4.0')).toEqual({ write: ['v0.4.0', 'v0.4', 'v0', 'latest', 'latest-rc'], fill: [['v0.3', 'v0.3.1'], ['v0.2', 'v0.2.21']] });
        expect(planRelease(['v0.3.1', 'v0.3', 'v0.4.0', 'v0.4', 'v0', 'latest'], '0.3.2')).toEqual({ write: ['v0.3.2', 'v0.3'], fill: [] });
        expect(planRelease(['v0.3.1', 'v0.3', 'v0.4.0', 'v0.4', 'v0'], '0.3.2').fill).toEqual([['latest', 'v0.4.0']]);           // (latest, missing, is the newest release: not the late patch)
        expect(planRelease(['v0.2.22', 'v0.3.1', 'v0'], '0.4.0-rc.19')).toEqual({ write: ['v0.4.0-rc.19', 'latest-rc'], fill: [['v0.3', 'v0.3.1'], ['v0.2', 'v0.2.22'], ['latest', 'v0.3.1']] });      // (a candidate makes the missing ones at once)
    });
    it('a minor\'s folder is a release folder (kept from release to release)', () => expect(isReleaseFolder('v0.4')).toBe(true));
    it('never rewrites a published version', () => expect(() => planRelease(['v1.4.2'], '1.4.2')).toThrow(/never changes/));
    it('refuses odd versions', () => { for (const v of ['1.4', 'v1.4.2', '1.4.2-beta', '1.4.2-rc', '1.4.2-rc.', '']) expect(() => parseVersion(v)).toThrow(); });
    it('a candidate (1.4.2-rc.1) is published at its own address only, and never moves the major', () => {
        expect(isCandidate('1.4.2-rc.1')).toBe(true);
        expect(isCandidate('1.4.2')).toBe(false);
        expect(planRelease(['v1.4.1', 'v1'], '1.4.2-rc.1').write).toEqual(['v1.4.2-rc.1', 'latest-rc']);      // (and the address that follows the newest candidate)
        expect(planRelease([], '1.0.0-rc.2').write).toEqual(['v1.0.0-rc.2', 'latest-rc']);
        expect(planRelease(['v1.5.0', 'v1'], '1.4.3-rc.1').write).toEqual(['v1.4.3-rc.1']);                   // (a candidate for an older line does not move latest-rc back)
        expect(() => planRelease(['v1.4.2-rc.1'], '1.4.2-rc.1')).toThrow(/never changes/);
        expect(planRelease(['v1.4.1', 'v1.4', 'v1', 'v1.4.2-rc.1', 'latest', 'latest-rc'], '1.4.2').write).toEqual(['v1.4.2', 'v1.4', 'v1', 'latest', 'latest-rc']); // the real release, after its candidates: latest-rc is not left on an older candidate
    });
    it('knows which folders are releases', () => {
        expect(['v1', 'v1.4', 'v1.4.2', 'v1.4.2-rc.1', 'next', 'latest', 'latest-rc'].every(isReleaseFolder)).toBe(true);
        expect(['.git', 'index.html', 'v1.4.x', 'assets'].some(isReleaseFolder)).toBe(false);
    });
});

describe('the lists of releases', () => {
    const site = versionsList(['v0', 'v0.2.22', 'v0.3.1', 'v0.4.0-rc.12', 'next', 'pyodide']);
    it('latest is the newest release, never a candidate', () => expect(site).toEqual({ latest: 'v0.3.1', stable: 'v0.3.1', candidate: 'v0.4.0-rc.12', releases: ['v0.4.0-rc.12', 'v0.3.1', 'v0.2.22'] }));
    it('no candidate once its release is out', () => expect(versionsList(['v0.4.0-rc.12', 'v0.4.0', 'v0.3.1']).candidate).toBeNull());
    it('a candidate sorts before its release and after the one before', () => expect(versionsList(['v1.0.0', 'v1.0.1-rc.2', 'v1.0.1-rc.10', 'v1.0.1']).releases).toEqual(['v1.0.1', 'v1.0.1-rc.10', 'v1.0.1-rc.2', 'v1.0.0']));
    it('with only candidates, latest is the newest of them', () => expect(versionsList(['v1.0.0-rc.1']).latest).toBe('v1.0.0-rc.1'));
});
