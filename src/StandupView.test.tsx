import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { StandupView } from './StandupView.js';
import { wait } from './testUtils.js';
import type { ProjectConfig } from './config.js';
import type { RefreshState } from './types.js';
import type { StandupData } from './standup.js';

const PROJECT: ProjectConfig = {
  name: 'test-project',
  prefix: 'TP',
  path: '/tmp/test-project',
  repo: 'owner/test-project',
  rexSession: 'tp-foreman',
};

const EMPTY_STATE: RefreshState = {
  github: new Map(),
  files: new Map(),
  rexEvents: [],
  sources: { github: 'ok', fileWatch: 'ok', rex: 'ok' },
};

const mockBuildStandup = vi.fn<() => Promise<StandupData>>();

vi.mock('./standup.js', () => ({
  buildStandup: (...args: unknown[]) => mockBuildStandup(...(args as [])),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StandupView', () => {
  it('shows loading state initially', () => {
    mockBuildStandup.mockReturnValue(new Promise(() => {})); // never resolves
    const inst = render(<StandupView projects={[PROJECT]} state={EMPTY_STATE} />);
    expect(inst.lastFrame()).toContain('Loading standup data');
    inst.unmount();
  });

  it('shows empty state when no activity', async () => {
    mockBuildStandup.mockResolvedValue({
      blockers: [],
      sections: [],
      asOf: Date.now(),
    });
    const inst = render(<StandupView projects={[PROJECT]} state={EMPTY_STATE} />);
    await wait(100);
    expect(inst.lastFrame()).toContain('No activity since yesterday');
    inst.unmount();
  });

  it('renders blockers section', async () => {
    mockBuildStandup.mockResolvedValue({
      blockers: [{
        prefix: 'TP',
        issue: 5,
        title: 'feat: thing',
        repo: 'owner/test-project',
        reason: 'Blocked',
        detail: 'stuck on API',
        since: Date.now(),
      }],
      sections: [],
      asOf: Date.now(),
    });
    const inst = render(<StandupView projects={[PROJECT]} state={EMPTY_STATE} />);
    await wait(100);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('Blockers');
    expect(frame).toContain('stuck on API');
    inst.unmount();
  });

  it('renders project sections with merged PRs', async () => {
    mockBuildStandup.mockResolvedValue({
      blockers: [],
      sections: [{
        prefix: 'TP',
        name: 'test-project',
        repo: 'owner/test-project',
        mergedPRs: [{ number: 10, title: 'feat: login', mergedAt: '2026-11-19T10:00:00Z' }],
        closedIssues: [],
        commits: [],
      }],
      asOf: Date.now(),
    });
    const inst = render(<StandupView projects={[PROJECT]} state={EMPTY_STATE} />);
    await wait(100);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('TP');
    expect(frame).toContain('test-project');
    expect(frame).toContain('Merged PRs');
    expect(frame).toContain('#10');
    expect(frame).toContain('feat: login');
    inst.unmount();
  });

  it('renders closed issues and commits', async () => {
    mockBuildStandup.mockResolvedValue({
      blockers: [],
      sections: [{
        prefix: 'TP',
        name: 'test-project',
        repo: 'owner/test-project',
        mergedPRs: [],
        closedIssues: [{ number: 3, title: 'fix: crash', closedAt: '2026-11-19T08:00:00Z' }],
        commits: [{ sha: 'abc1234def', message: 'feat: add login', date: '2026-11-19T10:00:00+00:00' }],
      }],
      asOf: Date.now(),
    });
    const inst = render(<StandupView projects={[PROJECT]} state={EMPTY_STATE} />);
    await wait(100);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('Closed issues');
    expect(frame).toContain('#3');
    expect(frame).toContain('fix: crash');
    expect(frame).toContain('Commits');
    expect(frame).toContain('abc1234');
    expect(frame).toContain('feat: add login');
    inst.unmount();
  });
});
