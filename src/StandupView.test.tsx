import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { StandupView } from './StandupView.js';
import type { StandupData } from './standup.js';

describe('StandupView', () => {
  it('shows loading state when data is null', () => {
    const inst = render(<StandupView data={null} />);
    expect(inst.lastFrame()).toContain('Loading standup data');
    inst.unmount();
  });

  it('shows empty state when no activity', () => {
    const data: StandupData = { blockers: [], sections: [], asOf: Date.now() };
    const inst = render(<StandupView data={data} />);
    expect(inst.lastFrame()).toContain('No activity since yesterday');
    inst.unmount();
  });

  it('renders blockers section', () => {
    const data: StandupData = {
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
    };
    const inst = render(<StandupView data={data} />);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('Blockers');
    expect(frame).toContain('stuck on API');
    inst.unmount();
  });

  it('renders project sections with merged PRs', () => {
    const data: StandupData = {
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
    };
    const inst = render(<StandupView data={data} />);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('TP');
    expect(frame).toContain('test-project');
    expect(frame).toContain('Merged PRs');
    expect(frame).toContain('#10');
    expect(frame).toContain('feat: login');
    inst.unmount();
  });

  it('renders closed issues and commits', () => {
    const data: StandupData = {
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
    };
    const inst = render(<StandupView data={data} />);
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
