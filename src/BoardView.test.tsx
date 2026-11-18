import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { BoardView } from './BoardView.js';
import type { BoardColumns, BoardCard } from './board.js';

const DELAY = 50;
const wait = (ms = DELAY) => new Promise(r => setTimeout(r, ms));

function card(overrides: Partial<BoardCard> & { issue: number; prefix: string }): BoardCard {
  return {
    title: `Issue ${overrides.issue}`,
    repo: 'owner/test',
    column: 'todo',
    since: Date.now() - 60_000,
    ...overrides,
  };
}

describe('BoardView', () => {
  it('renders four column headers', () => {
    const cols: BoardColumns = { needsYou: [], inProgress: [], inReview: [], todo: [] };
    const inst = render(<BoardView columns={cols} onSelect={() => {}} />);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('Needs you');
    expect(frame).toContain('In progress');
    expect(frame).toContain('In review');
    expect(frame).toContain('Todo');
    inst.unmount();
  });

  it('renders a card with prefix, issue number, and title', () => {
    const cols: BoardColumns = {
      needsYou: [],
      inProgress: [],
      inReview: [],
      todo: [card({ issue: 10, prefix: 'TP' })],
    };
    const inst = render(<BoardView columns={cols} onSelect={() => {}} />);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('TP');
    expect(frame).toContain('#10');
    expect(frame).toContain('Issue 10');
    inst.unmount();
  });

  it('renders cards in all four columns', () => {
    const cols: BoardColumns = {
      needsYou: [card({ issue: 1, prefix: 'AA', column: 'needsYou' })],
      inProgress: [card({ issue: 2, prefix: 'BB', column: 'inProgress' })],
      inReview: [card({ issue: 3, prefix: 'CC', column: 'inReview' })],
      todo: [card({ issue: 4, prefix: 'DD', column: 'todo' })],
    };
    const inst = render(<BoardView columns={cols} onSelect={() => {}} />);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('AA');
    expect(frame).toContain('#1');
    expect(frame).toContain('BB');
    expect(frame).toContain('#2');
    expect(frame).toContain('CC');
    expect(frame).toContain('#3');
    expect(frame).toContain('DD');
    expect(frame).toContain('#4');
    inst.unmount();
  });

  it('shows time-in-column', () => {
    const cols: BoardColumns = {
      needsYou: [],
      inProgress: [card({ issue: 5, prefix: 'TP', column: 'inProgress', since: Date.now() - 3_600_000 })],
      inReview: [],
      todo: [],
    };
    const inst = render(<BoardView columns={cols} onSelect={() => {}} />);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('1h');
    inst.unmount();
  });

  it('shows empty state when no cards exist', () => {
    const cols: BoardColumns = { needsYou: [], inProgress: [], inReview: [], todo: [] };
    const inst = render(<BoardView columns={cols} onSelect={() => {}} />);
    const frame = inst.lastFrame()!;
    // Should render without crashing — columns still visible
    expect(frame).toContain('Needs you');
    inst.unmount();
  });

  it('shows focus indicator on the first card', () => {
    const cols: BoardColumns = {
      needsYou: [card({ issue: 1, prefix: 'AA', column: 'needsYou' })],
      inProgress: [],
      inReview: [],
      todo: [],
    };
    const inst = render(<BoardView columns={cols} onSelect={() => {}} />);
    const frame = inst.lastFrame()!;
    expect(frame).toContain('▸');
    inst.unmount();
  });

  it('calls onSelect when enter is pressed on focused card', async () => {
    const selected: BoardCard[] = [];
    const cols: BoardColumns = {
      needsYou: [card({ issue: 1, prefix: 'AA', column: 'needsYou' })],
      inProgress: [],
      inReview: [],
      todo: [],
    };
    const inst = render(<BoardView columns={cols} onSelect={(c) => selected.push(c)} />);
    await wait();
    inst.stdin.write('\r');
    await wait();
    expect(selected).toHaveLength(1);
    expect(selected[0]!.issue).toBe(1);
    inst.unmount();
  });

  it('moves focus between cards with tab', async () => {
    const cols: BoardColumns = {
      needsYou: [card({ issue: 1, prefix: 'AA', column: 'needsYou' })],
      inProgress: [card({ issue: 2, prefix: 'BB', column: 'inProgress' })],
      inReview: [],
      todo: [],
    };
    const selected: BoardCard[] = [];
    const inst = render(<BoardView columns={cols} onSelect={(c) => selected.push(c)} />);
    await wait();
    inst.stdin.write('\t');
    await wait();
    inst.stdin.write('\r');
    await wait();
    expect(selected).toHaveLength(1);
    expect(selected[0]!.issue).toBe(2);
    inst.unmount();
  });
});
