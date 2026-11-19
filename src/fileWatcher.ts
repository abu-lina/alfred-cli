import { watch, readFileSync, readdirSync, existsSync, realpathSync, type FSWatcher } from 'node:fs';
import { join, basename } from 'node:path';
import type { LaneSignal, LaneNotes, ReviewResult } from './types.js';

const SIGNAL_TYPES = new Set<string>(['block', 'handoff', 'progress']);

/** Strip control characters (0x00-0x1F, 0x7F) to prevent terminal escape injection. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[\x00-\x1f\x7f]/g, '');
}

export function parseLaneSignal(raw: string): LaneSignal | null {
  try {
    const obj = JSON.parse(raw);
    if (!SIGNAL_TYPES.has(obj.type) || typeof obj.issue !== 'number' || typeof obj.message !== 'string') {
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

export interface LaneNotesSections {
  goal: string;
  plan: { done: boolean; text: string }[];
  decisions: string;
  blockers: string;
  changedFiles: string[];
}

export function parseLaneNotesSections(raw: string): LaneNotesSections {
  // Split on ## headings, keeping section names
  const sectionMap: Record<string, string> = {};
  const parts = raw.split(/^## /m);
  for (const part of parts.slice(1)) {
    const nl = part.indexOf('\n');
    const heading = part.slice(0, nl).trim().toLowerCase();
    sectionMap[heading] = part.slice(nl + 1).trim();
  }

  const planRaw = sectionMap['plan'] ?? '';
  const plan = planRaw
    .split('\n')
    .filter(l => /^- \[[ x]\]/.test(l))
    .map(l => ({ done: l.startsWith('- [x]'), text: l.replace(/^- \[[ x]\] /, '') }));

  const changedRaw = sectionMap['changed files'] ?? '';
  const changedFiles = changedRaw
    .split('\n')
    .map(l => l.replace(/^- /, '').trim())
    .filter(Boolean);

  return {
    goal: sectionMap['goal'] ?? '',
    plan,
    decisions: sectionMap['decisions'] ?? '',
    blockers: sectionMap['blockers'] ?? '',
    changedFiles,
  };
}

export function parseReviewResult(raw: string, reviewer: string, issue: number): ReviewResult {
  const verdictMatch = raw.match(/\*\*Verdict:\*\*\s*(.+)/);
  const criticalMatch = raw.match(/\*\*Critical:\*\*\s*(\d+)/);
  const importantMatch = raw.match(/\*\*Important:\*\*\s*(\d+)/);

  return {
    issue,
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
  onError?: (error: unknown) => void;
}

function issueFromDirName(name: string): number {
  const match = name.match(/^(\d+)-/);
  return match ? parseInt(match[1]!, 10) : 0;
}

export function watchProject(projectPath: string, callbacks: WatchCallbacks): () => void {
  const watchers: FSWatcher[] = [];
  const watchedDirs = new Set<string>();
  const worktreesDir = join(projectPath, '.worktrees');

  if (!existsSync(worktreesDir)) return () => {};

  const realRoot = realpathSync(projectPath);

  const scanWorktree = (wtDir: string) => {
    if (watchedDirs.has(wtDir)) return;

    // Resolve symlinks and reject paths outside the project root
    let realWtDir: string;
    try {
      realWtDir = realpathSync(wtDir);
    } catch {
      return; // broken symlink or inaccessible
    }
    if (!realWtDir.startsWith(realRoot + '/') && realWtDir !== realRoot) return;

    watchedDirs.add(wtDir);
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
        const reviewer = sanitizeFilename(filename.replace(/\.md$/, ''));
        callbacks.onReview(parseReviewResult(raw, reviewer, issue));
      } catch {
        // file may have been deleted
      }
    };

    try {
      const wt = watch(wtDir, (_, filename) => handleFile(filename));
      watchers.push(wt);
    } catch (err) {
      callbacks.onError?.(err);
    }

    const reviewDir = join(wtDir, '.review-results');
    if (existsSync(reviewDir)) {
      try {
        const rw = watch(reviewDir, (_, filename) => handleReviewFile(filename));
        watchers.push(rw);
      } catch (err) {
        callbacks.onError?.(err);
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
  } catch (err) {
    callbacks.onError?.(err);
  }

  // Watch for new worktrees being created or removed
  try {
    const dirWatcher = watch(worktreesDir, (_, filename) => {
      if (!filename) return;
      const dir = join(worktreesDir, filename);
      if (existsSync(dir)) {
        scanWorktree(dir);
      } else {
        watchedDirs.delete(dir);
      }
    });
    watchers.push(dirWatcher);
  } catch (err) {
    callbacks.onError?.(err);
  }

  return () => {
    for (const w of watchers) {
      try { w.close(); } catch { /* already closed */ }
    }
    watchers.length = 0;
    watchedDirs.clear();
  };
}
