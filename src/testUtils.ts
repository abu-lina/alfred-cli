import React, { useRef } from 'react';
import { render } from 'ink-testing-library';

type AnyFn = () => unknown;

export function renderHook<T>(hook: () => T) {
  const resultRef = { current: undefined as T };

  function TestComponent() {
    resultRef.current = hook();
    return null;
  }

  const inst = render(React.createElement(TestComponent));

  return { result: resultRef, unmount: inst.unmount, rerender: inst.rerender };
}

export { act } from 'react';
