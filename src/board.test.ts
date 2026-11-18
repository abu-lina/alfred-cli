import { describe, it, expect } from 'vitest';
import { classifyCards, type BoardCard } from './board.js';
import type { RefreshState, GitHubState, FileWatchState, ReviewResult } from './types.js';
import type { ProjectConfig } from './config.js';

const PROJECT: ProjectConfig = {
  name: 'test-project',
  prefix: 'TP',
  path: '/tmp/test-project',
  repo: 'owner/test-project',
  rexSession: 'tp-foreman',
};

function makeState(overrides: {
  prs?: GitHubState['prs'];
  issues?: GitHubState['openIssues'];
  signals?: FileWatchState['signals'];
  reviews?: ReviewResult[];
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

describe('classifyCards', () => {
  it('puts a ready-labeled issue with no active lane into todo', () => {
    const state = makeState({
      issues: [{ number: 10, title: 'New feature', labels: ['ready', 'type:feat'], createdAt: Date.now() - 3600_000 }],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.todo).toHaveLength(1);
    expect(cols.todo[0]).toMatchObject({ issue: 10, title: 'New feature', prefix: 'TP' });
  });

  it('puts a lane with a block signal into needsYou', () => {
    const state = makeState({
      prs: [{ number: 1, title: 'feat: thing', state: 'OPEN', isDraft: true, url: '', headRefName: 'feat/5-thing', labels: [], reviewDecision: '', checksStatus: 'pass', createdAt: Date.now() }],
      signals: [{ type: 'block', issue: 5, message: 'stuck', timestamp: Date.now() }],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.needsYou.some(c => c.issue === 5)).toBe(true);
  });

  it('puts a lane with failed CI into needsYou', () => {
    const state = makeState({
      prs: [{ number: 1, title: 'feat: broken', state: 'OPEN', isDraft: false, url: '', headRefName: 'feat/7-broken', labels: [], reviewDecision: '', checksStatus: 'fail', createdAt: Date.now() }],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.needsYou.some(c => c.issue === 7)).toBe(true);
  });

  it('puts a lane with a handoff signal into needsYou', () => {
    const state = makeState({
      prs: [{ number: 1, title: 'feat: done', state: 'OPEN', isDraft: true, url: '', headRefName: 'feat/3-done', labels: [], reviewDecision: '', checksStatus: 'pass', createdAt: Date.now() }],
      signals: [{ type: 'handoff', issue: 3, message: 'ready for checkpoint', timestamp: Date.now() }],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.needsYou.some(c => c.issue === 3)).toBe(true);
  });

  it('puts a lane with a review decision into inReview', () => {
    const state = makeState({
      prs: [{ number: 1, title: 'feat: reviewed', state: 'OPEN', isDraft: true, url: '', headRefName: 'feat/4-reviewed', labels: [], reviewDecision: 'APPROVED', checksStatus: 'pass', createdAt: Date.now() }],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.inReview.some(c => c.issue === 4)).toBe(true);
  });

  it('puts a lane with local review results but no reviewDecision into inReview', () => {
    const state = makeState({
      prs: [{ number: 1, title: 'feat: reviewed locally', state: 'OPEN', isDraft: true, url: '', headRefName: 'feat/4-reviewed', labels: [], reviewDecision: '', checksStatus: 'pass', createdAt: Date.now() }],
      reviews: [{ issue: 4, reviewer: 'code-review', verdict: 'PASS', critical: 0, important: 1, raw: '', updatedAt: Date.now() }],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.inReview.some(c => c.issue === 4)).toBe(true);
  });

  it('does not misclassify a PR without reviews when another PR has reviews', () => {
    const state = makeState({
      prs: [
        { number: 1, title: 'feat: reviewed', state: 'OPEN', isDraft: true, url: '', headRefName: 'feat/4-reviewed', labels: [], reviewDecision: 'APPROVED', checksStatus: 'pass', createdAt: Date.now() },
        { number: 2, title: 'feat: wip', state: 'OPEN', isDraft: true, url: '', headRefName: 'feat/8-wip', labels: [], reviewDecision: '', checksStatus: 'pass', createdAt: Date.now() },
      ],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.inReview.some(c => c.issue === 4)).toBe(true);
    expect(cols.inProgress.some(c => c.issue === 8)).toBe(true);
  });

  it('puts an active lane with no signal and no reviews into inProgress', () => {
    const state = makeState({
      prs: [{ number: 1, title: 'feat: working', state: 'OPEN', isDraft: true, url: '', headRefName: 'feat/6-working', labels: [], reviewDecision: '', checksStatus: 'pending', createdAt: Date.now() }],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.inProgress.some(c => c.issue === 6)).toBe(true);
  });

  it('does not put a ready issue into todo if it has an active PR', () => {
    const state = makeState({
      prs: [{ number: 1, title: 'feat: thing', state: 'OPEN', isDraft: true, url: '', headRefName: 'feat/10-thing', labels: [], reviewDecision: '', checksStatus: 'pass', createdAt: Date.now() }],
      issues: [{ number: 10, title: 'New feature', labels: ['ready'], createdAt: Date.now() - 3600_000 }],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.todo).toHaveLength(0);
  });

  it('uses issue createdAt for todo card since, not poll timestamp', () => {
    const issueCreated = Date.now() - 86_400_000;
    const state = makeState({
      issues: [{ number: 11, title: 'Queued work', labels: ['ready'], createdAt: issueCreated }],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.todo[0]!.since).toBe(issueCreated);
  });

  it('does not let a later progress signal overwrite a block signal', () => {
    const now = Date.now();
    const state = makeState({
      prs: [{ number: 1, title: 'feat: stuck', state: 'OPEN', isDraft: true, url: '', headRefName: 'feat/5-stuck', labels: [], reviewDecision: '', checksStatus: 'pass', createdAt: now }],
      signals: [
        { type: 'block', issue: 5, message: 'need help', timestamp: now - 1000 },
        { type: 'progress', issue: 5, message: 'working', timestamp: now },
      ],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.needsYou.some(c => c.issue === 5)).toBe(true);
    expect(cols.inProgress.some(c => c.issue === 5)).toBe(false);
  });

  it('includes cards from multiple projects', () => {
    const project2: ProjectConfig = { name: 'other', prefix: 'OT', path: '/tmp/other', repo: 'owner/other', rexSession: 'ot' };
    const gh2: GitHubState = {
      prs: [],
      openIssues: [{ number: 1, title: 'Other todo', labels: ['ready'], createdAt: Date.now() - 3600_000 }],
      updatedAt: Date.now(),
    };
    const state = makeState({
      issues: [{ number: 10, title: 'TP todo', labels: ['ready'], createdAt: Date.now() - 3600_000 }],
    });
    state.github.set('owner/other', gh2);
    state.files.set('/tmp/other', { signals: [], notes: [], reviews: [] });

    const cols = classifyCards([PROJECT, project2], state);
    expect(cols.todo).toHaveLength(2);
    expect(cols.todo.map(c => c.prefix).sort()).toEqual(['OT', 'TP']);
  });
});
