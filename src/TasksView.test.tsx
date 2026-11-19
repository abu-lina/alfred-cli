import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { TasksView } from './TasksView.js';
import { wait } from './testUtils.js';
import type { ReviewResult, LaneNotes } from './types.js';

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

function notes(raw: string): LaneNotes {
  return { issue: 8, raw, updatedAt: Date.now() };
}

const FULL_NOTES = [
  '# Lane Notes — #8 Lane notes',
  '',
  '## Goal',
  'Display lane notes in the Tasks view.',
  '',
  '## Plan',
  '- [x] Read issue',
  '- [ ] Write tests',
  '',
  '## Decisions',
  'Parse from headings.',
  '',
  '## Blockers',
  'Needs #5.',
  '',
  '## Changed Files',
  '- src/TasksView.tsx',
].join('\n');

describe('TasksView — reviews', () => {
  it('shows "No reviews yet" when reviews array is empty', () => {
    const inst = render(<TasksView repo="owner/repo" issue={7} reviews={[]} notes={undefined} />);
    expect(inst.lastFrame()).toContain('No reviews yet');
    inst.unmount();
  });

  it('renders "Reviews" section header when reviews exist', () => {
    const inst = render(
      <TasksView repo="owner/repo" issue={7} reviews={[review({ reviewer: 'code-reviewer' })]} notes={undefined} />,
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
        notes={undefined}
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
        notes={undefined}
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
        notes={undefined}
      />,
    );
    await wait();
    inst.stdin.write('\r');
    await wait();
    expect(inst.lastFrame()).toContain('All good here.');
    inst.unmount();
  });

  it('strips ANSI escape sequences from review content when expanded', async () => {
    const raw = '**Verdict:** Pass\n\x1b[31mmalicious\x1b[0m injection\x00here';
    const inst = render(
      <TasksView
        repo="owner/repo"
        issue={7}
        reviews={[review({ reviewer: 'code-reviewer', raw })]}
        notes={undefined}
      />,
    );
    await wait();
    inst.stdin.write('\r');
    await wait();
    const frame = inst.lastFrame()!;
    expect(frame).toContain('malicious');
    expect(frame).toContain('injection');
    expect(frame).not.toContain('\x1b[31m');
    expect(frame).not.toContain('\x00');
    inst.unmount();
  });

  it('collapses an expanded review on enter again', async () => {
    const raw = '**Verdict:** Pass\n**Critical:** 0\n**Important:** 0\n\n## Findings\nAll good here.';
    const inst = render(
      <TasksView
        repo="owner/repo"
        issue={7}
        reviews={[review({ reviewer: 'code-reviewer', raw })]}
        notes={undefined}
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

  it('clamps focusIndex when reviews array shrinks', async () => {
    const twoReviews = [
      review({ reviewer: 'code-reviewer' }),
      review({ reviewer: 'security-auditor' }),
    ];
    const inst = render(
      <TasksView repo="owner/repo" issue={7} reviews={twoReviews} notes={undefined} />,
    );
    await wait();
    inst.stdin.write('\t'); // move focus to index 1
    await wait();

    // shrink to one review — focusIndex was 1, should clamp to 0
    inst.rerender(
      <TasksView repo="owner/repo" issue={7} reviews={[review({ reviewer: 'code-reviewer' })]} notes={undefined} />,
    );
    await wait();

    // enter should select the clamped row without crashing
    inst.stdin.write('\r');
    await wait();
    expect(inst.lastFrame()).toContain('code-reviewer');
    inst.unmount();
  });

  it('shows "Fail" verdict in context (renders without crash)', () => {
    const inst = render(
      <TasksView
        repo="owner/repo"
        issue={7}
        reviews={[review({ reviewer: 'security-auditor', verdict: 'Fail', critical: 2, important: 1 })]}
        notes={undefined}
      />,
    );
    const frame = inst.lastFrame()!;
    expect(frame).toContain('Fail');
    expect(frame).toContain('C:2');
    inst.unmount();
  });
});

describe('TasksView — lane notes', () => {
  it('shows "Lane notes not yet written" when notes is undefined', () => {
    const inst = render(<TasksView repo="owner/repo" issue={8} reviews={[]} notes={undefined} />);
    expect(inst.lastFrame()).toContain('Lane notes not yet written');
    inst.unmount();
  });

  it('shows the goal', () => {
    const inst = render(<TasksView repo="owner/repo" issue={8} reviews={[]} notes={notes(FULL_NOTES)} />);
    expect(inst.lastFrame()).toContain('Display lane notes in the Tasks view.');
    inst.unmount();
  });

  it('shows completed plan items with a checkmark', () => {
    const inst = render(<TasksView repo="owner/repo" issue={8} reviews={[]} notes={notes(FULL_NOTES)} />);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('✓');
    expect(frame).toContain('Read issue');
    inst.unmount();
  });

  it('shows incomplete plan items with an empty box', () => {
    const inst = render(<TasksView repo="owner/repo" issue={8} reviews={[]} notes={notes(FULL_NOTES)} />);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('○');
    expect(frame).toContain('Write tests');
    inst.unmount();
  });

  it('shows blockers', () => {
    const inst = render(<TasksView repo="owner/repo" issue={8} reviews={[]} notes={notes(FULL_NOTES)} />);
    expect(inst.lastFrame()).toContain('Needs #5.');
    inst.unmount();
  });

  it('shows changed files', () => {
    const inst = render(<TasksView repo="owner/repo" issue={8} reviews={[]} notes={notes(FULL_NOTES)} />);
    expect(inst.lastFrame()).toContain('src/TasksView.tsx');
    inst.unmount();
  });

  it('strips ANSI escape sequences from notes content', () => {
    const raw = '## Goal\n\x1b[31mmalicious\x1b[0m goal\x00here';
    const inst = render(<TasksView repo="owner/repo" issue={8} reviews={[]} notes={notes(raw)} />);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('malicious');
    expect(frame).toContain('goal');
    expect(frame).not.toContain('\x1b[31m');
    expect(frame).not.toContain('\x00');
    inst.unmount();
  });

  it('shows repo and issue in header', () => {
    const inst = render(<TasksView repo="owner/repo" issue={8} reviews={[]} notes={undefined} />);
    expect(inst.lastFrame()).toContain('owner/repo');
    expect(inst.lastFrame()).toContain('#8');
    inst.unmount();
  });

  it('strips ANSI escape sequences from notes content', () => {
    const raw = '## Goal\n\x1b[31mmalicious\x1b[0m goal\x00here\n\n## Plan\n- [ ] a task';
    const inst = render(<TasksView repo="owner/repo" issue={8} reviews={[]} notes={notes(raw)} />);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('malicious');
    expect(frame).toContain('goal');
    expect(frame).not.toContain('\x1b[31m');
    expect(frame).not.toContain('\x00');
    inst.unmount();
  });
});
