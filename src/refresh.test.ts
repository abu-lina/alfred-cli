import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRefreshManager } from './refresh.js';
import type { Config, ProjectConfig } from './config.js';
import type { LaneSignal } from './types.js';
import * as ghPoller from './ghPoller.js';
import * as fileWatcher from './fileWatcher.js';
import * as rexEvents from './rexEvents.js';

vi.mock('./ghPoller.js');
vi.mock('./fileWatcher.js');
vi.mock('./rexEvents.js');

const project: ProjectConfig = {
  name: 'test',
  prefix: 'TE',
  path: '/tmp/test',
  repo: 'owner/repo',
  rexSession: 'test-foreman',
};

const config: Config = {
  projects: [project],
  github: { pollIntervalSeconds: 60 },
};

describe('createRefreshManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(ghPoller.pollGitHub).mockReturnValue({
      prs: [],
      openIssues: [],
      updatedAt: 1000,
    });
    vi.mocked(fileWatcher.watchProject).mockReturnValue(() => {});
    vi.mocked(rexEvents.createRexStream).mockReturnValue(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts all three data sources and returns initial state', () => {
    const onChange = vi.fn();
    const mgr = createRefreshManager(config, onChange);

    expect(vi.mocked(ghPoller.pollGitHub)).toHaveBeenCalledWith(project);
    expect(vi.mocked(fileWatcher.watchProject)).toHaveBeenCalledWith(
      project.path,
      expect.any(Object),
    );
    expect(vi.mocked(rexEvents.createRexStream)).toHaveBeenCalledWith(expect.any(Object));

    const state = mgr.getState();
    expect(state.sources.github).toBe('ok');
    expect(state.sources.fileWatch).toBe('ok');
    expect(state.sources.rex).toBe('ok');
    expect(state.github.get('owner/repo')).toBeDefined();

    mgr.stop();
  });

  it('polls GitHub on the configured interval', () => {
    const onChange = vi.fn();
    const mgr = createRefreshManager(config, onChange);

    expect(vi.mocked(ghPoller.pollGitHub)).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    expect(vi.mocked(ghPoller.pollGitHub)).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(60_000);
    expect(vi.mocked(ghPoller.pollGitHub)).toHaveBeenCalledTimes(3);

    mgr.stop();
  });

  it('calls onChange when GitHub data refreshes', () => {
    const onChange = vi.fn();
    const mgr = createRefreshManager(config, onChange);

    expect(onChange).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    expect(onChange).toHaveBeenCalledTimes(2);

    mgr.stop();
  });

  it('marks github source as error when pollGitHub throws', () => {
    vi.mocked(ghPoller.pollGitHub).mockImplementation(() => {
      throw new Error('gh auth expired');
    });

    const onChange = vi.fn();
    const mgr = createRefreshManager(config, onChange);

    expect(mgr.getState().sources.github).toBe('error');
    expect(onChange).toHaveBeenCalled();

    mgr.stop();
  });

  it('marks rex source as error when rexEvents calls onError', () => {
    let errorCb: ((err: Error) => void) | undefined;
    vi.mocked(rexEvents.createRexStream).mockImplementation((cbs) => {
      errorCb = cbs.onError;
      return () => {};
    });

    const onChange = vi.fn();
    const mgr = createRefreshManager(config, onChange);

    expect(mgr.getState().sources.rex).toBe('ok');

    errorCb!(new Error('spawn failed'));
    expect(mgr.getState().sources.rex).toBe('error');

    mgr.stop();
  });

  it('updates file watch state when onSignal fires', () => {
    let signalCb: ((s: LaneSignal) => void) | undefined;
    vi.mocked(fileWatcher.watchProject).mockImplementation((_path, cbs) => {
      signalCb = cbs.onSignal;
      return () => {};
    });

    const onChange = vi.fn();
    const mgr = createRefreshManager(config, onChange);

    signalCb!({ type: 'block', issue: 5, message: 'stuck', timestamp: 1000 });

    const fileState = mgr.getState().files.get('/tmp/test');
    expect(fileState!.signals).toHaveLength(1);
    expect(fileState!.signals[0]!.type).toBe('block');

    mgr.stop();
  });

  it('marks github ok when at least one project succeeds (multi-project)', () => {
    const secondProject: ProjectConfig = {
      name: 'other', prefix: 'OT', path: '/tmp/other', repo: 'owner/other', rexSession: 'other-foreman',
    };
    const multiConfig: Config = { projects: [project, secondProject], github: { pollIntervalSeconds: 60 } };

    let callCount = 0;
    vi.mocked(ghPoller.pollGitHub).mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error('fail');
      return { prs: [], openIssues: [], updatedAt: 1000 };
    });

    const onChange = vi.fn();
    const mgr = createRefreshManager(multiConfig, onChange);

    expect(mgr.getState().sources.github).toBe('ok');
    mgr.stop();
  });

  it('caps rexEvents array to prevent unbounded growth', () => {
    let eventCb: ((event: import('./types.js').RexEvent) => void) | undefined;
    vi.mocked(rexEvents.createRexStream).mockImplementation((cbs) => {
      eventCb = cbs.onEvent;
      return () => {};
    });

    const onChange = vi.fn();
    const mgr = createRefreshManager(config, onChange);

    for (let i = 0; i < 600; i++) {
      eventCb!({ type: 'test', timestamp: i });
    }

    expect(mgr.getState().rexEvents.length).toBeLessThanOrEqual(500);
    mgr.stop();
  });

  it('stop cleans up all watchers and timers', () => {
    const fileCleanup = vi.fn();
    const rexCleanup = vi.fn();
    vi.mocked(fileWatcher.watchProject).mockReturnValue(fileCleanup);
    vi.mocked(rexEvents.createRexStream).mockReturnValue(rexCleanup);

    const onChange = vi.fn();
    const mgr = createRefreshManager(config, onChange);
    mgr.stop();

    expect(fileCleanup).toHaveBeenCalled();
    expect(rexCleanup).toHaveBeenCalled();

    vi.mocked(ghPoller.pollGitHub).mockClear();
    vi.advanceTimersByTime(120_000);
    expect(vi.mocked(ghPoller.pollGitHub)).not.toHaveBeenCalled();
  });
});
