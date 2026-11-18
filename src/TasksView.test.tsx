import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { TasksView } from './TasksView.js';
import type { LaneNotes } from './types.js';

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

describe('TasksView', () => {
  it('shows "Lane notes not yet written" when notes is undefined', () => {
    const inst = render(<TasksView repo="owner/repo" issue={8} notes={undefined} />);
    expect(inst.lastFrame()).toContain('Lane notes not yet written');
    inst.unmount();
  });

  it('shows the goal', () => {
    const inst = render(<TasksView repo="owner/repo" issue={8} notes={notes(FULL_NOTES)} />);
    expect(inst.lastFrame()).toContain('Display lane notes in the Tasks view.');
    inst.unmount();
  });

  it('shows completed plan items with a checkmark', () => {
    const inst = render(<TasksView repo="owner/repo" issue={8} notes={notes(FULL_NOTES)} />);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('✓');
    expect(frame).toContain('Read issue');
    inst.unmount();
  });

  it('shows incomplete plan items with an empty box', () => {
    const inst = render(<TasksView repo="owner/repo" issue={8} notes={notes(FULL_NOTES)} />);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('○');
    expect(frame).toContain('Write tests');
    inst.unmount();
  });

  it('shows blockers', () => {
    const inst = render(<TasksView repo="owner/repo" issue={8} notes={notes(FULL_NOTES)} />);
    expect(inst.lastFrame()).toContain('Needs #5.');
    inst.unmount();
  });

  it('shows changed files', () => {
    const inst = render(<TasksView repo="owner/repo" issue={8} notes={notes(FULL_NOTES)} />);
    expect(inst.lastFrame()).toContain('src/TasksView.tsx');
    inst.unmount();
  });

  it('shows repo and issue in header', () => {
    const inst = render(<TasksView repo="owner/repo" issue={8} notes={undefined} />);
    expect(inst.lastFrame()).toContain('owner/repo');
    expect(inst.lastFrame()).toContain('#8');
    inst.unmount();
  });
});
