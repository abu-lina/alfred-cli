import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pollGitHub, parseGhPrJson, parseGhIssueJson } from './ghPoller.js';
import type { ProjectConfig } from './config.js';
import * as child_process from 'node:child_process';

vi.mock('node:child_process');

const project: ProjectConfig = {
  name: 'test',
  prefix: 'TE',
  path: '/tmp/test',
  repo: 'owner/repo',
  rexSession: 'test-foreman',
};

const prJson = JSON.stringify([
  {
    number: 1,
    title: 'feat: add stuff',
    state: 'OPEN',
    isDraft: true,
    url: 'https://github.com/owner/repo/pull/1',
    headRefName: 'feat/1-add-stuff',
    labels: [{ name: 'P0' }, { name: 'type:feat' }],
    reviewDecision: 'REVIEW_REQUIRED',
    statusCheckRollup: [{ state: 'SUCCESS' }],
  },
]);

const issueJson = JSON.stringify([
  { number: 10, title: 'todo item', labels: [{ name: 'ready' }] },
]);

describe('parseGhPrJson', () => {
  it('parses gh pr list JSON into typed PullRequest array', () => {
    const prs = parseGhPrJson(prJson);
    expect(prs).toHaveLength(1);
    expect(prs[0]).toEqual({
      number: 1,
      title: 'feat: add stuff',
      state: 'OPEN',
      isDraft: true,
      url: 'https://github.com/owner/repo/pull/1',
      headRefName: 'feat/1-add-stuff',
      labels: ['P0', 'type:feat'],
      reviewDecision: 'REVIEW_REQUIRED',
      checksStatus: 'pass',
    });
  });

  it('returns empty array for empty JSON array', () => {
    expect(parseGhPrJson('[]')).toEqual([]);
  });

  it('maps FAILURE status check to fail', () => {
    const json = JSON.stringify([{
      number: 2, title: 'x', state: 'OPEN', isDraft: false,
      url: 'u', headRefName: 'b', labels: [],
      reviewDecision: '', statusCheckRollup: [{ state: 'FAILURE' }],
    }]);
    expect(parseGhPrJson(json)[0]!.checksStatus).toBe('fail');
  });

  it('maps PENDING status check to pending', () => {
    const json = JSON.stringify([{
      number: 3, title: 'x', state: 'OPEN', isDraft: false,
      url: 'u', headRefName: 'b', labels: [],
      reviewDecision: '', statusCheckRollup: [{ state: 'PENDING' }],
    }]);
    expect(parseGhPrJson(json)[0]!.checksStatus).toBe('pending');
  });

  it('maps missing statusCheckRollup to unknown', () => {
    const json = JSON.stringify([{
      number: 4, title: 'x', state: 'OPEN', isDraft: false,
      url: 'u', headRefName: 'b', labels: [], reviewDecision: '',
    }]);
    expect(parseGhPrJson(json)[0]!.checksStatus).toBe('unknown');
  });
});

describe('parseGhIssueJson', () => {
  it('parses gh issue list JSON into typed array', () => {
    const issues = parseGhIssueJson(issueJson);
    expect(issues).toEqual([
      { number: 10, title: 'todo item', labels: ['ready'] },
    ]);
  });
});

describe('pollGitHub', () => {
  const execSync = vi.mocked(child_process.execSync);

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('calls gh pr list and gh issue list for the repo', () => {
    execSync.mockImplementation((cmd: string) => {
      if (cmd.includes('pr list')) return Buffer.from(prJson);
      if (cmd.includes('issue list')) return Buffer.from(issueJson);
      return Buffer.from('[]');
    });

    const state = pollGitHub(project);
    expect(state.prs).toHaveLength(1);
    expect(state.openIssues).toHaveLength(1);
    expect(state.updatedAt).toBeGreaterThan(0);

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('gh pr list'),
      expect.objectContaining({ encoding: 'utf-8' }),
    );
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('gh issue list'),
      expect.objectContaining({ encoding: 'utf-8' }),
    );
  });

  it('throws when gh command fails', () => {
    execSync.mockImplementation(() => { throw new Error('gh auth expired'); });
    expect(() => pollGitHub(project)).toThrow(/gh auth expired/);
  });
});
