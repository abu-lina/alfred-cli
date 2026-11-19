import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useStdin, useStdout } from 'ink';
import { parseSgrMouse, type MouseEvent } from './parseMouse.js';

type ClickHandler = (e: MouseEvent) => void;

interface MouseContextValue {
  subscribe: (handler: ClickHandler) => () => void;
}

const MouseContext = createContext<MouseContextValue | null>(null);

// Also called from process exit handlers, where stdout may already be closed (EPIPE)
export function disableMouseTracking(out: { write: (s: string) => unknown }) {
  try {
    out.write('\x1b[?1000l\x1b[?1006l');
  } catch { /* nothing left to restore */ }
}

export function useMouseClick(handler: ClickHandler) {
  const ctx = useContext(MouseContext);
  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe(handler);
  }, [ctx, handler]);
}

export function MouseProvider({ children }: { children: React.ReactNode }) {
  const { stdin, setRawMode } = useStdin();
  const { stdout } = useStdout();
  const handlersRef = useRef<Set<ClickHandler>>(new Set());

  // Enable/disable xterm mouse tracking
  useEffect(() => {
    if (!stdout || !stdin) return;
    setRawMode(true);
    stdout.write('\x1b[?1000h'); // enable button event tracking
    stdout.write('\x1b[?1006h'); // enable SGR extended mouse mode
    return () => disableMouseTracking(stdout);
  }, [stdout, stdin, setRawMode]);

  // Listen for mouse data on stdin
  useEffect(() => {
    if (!stdin) return;
    const onData = (data: Buffer) => {
      // A chunk can batch several sequences; split at each ESC so none are dropped
      // shortcut: a sequence fragmented across two chunks is still dropped, buffer if SSH fragmentation shows up
      for (const part of data.toString('utf-8').split(/(?=\x1b)/)) {
        const evt = parseSgrMouse(part);
        // Only dispatch press events to avoid double-firing
        if (evt?.type !== 'press') continue;
        for (const handler of handlersRef.current) {
          handler(evt);
        }
      }
    };
    stdin.on('data', onData);
    return () => { stdin.off('data', onData); };
  }, [stdin]);

  const subscribe = useCallback((handler: ClickHandler) => {
    handlersRef.current.add(handler);
    return () => { handlersRef.current.delete(handler); };
  }, []);

  const value = React.useMemo(() => ({ subscribe }), [subscribe]);

  return (
    <MouseContext.Provider value={value}>
      {children}
    </MouseContext.Provider>
  );
}
