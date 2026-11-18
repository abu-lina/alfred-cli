import { describe, it, expect } from 'vitest';
import { buildInbox } from './inbox.js';
import type { RefreshState, GitHubState, FileWatchState } from './types.js';
import type { ProjectConfig } from './config.js';

const PROJECT: ProjectConfig = {
  name: 'test-project',
  prefix: 'TP',
  path: '/tmp/test-project',
  repo: 'owner/test-project',
  rexSession: 'tp-foreman',
};

function makePr(overrides: Partial<GitHubState['prs'][0]> & { headRefName: string }): GitHubState['prs'][0] {
  return {
    number: 1,
    title: 'feat: thing',
    state: 'OPEN',
    isDraft: true,
    url: '',
    labels: [],
    reviewDecision: '',
    checksStatus: 'pass',
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeState(overrides: {
  prs?: GitHubState['prs'];
  issues?: GitHubState['openIssues'];
  signals?: FileWatchState['signals'];
  reviews?: FileWatchState['reviews'];
} = {}): RefreshState {
  const gh: GitHubState = {
    prs: overrides.prs ?? [],
    openIssues: overrides.issues ?? [],
    updatedAt: Date.now(),
  };
  const files: FileWatchState = {
    signals: overrides.signals ?? [],
    notes: [],
    reviews: overrides.reviews ?? [],
  };
  return {
    github: new Map([['owner/test-project', gh]]),
    files: new Map([['/tmp/test-project', files]]),
    rexEvents: [],
    sources: { github: 'ok', fileWatch: 'ok', rex: 'ok' },
  };
}

describe('buildInbox', () => {
  it('produces a Blocked item from a block signal', () => {
    const state = makeState({
      prs: [makePr({ headRefName: 'feat/5-thing', title: 'feat: thing' })],
      signals: [{ type: 'block', issue: 5, message: 'stuck on API', timestamp: Date.now() }],
    });
    const items = buildInbox([PROJECT], state);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      prefix: 'TP',
      issue: 5,
      title: 'feat: thing',
      reason: 'Blocked',
      detail: 'stuck on API',
      repo: 'owner/test-project',
    });
  });

  it('produces a Finished item from a handoff signal', () => {
    const state = makeState({
      prs: [makePr({ headRefName: 'feat/3-done', title: 'feat: done' })],
      signals: [{ type: 'handoff', issue: 3, message: 'PR #42 ready for review', timestamp: Date.now() }],
    });
    const items = buildInbox([PROJECT], state);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      reason: 'Finished',
      detail: 'PR #42 ready for review',
      issue: 3,
    });
  });

  it('produces a Failed CI item when checksStatus is fail', () => {
    const state = makeState({
      prs: [makePr({ headRefName: 'feat/7-broken', checksStatus: 'fail', title: 'feat: broken' })],
    });
    const items = buildInbox([PROJECT], state);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ reason: 'Failed CI', issue: 7 });
  });

  it('produces a Review ready item when review results exist', () => {
    const state = makeState({
      prs: [makePr({ headRefName: 'feat/4-reviewed', title: 'feat: reviewed' })],
      reviews: [{ issue: 4, reviewer: 'code-review', verdict: 'Pass', critical: 0, important: 1, raw: '', updatedAt: Date.now() }],
    });
    const items = buildInbox([PROJECT], state);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ reason: 'Review ready', issue: 4 });
  });

  it('returns empty when no attention items exist', () => {
    const state = makeState({
      prs: [makePr({ headRefName: 'feat/6-wip', checksStatus: 'pass' })],
    });
    const items = buildInbox([PROJECT], state);
    expect(items).toHaveLength(0);
  });

  it('uses latest signal when multiple signals exist for same issue', () => {
    const old = Date.now() - 10_000;
    const recent = Date.now();
    const state = makeState({
      prs: [makePr({ headRefName: 'feat/5-thing' })],
      signals: [
        { type: 'block', issue: 5, message: 'old block', timestamp: old },
        { type: 'handoff', issue: 5, message: 'now done', timestamp: recent },
      ],
    });
    const items = buildInbox([PROJECT], state);
    expect(items.filter(i => i.reason === 'Blocked')).toHaveLength(0);
    expect(items.filter(i => i.reason === 'Finished')).toHaveLength(1);
  });

  it('collects items from multiple projects', () => {
    const project2: ProjectConfig = { name: 'other', prefix: 'OT', path: '/tmp/other', repo: 'owner/other', rexSession: 'ot' };
    const state = makeState({
      prs: [makePr({ headRefName: 'feat/5-thing' })],
      signals: [{ type: 'block', issue: 5, message: 'stuck', timestamp: Date.now() }],
    });
    state.github.set('owner/other', {
      prs: [makePr({ headRefName: 'feat/2-other', checksStatus: 'fail' })],
      openIssues: [],
      updatedAt: Date.now(),
    });
    state.files.set('/tmp/other', { signals: [], notes: [], reviews: [] });
    const items = buildInbox([PROJECT, project2], state);
    expect(items).toHaveLength(2);
    expect(items.map(i => i.prefix).sort()).toEqual(['OT', 'TP']);
  });

  it('can produce both a signal item and a review item for the same issue', () => {
    const state = makeState({
      prs: [makePr({ headRefName: 'feat/5-thing' })],
      signals: [{ type: 'block', issue: 5, message: 'stuck', timestamp: Date.now() }],
      reviews: [{ issue: 5, reviewer: 'code-review', verdict: 'Fail', critical: 2, important: 0, raw: '', updatedAt: Date.now() }],
    });
    const items = buildInbox([PROJECT], state);
    expect(items).toHaveLength(2);
    expect(items.map(i => i.reason).sort()).toEqual(['Blocked', 'Review ready']);
  });
});
