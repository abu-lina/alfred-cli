import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { RexEvent } from './types.js';

export function parseRexEventLine(line: string): RexEvent | null {
  try {
    const obj = JSON.parse(line);
    if (typeof obj.type !== 'string') return null;
    return {
      type: obj.type,
      session: obj.session,
      block: obj.block,
      timestamp: typeof obj.timestamp === 'number' ? obj.timestamp : Date.now(),
      data: obj.data,
    };
  } catch {
    return null;
  }
}

interface RexStreamCallbacks {
  onEvent: (event: RexEvent) => void;
  onError: (err: Error) => void;
}

export function createRexStream(callbacks: RexStreamCallbacks): () => void {
  let proc: ChildProcess | null = null;

  proc = spawn('rex', ['events', '--all', '--json'], { stdio: ['ignore', 'pipe', 'pipe'] });

  const rl = createInterface({ input: proc.stdout! });
  rl.on('line', (line) => {
    const event = parseRexEventLine(line);
    if (event) callbacks.onEvent(event);
  });

  proc.on('error', (err) => {
    callbacks.onError(err);
  });

  proc.on('close', (code) => {
    if (code && code !== 0) {
      callbacks.onError(new Error(`rex events exited with code ${code}`));
    }
  });

  return () => {
    rl.close();
    if (proc && !proc.killed) {
      proc.kill();
    }
    proc = null;
  };
}
