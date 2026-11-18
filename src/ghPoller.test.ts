import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ProjectConfig } from './config.js';

let mockResponses: Map<string, { stdout: string; stderr: string }>;

vi.mock('node:child_process', () => {
  const actual: Record<string, unknown> = {};
  const customPromisify = Symbol.for('nodejs.util.promisify.custom');
  const mockExecFile = Object.assign(
    vi.fn((...args: unknown[]) => {
      const cb = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void;
      const cmdArgs = args[1] as string[];
      const key = cmdArgs.find(a => a === 'pr' || a === 'issue') ?? 'unknown';
      const response = mockResponses.get(key);
      if (response) cb(null, response);
      else cb(new Error('mock: no response configured'), { stdout: '', stderr: '' });
    }),
    {
      [customPromisify]: vi.fn((...args: unknown[]) => {
        const cmdArgs = args[1] as string[];
        const key = cmdArgs.find(a => a === 'pr' || a === 'issue') ?? 'unknown';
        const response = mockResponses.get(key);
        if (response) return Promise.resolve(response);
        return Promise.reject(new Error('mock: no response configured'));
      }),
    },
  );
  actual.execFile = mockExecFile;
  return actual;
});

import { pollGitHub, parseGhPrJson, parseGhIssueJson } from './ghPoller.js';

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
    createdAt: '2026-01-15T10:00:00Z',
  },
]);

const issueJson = JSON.stringify([
  { number: 10, title: 'todo item', labels: [{ name: 'ready' }], createdAt: '2026-01-20T08:00:00Z' },
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
      createdAt: new Date('2026-01-15T10:00:00Z').getTime(),
    });
  });

  it('returns empty array for empty JSON array', () => {
    expect(parseGhPrJson('[]')).toEqual([]);
  });

  it('throws on malformed JSON so allSettled can catch it', () => {
    expect(() => parseGhPrJson('not json')).toThrow();
  });

  it('maps FAILURE status check to fail', () => {
    const json = JSON.stringify([{
      number: 2, title: 'x', state: 'OPEN', isDraft: false,
      url: 'u', headRefName: 'b', labels: [],
      reviewDecision: '', statusCheckRollup: [{ state: 'FAILURE' }], createdAt: '2026-01-15T10:00:00Z',
    }]);
    expect(parseGhPrJson(json)[0]!.checksStatus).toBe('fail');
  });

  it('maps PENDING status check to pending', () => {
    const json = JSON.stringify([{
      number: 3, title: 'x', state: 'OPEN', isDraft: false,
      url: 'u', headRefName: 'b', labels: [],
      reviewDecision: '', statusCheckRollup: [{ state: 'PENDING' }], createdAt: '2026-01-15T10:00:00Z',
    }]);
    expect(parseGhPrJson(json)[0]!.checksStatus).toBe('pending');
  });

  it('maps missing statusCheckRollup to unknown', () => {
    const json = JSON.stringify([{
      number: 4, title: 'x', state: 'OPEN', isDraft: false,
      url: 'u', headRefName: 'b', labels: [], reviewDecision: '', createdAt: '2026-01-15T10:00:00Z',
    }]);
    expect(parseGhPrJson(json)[0]!.checksStatus).toBe('unknown');
  });
});

describe('parseGhIssueJson', () => {
  it('throws on malformed JSON so allSettled can catch it', () => {
    expect(() => parseGhIssueJson('{')).toThrow();
  });

  it('parses gh issue list JSON into typed array with createdAt', () => {
    const issues = parseGhIssueJson(issueJson);
    expect(issues).toEqual([
      { number: 10, title: 'todo item', labels: ['ready'], createdAt: new Date('2026-01-20T08:00:00Z').getTime() },
    ]);
  });
});

describe('pollGitHub', () => {
  beforeEach(() => {
    mockResponses = new Map([
      ['pr', { stdout: prJson, stderr: '' }],
      ['issue', { stdout: issueJson, stderr: '' }],
    ]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls gh with args array (no shell injection) and returns parsed state', async () => {
    const state = await pollGitHub(project);
    expect(state.prs).toHaveLength(1);
    expect(state.openIssues).toHaveLength(1);
    expect(state.updatedAt).toBeGreaterThan(0);
  });

  it('rejects when gh command fails', async () => {
    mockResponses.clear();
    await expect(pollGitHub(project)).rejects.toThrow(/no response configured/);
  });
});
