import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  parseLaneSignal,
  parseLaneNotes,
  parseReviewResult,
  watchProject,
} from './fileWatcher.js';
import type { LaneSignal, LaneNotes, ReviewResult } from './types.js';

function tmpDir(): string {
  const d = join(tmpdir(), `alfred-fw-${randomUUID()}`);
  mkdirSync(d, { recursive: true });
  return d;
}

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

describe('parseLaneSignal', () => {
  it('parses a valid JSON lane-signal file', () => {
    const raw = JSON.stringify({ type: 'block', issue: 5, message: 'need review', timestamp: 1000 });
    const signal = parseLaneSignal(raw);
    expect(signal).toEqual({ type: 'block', issue: 5, message: 'need review', timestamp: 1000 });
  });

  it('returns null for invalid JSON', () => {
    expect(parseLaneSignal('not json')).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    expect(parseLaneSignal(JSON.stringify({ type: 'block' }))).toBeNull();
  });

  it('returns null for invalid signal type', () => {
    const raw = JSON.stringify({ type: 'unknown-thing', issue: 5, message: 'hi', timestamp: 1000 });
    expect(parseLaneSignal(raw)).toBeNull();
  });
});

describe('parseLaneNotes', () => {
  it('parses a lane-notes markdown file with issue number from header', () => {
    const raw = '# Lane Notes — #5 Hybrid refresh\n\n## Goal\nDo stuff\n';
    const notes = parseLaneNotes(raw, 5);
    expect(notes).toEqual({ issue: 5, raw, updatedAt: expect.any(Number) });
  });
});

describe('parseReviewResult', () => {
  it('extracts verdict and counts from review markdown', () => {
    const raw = [
      '# Review: code-reviewer',
      '',
      '**Verdict:** Pass with notes',
      '**Critical:** 0',
      '**Important:** 2',
      '',
      '## Findings',
      'stuff',
    ].join('\n');
    const result = parseReviewResult(raw, 'code-reviewer');
    expect(result).toEqual({
      reviewer: 'code-reviewer',
      verdict: 'Pass with notes',
      critical: 0,
      important: 2,
      raw,
      updatedAt: expect.any(Number),
    });
  });

  it('defaults counts to 0 when not found', () => {
    const raw = '# Review: sec\n\n**Verdict:** Pass\n';
    const result = parseReviewResult(raw, 'sec');
    expect(result!.critical).toBe(0);
    expect(result!.important).toBe(0);
  });
});

describe('watchProject', () => {
  it('detects .lane-signal file creation and calls onSignal', async () => {
    const dir = tmpDir();
    dirs.push(dir);
    const worktreeDir = join(dir, '.worktrees', '5-test');
    mkdirSync(worktreeDir, { recursive: true });

    const signals: LaneSignal[] = [];
    const cleanup = watchProject(dir, {
      onSignal: (s) => signals.push(s),
      onNotes: () => {},
      onReview: () => {},
    });

    const signalData = JSON.stringify({ type: 'block', issue: 5, message: 'stuck', timestamp: Date.now() });
    writeFileSync(join(worktreeDir, '.lane-signal'), signalData);

    // fs.watch is async — wait for the event to propagate
    await new Promise(r => setTimeout(r, 1500));

    cleanup();
    expect(signals.length).toBeGreaterThanOrEqual(1);
    expect(signals[0]!.type).toBe('block');
  });

  it('detects .lane-notes.md changes and calls onNotes', async () => {
    const dir = tmpDir();
    dirs.push(dir);
    const worktreeDir = join(dir, '.worktrees', '7-other');
    mkdirSync(worktreeDir, { recursive: true });

    const notes: LaneNotes[] = [];
    const cleanup = watchProject(dir, {
      onSignal: () => {},
      onNotes: (n) => notes.push(n),
      onReview: () => {},
    });

    writeFileSync(join(worktreeDir, '.lane-notes.md'), '# Lane Notes — #7 Other\n\n## Goal\nStuff\n');
    await new Promise(r => setTimeout(r, 500));

    cleanup();
    expect(notes.length).toBeGreaterThanOrEqual(1);
    expect(notes[0]!.issue).toBe(7);
  });

  it('returns a cleanup function that stops watching', () => {
    const dir = tmpDir();
    dirs.push(dir);
    mkdirSync(join(dir, '.worktrees', '1-x'), { recursive: true });

    const cleanup = watchProject(dir, {
      onSignal: () => {},
      onNotes: () => {},
      onReview: () => {},
    });

    // should not throw
    cleanup();
    cleanup(); // idempotent
  });
});
