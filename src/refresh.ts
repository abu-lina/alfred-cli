import type { Config } from './config.js';
import type { RefreshState, RexEvent, LaneSignal, LaneNotes, ReviewResult, FileWatchState } from './types.js';
import { emptyRefreshState } from './types.js';
import { pollGitHub } from './ghPoller.js';
import { watchProject } from './fileWatcher.js';
import { createRexStream } from './rexEvents.js';

export interface RefreshManager {
  getState(): RefreshState;
  stop(): void;
}

export function createRefreshManager(
  config: Config,
  onChange: (state: RefreshState) => void,
): RefreshManager {
  const state = emptyRefreshState();
  const cleanups: (() => void)[] = [];
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const notify = () => onChange(state);

  const ensureFileState = (path: string): FileWatchState => {
    let fs = state.files.get(path);
    if (!fs) {
      fs = { signals: [], notes: [], reviews: [] };
      state.files.set(path, fs);
    }
    return fs;
  };

  const doPoll = () => {
    for (const project of config.projects) {
      try {
        const ghState = pollGitHub(project);
        state.github.set(project.repo, ghState);
        state.sources.github = 'ok';
      } catch {
        state.sources.github = 'error';
      }
    }
    notify();
  };

  // GitHub polling
  doPoll();
  const intervalMs = (config.github?.pollIntervalSeconds ?? 60) * 1000;
  pollTimer = setInterval(doPoll, intervalMs);

  // File watchers
  for (const project of config.projects) {
    const fs = ensureFileState(project.path);
    const cleanup = watchProject(project.path, {
      onSignal: (signal: LaneSignal) => {
        fs.signals.push(signal);
        notify();
      },
      onNotes: (notes: LaneNotes) => {
        const idx = fs.notes.findIndex(n => n.issue === notes.issue);
        if (idx >= 0) fs.notes[idx] = notes;
        else fs.notes.push(notes);
        notify();
      },
      onReview: (review: ReviewResult) => {
        const idx = fs.reviews.findIndex(r => r.reviewer === review.reviewer);
        if (idx >= 0) fs.reviews[idx] = review;
        else fs.reviews.push(review);
        notify();
      },
    });
    cleanups.push(cleanup);
    state.sources.fileWatch = 'ok';
  }

  // Rex event stream
  const rexCleanup = createRexStream({
    onEvent: (event: RexEvent) => {
      state.rexEvents.push(event);
      notify();
    },
    onError: () => {
      state.sources.rex = 'error';
      notify();
    },
  });
  cleanups.push(rexCleanup);
  state.sources.rex = 'ok';

  return {
    getState: () => state,
    stop: () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      for (const fn of cleanups) fn();
      cleanups.length = 0;
    },
  };
}
