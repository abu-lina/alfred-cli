import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RefreshState, GitHubState, FileWatchState } from './types.js';
import type { ProjectConfig } from './config.js';

// Mock child_process before importing the module under test
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';
import { buildStandup, fetchMergedPRs, fetchClosedIssues, fetchCommits } from './standup.js';

const execFileMock = vi.mocked(execFile);

function mockExec(stdout: string) {
  execFileMock.mockImplementation(
    ((_cmd: unknown, _args: unknown, _opts: unknown, cb?: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
      if (cb) cb(null, { stdout, stderr: '' });
    }) as typeof execFile,
  );
}

function mockExecSequence(responses: string[]) {
  let i = 0;
  execFileMock.mockImplementation(
    ((_cmd: unknown, _args: unknown, _opts: unknown, cb?: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
      const stdout = responses[i++] ?? '[]';
      if (cb) cb(null, { stdout, stderr: '' });
    }) as typeof execFile,
  );
}

const PROJECT: ProjectConfig = {
  name: 'test-project',
  prefix: 'TP',
  path: '/tmp/test-project',
  repo: 'owner/test-project',
  rexSession: 'tp-foreman',
};

function makeState(overrides: {
  prs?: GitHubState['prs'];
  signals?: FileWatchState['signals'];
} = {}): RefreshState {
  const gh: GitHubState = {
    prs: overrides.prs ?? [],
    openIssues: [],
    updatedAt: Date.now(),
  };
  const files: FileWatchState = {
    signals: overrides.signals ?? [],
    notes: [],
    reviews: [],
  };
  return {
    github: new Map([['owner/test-project', gh]]),
    files: new Map([['/tmp/test-project', files]]),
    rexEvents: [],
    sources: { github: 'ok', fileWatch: 'ok', rex: 'ok' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchMergedPRs', () => {
  it('parses merged PR JSON from gh', async () => {
    mockExec(JSON.stringify([
      { number: 10, title: 'feat: add login', mergedAt: '2026-11-19T10:00:00Z' },
    ]));
    const prs = await fetchMergedPRs('owner/repo', '2026-11-18');
    expect(prs).toEqual([
      { number: 10, title: 'feat: add login', mergedAt: '2026-11-19T10:00:00Z' },
    ]);
  });

  it('returns empty on error', async () => {
    execFileMock.mockImplementation(
      ((_cmd: unknown, _args: unknown, _opts: unknown, cb?: (err: Error | null) => void) => {
        if (cb) cb(new Error('gh not found'));
      }) as typeof execFile,
    );
    const prs = await fetchMergedPRs('owner/repo', '2026-11-18');
    expect(prs).toEqual([]);
  });
});

describe('fetchClosedIssues', () => {
  it('parses closed issue JSON from gh', async () => {
    mockExec(JSON.stringify([
      { number: 3, title: 'fix: crash on load', closedAt: '2026-11-19T08:00:00Z' },
    ]));
    const issues = await fetchClosedIssues('owner/repo', '2026-11-18');
    expect(issues).toEqual([
      { number: 3, title: 'fix: crash on load', closedAt: '2026-11-19T08:00:00Z' },
    ]);
  });
});

function nulLine(...fields: string[]): string {
  return fields.join(String.fromCharCode(0));
}

describe('fetchCommits', () => {
  it('parses git log output', async () => {
    mockExec(
      nulLine('abc1234', 'feat: add login', '2026-11-19T10:00:00+00:00') + '\n' +
      nulLine('def5678', 'fix: typo', '2026-11-19T09:00:00+00:00') + '\n',
    );
    const commits = await fetchCommits('/tmp/repo', '2026-11-18');
    expect(commits).toEqual([
      { sha: 'abc1234', message: 'feat: add login', date: '2026-11-19T10:00:00+00:00' },
      { sha: 'def5678', message: 'fix: typo', date: '2026-11-19T09:00:00+00:00' },
    ]);
  });

  it('returns empty on empty output', async () => {
    mockExec('');
    const commits = await fetchCommits('/tmp/repo', '2026-11-18');
    expect(commits).toEqual([]);
  });

  it('handles commit messages containing pipe characters', async () => {
    mockExec(nulLine('abc1234', 'fix: handle A|B case', '2026-11-19T10:00:00+00:00') + '\n');
    const commits = await fetchCommits('/tmp/repo', '2026-11-18');
    expect(commits).toEqual([
      { sha: 'abc1234', message: 'fix: handle A|B case', date: '2026-11-19T10:00:00+00:00' },
    ]);
  });
});

describe('buildStandup', () => {
  it('includes blockers from inbox at the top', async () => {
    const state = makeState({
      prs: [{
        number: 1, title: 'feat: thing', state: 'OPEN', isDraft: true,
        url: '', headRefName: 'feat/5-thing', labels: [],
        reviewDecision: '', checksStatus: 'pass', createdAt: Date.now(),
      }],
      signals: [{ type: 'block', issue: 5, message: 'stuck on API', timestamp: Date.now() }],
    });
    mockExecSequence(['[]', '[]', '']);
    const data = await buildStandup([PROJECT], state);
    expect(data.blockers).toHaveLength(1);
    expect(data.blockers[0]!.reason).toBe('Blocked');
  });

  it('omits projects with no activity', async () => {
    const state = makeState();
    mockExecSequence(['[]', '[]', '']);
    const data = await buildStandup([PROJECT], state);
    expect(data.sections).toHaveLength(0);
  });

  it('includes project sections with merged PRs', async () => {
    const state = makeState();
    const mergedPRs = JSON.stringify([
      { number: 10, title: 'feat: login', mergedAt: '2026-11-19T10:00:00Z' },
    ]);
    mockExecSequence([mergedPRs, '[]', '']);
    const data = await buildStandup([PROJECT], state);
    expect(data.sections).toHaveLength(1);
    expect(data.sections[0]!.prefix).toBe('TP');
    expect(data.sections[0]!.mergedPRs).toHaveLength(1);
  });
});
