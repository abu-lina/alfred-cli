import React from 'react';
import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { MouseProvider } from './MouseProvider.js';
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
