import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { HeaderBar } from './HeaderBar.js';

const DELAY = 50;
const wait = (ms = DELAY) => new Promise(r => setTimeout(r, ms));

describe('HeaderBar', () => {
  it('shows "Board" title for board view', () => {
    const inst = render(<HeaderBar view={{ type: 'board' }} canGoBack={false} onBack={() => {}} />);
    expect(inst.lastFrame()!).toContain('Board');
    inst.unmount();
  });

  it('shows task detail title for tasks view', () => {
    const inst = render(<HeaderBar view={{ type: 'tasks', repo: 'owner/repo', issue: 7 }} canGoBack={false} onBack={() => {}} />);
    expect(inst.lastFrame()!).toContain('owner/repo#7');
    inst.unmount();
  });

  it('shows Back hint when canGoBack is true', () => {
    const inst = render(<HeaderBar view={{ type: 'tasks', repo: 'owner/repo', issue: 7 }} canGoBack={true} onBack={() => {}} />);
    expect(inst.lastFrame()!).toContain('Back');
    inst.unmount();
  });

  it('hides Back hint when canGoBack is false', () => {
    const inst = render(<HeaderBar view={{ type: 'board' }} canGoBack={false} onBack={() => {}} />);
    expect(inst.lastFrame()!).not.toContain('Back');
    inst.unmount();
  });

  it('calls onBack when Escape is pressed', async () => {
    let called = false;
    const inst = render(<HeaderBar view={{ type: 'tasks', repo: 'owner/repo', issue: 7 }} canGoBack={true} onBack={() => { called = true; }} />);
    await wait();
    inst.stdin.write('\x1B');
    await wait();
    expect(called).toBe(true);
    inst.unmount();
  });
});
