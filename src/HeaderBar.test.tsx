import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { HeaderBar } from './HeaderBar.js';
import { wait } from './testUtils.js';

const noop = () => {};

describe('HeaderBar', () => {
  it('shows "Board" title for board view', () => {
    const inst = render(<HeaderBar view={{ type: 'board' }} canGoBack={false} onBack={noop} onNavigateTo={noop} projectCount={2} />);
    expect(inst.lastFrame()!).toContain('Board');
    inst.unmount();
  });

  it('shows task detail title for tasks view', () => {
    const inst = render(<HeaderBar view={{ type: 'tasks', repo: 'owner/repo', issue: 7 }} canGoBack={false} onBack={noop} onNavigateTo={noop} projectCount={2} />);
    expect(inst.lastFrame()!).toContain('owner/repo#7');
    inst.unmount();
  });

  it('shows Back hint when canGoBack is true', () => {
    const inst = render(<HeaderBar view={{ type: 'tasks', repo: 'owner/repo', issue: 7 }} canGoBack={true} onBack={noop} onNavigateTo={noop} projectCount={2} />);
    expect(inst.lastFrame()!).toContain('Back');
    inst.unmount();
  });

  it('hides Back hint when canGoBack is false', () => {
    const inst = render(<HeaderBar view={{ type: 'board' }} canGoBack={false} onBack={noop} onNavigateTo={noop} projectCount={2} />);
    expect(inst.lastFrame()!).not.toContain('Back');
    inst.unmount();
  });

  it('calls onBack when Escape is pressed', async () => {
    let called = false;
    const inst = render(<HeaderBar view={{ type: 'tasks', repo: 'owner/repo', issue: 7 }} canGoBack={true} onBack={() => { called = true; }} onNavigateTo={noop} projectCount={2} />);
    await wait();
    inst.stdin.write('\x1B');
    await wait();
    expect(called).toBe(true);
    inst.unmount();
  });
  it('shows project count', () => {
    const inst = render(<HeaderBar view={{ type: 'board' }} canGoBack={false} onBack={noop} onNavigateTo={noop} projectCount={3} />);
    expect(inst.lastFrame()!).toContain('(3 projects)');
    inst.unmount();
  });
});

describe('HeaderBar keyboard shortcuts', () => {
  it('pressing 1 navigates to inbox', async () => {
    let route: unknown = null;
    const inst = render(<HeaderBar view={{ type: 'board' }} canGoBack={false} onBack={noop} onNavigateTo={(r) => { route = r; }} projectCount={1} />);
    await wait();
    inst.stdin.write('1');
    await wait();
    expect(route).toEqual({ type: 'inbox' });
    inst.unmount();
  });

  it('pressing 2 navigates to board', async () => {
    let route: unknown = null;
    const inst = render(<HeaderBar view={{ type: 'inbox' }} canGoBack={false} onBack={noop} onNavigateTo={(r) => { route = r; }} projectCount={1} />);
    await wait();
    inst.stdin.write('2');
    await wait();
    expect(route).toEqual({ type: 'board' });
    inst.unmount();
  });

  it('pressing 3 navigates to standup', async () => {
    let route: unknown = null;
    const inst = render(<HeaderBar view={{ type: 'board' }} canGoBack={false} onBack={noop} onNavigateTo={(r) => { route = r; }} projectCount={1} />);
    await wait();
    inst.stdin.write('3');
    await wait();
    expect(route).toEqual({ type: 'standup' });
    inst.unmount();
  });
});
