import React from 'react';
import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { MouseProvider, disableMouseTracking } from './MouseProvider.js';
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
