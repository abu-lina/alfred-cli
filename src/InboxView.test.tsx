import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { InboxView } from './InboxView.js';
import { wait } from './testUtils.js';
import type { InboxItem } from './inbox.js';

function item(overrides: Partial<InboxItem> & { issue: number }): InboxItem {
  return {
    prefix: 'TP',
    title: `Issue ${overrides.issue}`,
    repo: 'owner/test',
    reason: 'Blocked',
    detail: 'stuck',
    since: Date.now() - 60_000,
    ...overrides,
  };
}

describe('InboxView', () => {
  it('renders items with prefix, issue number, reason, and title', () => {
    const items = [item({ issue: 5, reason: 'Blocked', detail: 'stuck on API' })];
    const inst = render(<InboxView items={items} onSelect={() => {}} />);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('TP');
    expect(frame).toContain('#5');
    expect(frame).toContain('Blocked');
    expect(frame).toContain('Issue 5');
    inst.unmount();
  });

  it('shows empty state when no items', () => {
    const inst = render(<InboxView items={[]} onSelect={() => {}} />);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('Nothing needs your attention');
    inst.unmount();
  });

  it('shows focus indicator on first item', () => {
    const items = [item({ issue: 1 })];
    const inst = render(<InboxView items={items} onSelect={() => {}} />);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('▸');
    inst.unmount();
  });

  it('calls onSelect when enter is pressed', async () => {
    const selected: InboxItem[] = [];
    const items = [item({ issue: 1 }), item({ issue: 2 })];
    const inst = render(<InboxView items={items} onSelect={(i) => selected.push(i)} />);
    await wait();
    inst.stdin.write('\r');
    await wait();
    expect(selected).toHaveLength(1);
    expect(selected[0]!.issue).toBe(1);
    inst.unmount();
  });

  it('navigates between items with arrow keys', async () => {
    const selected: InboxItem[] = [];
    const items = [item({ issue: 1 }), item({ issue: 2 })];
    const inst = render(<InboxView items={items} onSelect={(i) => selected.push(i)} />);
    await wait();
    inst.stdin.write('\x1B[B'); // down arrow
    await wait();
    inst.stdin.write('\r');
    await wait();
    expect(selected).toHaveLength(1);
    expect(selected[0]!.issue).toBe(2);
    inst.unmount();
  });

  it('shows the detail/reason text', () => {
    const items = [item({ issue: 5, reason: 'Failed CI' })];
    const inst = render(<InboxView items={items} onSelect={() => {}} />);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('Failed CI');
    inst.unmount();
  });
});
