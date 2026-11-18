import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { TasksView } from './TasksView.js';
import { wait } from './testUtils.js';
import type { ReviewResult } from './types.js';

function review(overrides: Partial<ReviewResult> & { reviewer: string }): ReviewResult {
  return {
    issue: 7,
    verdict: 'Pass',
    critical: 0,
    important: 0,
    raw: `**Verdict:** Pass\n**Critical:** 0\n**Important:** 0\n`,
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('TasksView', () => {
  it('shows "No reviews yet" when reviews array is empty', () => {
    const inst = render(<TasksView repo="owner/repo" issue={7} reviews={[]} />);
    expect(inst.lastFrame()).toContain('No reviews yet');
    inst.unmount();
  });

  it('renders "Reviews" section header when reviews exist', () => {
    const inst = render(
      <TasksView repo="owner/repo" issue={7} reviews={[review({ reviewer: 'code-reviewer' })]} />,
    );
    expect(inst.lastFrame()).toContain('Reviews');
    inst.unmount();
  });

  it('renders reviewer name, verdict, critical and important counts', () => {
    const inst = render(
      <TasksView
        repo="owner/repo"
        issue={7}
        reviews={[review({ reviewer: 'code-reviewer', verdict: 'Pass with notes', critical: 0, important: 2 })]}
      />,
    );
    const frame = inst.lastFrame()!;
    expect(frame).toContain('code-reviewer');
    expect(frame).toContain('Pass with notes');
    expect(frame).toContain('C:0');
    expect(frame).toContain('I:2');
    inst.unmount();
  });

  it('renders multiple reviewers', () => {
    const inst = render(
      <TasksView
        repo="owner/repo"
        issue={7}
        reviews={[
          review({ reviewer: 'code-reviewer' }),
          review({ reviewer: 'security-auditor', verdict: 'Fail', critical: 1, important: 0 }),
        ]}
      />,
    );
    const frame = inst.lastFrame()!;
    expect(frame).toContain('code-reviewer');
    expect(frame).toContain('security-auditor');
    inst.unmount();
  });

  it('expands a review to show full findings on enter', async () => {
    const raw = '**Verdict:** Pass\n**Critical:** 0\n**Important:** 0\n\n## Findings\nAll good here.';
    const inst = render(
      <TasksView
        repo="owner/repo"
        issue={7}
        reviews={[review({ reviewer: 'code-reviewer', raw })]}
      />,
    );
    await wait();
    inst.stdin.write('\r');
    await wait();
    expect(inst.lastFrame()).toContain('All good here.');
    inst.unmount();
  });

  it('collapses an expanded review on enter again', async () => {
    const raw = '**Verdict:** Pass\n**Critical:** 0\n**Important:** 0\n\n## Findings\nAll good here.';
    const inst = render(
      <TasksView
        repo="owner/repo"
        issue={7}
        reviews={[review({ reviewer: 'code-reviewer', raw })]}
      />,
    );
    await wait();
    inst.stdin.write('\r'); // expand
    await wait();
    inst.stdin.write('\r'); // collapse
    await wait();
    expect(inst.lastFrame()).not.toContain('All good here.');
    inst.unmount();
  });

  it('shows "Fail" verdict in context (renders without crash)', () => {
    const inst = render(
      <TasksView
        repo="owner/repo"
        issue={7}
        reviews={[review({ reviewer: 'security-auditor', verdict: 'Fail', critical: 2, important: 1 })]}
      />,
    );
    const frame = inst.lastFrame()!;
    expect(frame).toContain('Fail');
    expect(frame).toContain('C:2');
    inst.unmount();
  });
});
