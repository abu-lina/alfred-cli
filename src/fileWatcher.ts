import { watch, readFileSync, readdirSync, existsSync, type FSWatcher } from 'node:fs';
import { join, basename } from 'node:path';
import type { LaneSignal, LaneNotes, ReviewResult } from './types.js';

export function parseLaneSignal(raw: string): LaneSignal | null {
  try {
    const obj = JSON.parse(raw);
    if (typeof obj.type !== 'string' || typeof obj.issue !== 'number' || typeof obj.message !== 'string') {
      return null;
    }
    return { type: obj.type, issue: obj.issue, message: obj.message, timestamp: obj.timestamp ?? Date.now() };
  } catch {
    return null;
  }
}

export function parseLaneNotes(raw: string, issue: number): LaneNotes {
  return { issue, raw, updatedAt: Date.now() };
}

export function parseReviewResult(raw: string, reviewer: string): ReviewResult {
  const verdictMatch = raw.match(/\*\*Verdict:\*\*\s*(.+)/);
  const criticalMatch = raw.match(/\*\*Critical:\*\*\s*(\d+)/);
  const importantMatch = raw.match(/\*\*Important:\*\*\s*(\d+)/);

  return {
    reviewer,
    verdict: verdictMatch?.[1]?.trim() ?? 'unknown',
    critical: criticalMatch ? parseInt(criticalMatch[1]!, 10) : 0,
    important: importantMatch ? parseInt(importantMatch[1]!, 10) : 0,
    raw,
    updatedAt: Date.now(),
  };
}

export interface WatchCallbacks {
  onSignal: (signal: LaneSignal) => void;
  onNotes: (notes: LaneNotes) => void;
  onReview: (review: ReviewResult) => void;
}

function issueFromDirName(name: string): number {
  const match = name.match(/^(\d+)-/);
  return match ? parseInt(match[1]!, 10) : 0;
}

export function watchProject(projectPath: string, callbacks: WatchCallbacks): () => void {
  const watchers: FSWatcher[] = [];
  const worktreesDir = join(projectPath, '.worktrees');

  if (!existsSync(worktreesDir)) return () => {};

  const scanWorktree = (wtDir: string) => {
    const issue = issueFromDirName(basename(wtDir));

    const handleFile = (filename: string | null) => {
      if (!filename) return;
      try {
        if (filename === '.lane-signal') {
          const raw = readFileSync(join(wtDir, filename), 'utf-8');
          const signal = parseLaneSignal(raw);
          if (signal) callbacks.onSignal(signal);
        } else if (filename === '.lane-notes.md') {
          const raw = readFileSync(join(wtDir, filename), 'utf-8');
          callbacks.onNotes(parseLaneNotes(raw, issue));
        }
      } catch {
        // file may have been deleted between event and read
      }
    };

    const handleReviewFile = (filename: string | null) => {
      if (!filename) return;
      try {
        const reviewDir = join(wtDir, '.review-results');
        const raw = readFileSync(join(reviewDir, filename), 'utf-8');
        const reviewer = filename.replace(/\.md$/, '');
        callbacks.onReview(parseReviewResult(raw, reviewer));
      } catch {
        // file may have been deleted
      }
    };

    try {
      const wt = watch(wtDir, (_, filename) => handleFile(filename));
      watchers.push(wt);
    } catch {
      // worktree dir may not exist yet
    }

    const reviewDir = join(wtDir, '.review-results');
    if (existsSync(reviewDir)) {
      try {
        const rw = watch(reviewDir, (_, filename) => handleReviewFile(filename));
        watchers.push(rw);
      } catch {
        // review dir may disappear
      }
    }
  };

  // Watch existing worktrees
  try {
    const entries = readdirSync(worktreesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        scanWorktree(join(worktreesDir, entry.name));
      }
    }
  } catch {
    // worktrees dir might not be readable
  }

  // Watch for new worktrees being created
  try {
    const dirWatcher = watch(worktreesDir, (_, filename) => {
      if (filename) {
        const newDir = join(worktreesDir, filename);
        if (existsSync(newDir)) scanWorktree(newDir);
      }
    });
    watchers.push(dirWatcher);
  } catch {
    // worktrees dir might not be watchable
  }

  return () => {
    for (const w of watchers) {
      try { w.close(); } catch { /* already closed */ }
    }
    watchers.length = 0;
  };
}
