import { describe, it, expect } from 'vitest';
import { classifyCards, type BoardCard } from './board.js';
import type { RefreshState, GitHubState, FileWatchState } from './types.js';
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

describe('classifyCards', () => {
  it('puts a ready-labeled issue with no active lane into todo', () => {
    const state = makeState({
      issues: [{ number: 10, title: 'New feature', labels: ['ready', 'type:feat'] }],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.todo).toHaveLength(1);
    expect(cols.todo[0]).toMatchObject({ issue: 10, title: 'New feature', prefix: 'TP' });
  });

  it('puts a lane with a block signal into needsYou', () => {
    const state = makeState({
      prs: [{ number: 1, title: 'feat: thing', state: 'OPEN', isDraft: true, url: '', headRefName: 'feat/5-thing', labels: [], reviewDecision: '', checksStatus: 'pass' }],
      signals: [{ type: 'block', issue: 5, message: 'stuck', timestamp: Date.now() }],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.needsYou.some(c => c.issue === 5)).toBe(true);
  });

  it('puts a lane with failed CI into needsYou', () => {
    const state = makeState({
      prs: [{ number: 1, title: 'feat: broken', state: 'OPEN', isDraft: false, url: '', headRefName: 'feat/7-broken', labels: [], reviewDecision: '', checksStatus: 'fail' }],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.needsYou.some(c => c.issue === 7)).toBe(true);
  });

  it('puts a lane with a handoff signal into needsYou', () => {
    const state = makeState({
      prs: [{ number: 1, title: 'feat: done', state: 'OPEN', isDraft: true, url: '', headRefName: 'feat/3-done', labels: [], reviewDecision: '', checksStatus: 'pass' }],
      signals: [{ type: 'handoff', issue: 3, message: 'ready for checkpoint', timestamp: Date.now() }],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.needsYou.some(c => c.issue === 3)).toBe(true);
  });

  it('puts a lane with review results into inReview', () => {
    const state = makeState({
      prs: [{ number: 1, title: 'feat: reviewed', state: 'OPEN', isDraft: true, url: '', headRefName: 'feat/4-reviewed', labels: [], reviewDecision: '', checksStatus: 'pass' }],
      reviews: [{ reviewer: 'code-reviewer', verdict: 'Pass', critical: 0, important: 1, raw: '', updatedAt: Date.now() }],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.inReview.some(c => c.issue === 4)).toBe(true);
  });

  it('puts an active lane with no signal and no reviews into inProgress', () => {
    const state = makeState({
      prs: [{ number: 1, title: 'feat: working', state: 'OPEN', isDraft: true, url: '', headRefName: 'feat/6-working', labels: [], reviewDecision: '', checksStatus: 'pending' }],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.inProgress.some(c => c.issue === 6)).toBe(true);
  });

  it('does not put a ready issue into todo if it has an active PR', () => {
    const state = makeState({
      prs: [{ number: 1, title: 'feat: thing', state: 'OPEN', isDraft: true, url: '', headRefName: 'feat/10-thing', labels: [], reviewDecision: '', checksStatus: 'pass' }],
      issues: [{ number: 10, title: 'New feature', labels: ['ready'] }],
    });
    const cols = classifyCards([PROJECT], state);
    expect(cols.todo).toHaveLength(0);
  });

  it('includes cards from multiple projects', () => {
    const project2: ProjectConfig = { name: 'other', prefix: 'OT', path: '/tmp/other', repo: 'owner/other', rexSession: 'ot' };
    const gh2: GitHubState = {
      prs: [],
      openIssues: [{ number: 1, title: 'Other todo', labels: ['ready'] }],
      updatedAt: Date.now(),
    };
    const state = makeState({
      issues: [{ number: 10, title: 'TP todo', labels: ['ready'] }],
    });
    state.github.set('owner/other', gh2);
    state.files.set('/tmp/other', { signals: [], notes: [], reviews: [] });

    const cols = classifyCards([PROJECT, project2], state);
    expect(cols.todo).toHaveLength(2);
    expect(cols.todo.map(c => c.prefix).sort()).toEqual(['OT', 'TP']);
  });
});
