import { describe, it, expect } from 'vitest';
import { renderHook, act } from './testUtils.js';
import { useNavigation } from './useNavigation.js';

describe('useNavigation', () => {
  it('starts on inbox view', () => {
    const { result } = renderHook(() => useNavigation());
    expect(result.current.view).toEqual({ type: 'inbox' });
  });

  it('can navigate to tasks view for a lane', () => {
    const { result } = renderHook(() => useNavigation());
    act(() => result.current.push({ type: 'tasks', repo: 'owner/repo', issue: 7 }));
    expect(result.current.view).toEqual({ type: 'tasks', repo: 'owner/repo', issue: 7 });
  });

  it('goes back to previous view', () => {
    const { result } = renderHook(() => useNavigation());
    act(() => result.current.push({ type: 'tasks', repo: 'owner/repo', issue: 7 }));
    act(() => result.current.back());
    expect(result.current.view).toEqual({ type: 'inbox' });
  });

  it('back on root view is a no-op', () => {
    const { result } = renderHook(() => useNavigation());
    act(() => result.current.back());
    expect(result.current.view).toEqual({ type: 'inbox' });
  });

  it('canGoBack is false on root', () => {
    const { result } = renderHook(() => useNavigation());
    expect(result.current.canGoBack).toBe(false);
  });

  it('canGoBack is true after push', () => {
    const { result } = renderHook(() => useNavigation());
    act(() => result.current.push({ type: 'tasks', repo: 'owner/repo', issue: 7 }));
    expect(result.current.canGoBack).toBe(true);
  });

  it('navigateTo switches to a named view at root level', () => {
    const { result } = renderHook(() => useNavigation());
    act(() => result.current.navigateTo({ type: 'board' }));
    expect(result.current.view).toEqual({ type: 'board' });
    expect(result.current.canGoBack).toBe(false);
  });

  it('navigateTo switches to standup view', () => {
    const { result } = renderHook(() => useNavigation());
    act(() => result.current.navigateTo({ type: 'standup' }));
    expect(result.current.view).toEqual({ type: 'standup' });
    expect(result.current.canGoBack).toBe(false);
  });
});
