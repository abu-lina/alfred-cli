import React from 'react';
import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { MouseProvider } from './MouseProvider.js';
import { Clickable } from './Clickable.js';
import { wait } from './testUtils.js';

describe('Clickable', () => {
  const setup = () => {
    let clicks = 0;
    const r = render(
      <MouseProvider><Clickable onClick={() => { clicks++; }}><Text>button</Text></Clickable></MouseProvider>,
    );
    return { count: () => clicks, ...r };
  };

  it('fires onClick for a left-click inside its bounds', async () => {
    const { count, stdin, unmount } = setup();
    await wait();
    stdin.write('\x1b[<0;2;1M');
    await wait();
    expect(count()).toBe(1);
    unmount();
  });

  it.each([
    ['outside x', '\x1b[<0;200;1M'],
    ['outside y', '\x1b[<0;2;5M'],
    ['right button', '\x1b[<2;2;1M'],
  ])('ignores a click: %s', async (_name, seq) => {
    const { count, stdin, unmount } = setup();
    await wait();
    stdin.write(seq);
    await wait();
    expect(count()).toBe(0);
    unmount();
  });
});
