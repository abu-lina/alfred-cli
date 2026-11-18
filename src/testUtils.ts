import React from 'react';
import { render } from 'ink-testing-library';

export function renderHook<T>(hook: () => T) {
  const resultRef = { current: undefined as T };

  function TestComponent() {
    resultRef.current = hook();
    return null;
  }

  const inst = render(React.createElement(TestComponent));

  return { result: resultRef, unmount: inst.unmount, rerender: inst.rerender };
}

export const DELAY = 50;
export const wait = (ms = DELAY) => new Promise(r => setTimeout(r, ms));

export { act } from 'react';
