import type { Config } from './config.js';
import type { RefreshState, RexEvent, LaneSignal, LaneNotes, ReviewResult, FileWatchState } from './types.js';
import { emptyRefreshState } from './types.js';
import { pollGitHub } from './ghPoller.js';
import { watchProject } from './fileWatcher.js';
import { createRexStream } from './rexEvents.js';

const MAX_EVENTS = 500;
const MAX_SIGNALS = 200;

function capArray<T>(arr: T[], max: number): void {
  if (arr.length > max) arr.splice(0, arr.length - max);
}

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
  let stopped = false;

  const notify = () => { if (!stopped) onChange(state); };

  const ensureFileState = (path: string): FileWatchState => {
    let entry = state.files.get(path);
    if (!entry) {
      entry = { signals: [], notes: [], reviews: [] };
      state.files.set(path, entry);
    }
    return entry;
  };

  const doPoll = async () => {
    let anyOk = false;
    let anyError = false;
    const results = await Promise.allSettled(
      config.projects.map(async (project) => {
        const ghState = await pollGitHub(project);
        return { repo: project.repo, ghState };
      }),
    );
    for (const result of results) {
      if (result.status === 'fulfilled') {
        state.github.set(result.value.repo, result.value.ghState);
        anyOk = true;
      } else {
        anyError = true;
      }
    }
    state.sources.github = anyOk ? 'ok' : anyError ? 'error' : 'unavailable';
    notify();
  };

  doPoll();
  const intervalMs = (config.github?.pollIntervalSeconds ?? 60) * 1000;
  pollTimer = setInterval(() => { doPoll(); }, intervalMs);

  for (const project of config.projects) {
    const fileState = ensureFileState(project.path);
    const cleanup = watchProject(project.path, {
      onSignal: (signal: LaneSignal) => {
        fileState.signals.push(signal);
        capArray(fileState.signals, MAX_SIGNALS);
        notify();
      },
      onNotes: (notes: LaneNotes) => {
        const idx = fileState.notes.findIndex(n => n.issue === notes.issue);
        if (idx >= 0) fileState.notes[idx] = notes;
        else fileState.notes.push(notes);
        notify();
      },
      onReview: (review: ReviewResult) => {
        const idx = fileState.reviews.findIndex(r => r.issue === review.issue && r.reviewer === review.reviewer);
        if (idx >= 0) fileState.reviews[idx] = review;
        else fileState.reviews.push(review);
        notify();
      },
    });
    cleanups.push(cleanup);
    state.sources.fileWatch = 'ok';
  }

  const rexCleanup = createRexStream({
    onEvent: (event: RexEvent) => {
      state.rexEvents.push(event);
      capArray(state.rexEvents, MAX_EVENTS);
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
      stopped = true;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      for (const fn of cleanups) fn();
      cleanups.length = 0;
    },
  };
}
