import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useStdin, useStdout } from 'ink';
import { parseSgrMouse, type MouseEvent } from './parseMouse.js';

type ClickHandler = (e: MouseEvent) => void;

interface MouseContextValue {
  subscribe: (handler: ClickHandler) => () => void;
}

const MouseContext = createContext<MouseContextValue | null>(null);

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
    return () => {
      stdout.write('\x1b[?1000l');
      stdout.write('\x1b[?1006l');
    };
  }, [stdout, stdin, setRawMode]);

  // Listen for mouse data on stdin
  useEffect(() => {
    if (!stdin) return;
    const onData = (data: Buffer) => {
      const str = data.toString('utf-8');
      const evt = parseSgrMouse(str);
      if (!evt) return;
      // Only dispatch press events to avoid double-firing
      if (evt.type !== 'press') return;
      for (const handler of handlersRef.current) {
        handler(evt);
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
