import React from 'react';
import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import type { MouseEvent } from './parseMouse.js';
import { MouseProvider, disableMouseTracking, useMouseClick } from './MouseProvider.js';
import { wait } from './testUtils.js';

const written = (frames: string[]) => frames.join('');

describe('MouseProvider', () => {
  it('enables button tracking and SGR mode on mount', async () => {
    const { frames, unmount } = render(<MouseProvider><Text>hi</Text></MouseProvider>);
    await wait();
    expect(written(frames)).toContain('\x1b[?1000h');
    expect(written(frames)).toContain('\x1b[?1006h');
    unmount();
  });
});

describe('MouseProvider click dispatch', () => {
  // Seam: bytes on stdin -> handlers registered via useMouseClick
  const setup = () => {
    const clicks: MouseEvent[] = [];
    const handler = (e: MouseEvent) => { clicks.push(e); };
    const Probe = () => { useMouseClick(handler); return <Text>probe</Text>; };
    const r = render(<MouseProvider><Probe /></MouseProvider>);
    return { clicks, ...r };
  };

  it('dispatches a single press', async () => {
    const { clicks, stdin, unmount } = setup();
    await wait();
    stdin.write('\x1b[<0;5;7M');
    await wait();
    expect(clicks).toEqual([{ x: 5, y: 7, button: 'left', type: 'press' }]);
    unmount();
  });

  it('dispatches every press when several sequences arrive in one chunk', async () => {
    const { clicks, stdin, unmount } = setup();
    await wait();
    stdin.write('\x1b[<0;1;2M\x1b[<0;1;2m\x1b[<0;3;4M');
    await wait();
    expect(clicks.map(c => [c.x, c.y])).toEqual([[1, 2], [3, 4]]);
    unmount();
  });
});

describe('disableMouseTracking', () => {
  it('writes the button-tracking and SGR disable sequences', () => {
    const out: string[] = [];
    disableMouseTracking({ write: (s: string) => { out.push(s); return true; } });
    expect(out.join('')).toBe('\x1b[?1000l\x1b[?1006l');
  });

  it('swallows write errors so exit handlers keep running', () => {
    const broken = { write: () => { throw new Error('EPIPE'); } };
    expect(() => disableMouseTracking(broken)).not.toThrow();
  });
});
