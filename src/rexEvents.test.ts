import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseRexEventLine, createRexStream } from './rexEvents.js';
import type { RexEvent } from './types.js';
import { Readable } from 'node:stream';
import * as child_process from 'node:child_process';

vi.mock('node:child_process');

describe('parseRexEventLine', () => {
  it('parses a valid NDJSON line into a RexEvent', () => {
    const line = JSON.stringify({
      type: 'session.created',
      session: 'sess-1',
      block: 'blk-1',
      timestamp: 1000,
      data: { foo: 'bar' },
    });
    const event = parseRexEventLine(line);
    expect(event).toEqual({
      type: 'session.created',
      session: 'sess-1',
      block: 'blk-1',
      timestamp: 1000,
      data: { foo: 'bar' },
    });
  });

  it('returns null for invalid JSON', () => {
    expect(parseRexEventLine('not json')).toBeNull();
  });

  it('returns null when type field is missing', () => {
    expect(parseRexEventLine(JSON.stringify({ session: 'x' }))).toBeNull();
  });

  it('defaults timestamp to Date.now() when missing', () => {
    const event = parseRexEventLine(JSON.stringify({ type: 'test' }));
    expect(event!.timestamp).toBeGreaterThan(0);
  });
});

describe('createRexStream', () => {
  const spawn = vi.mocked(child_process.spawn);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('spawns rex events and calls onEvent for each NDJSON line', async () => {
    const stdout = new Readable({ read() {} });
    const fakeProc = {
      stdout,
      stderr: new Readable({ read() {} }),
      on: vi.fn(),
      kill: vi.fn(),
      killed: false,
    } as unknown as child_process.ChildProcess;

    spawn.mockReturnValue(fakeProc);

    const events: RexEvent[] = [];
    const onError = vi.fn();
    const cleanup = createRexStream({ onEvent: (e) => events.push(e), onError });

    // Simulate NDJSON output
    stdout.push(JSON.stringify({ type: 'session.created', session: 's1', timestamp: 100 }) + '\n');
    stdout.push(JSON.stringify({ type: 'block.output', block: 'b1', timestamp: 200 }) + '\n');

    // Let the readline async processing complete
    await new Promise(r => setTimeout(r, 100));

    expect(events).toHaveLength(2);
    expect(events[0]!.type).toBe('session.created');
    expect(events[1]!.type).toBe('block.output');

    cleanup();
  });

  it('calls onError when the process exits with an error', async () => {
    const stdout = new Readable({ read() {} });
    const fakeProc = {
      stdout,
      stderr: new Readable({ read() {} }),
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (event === 'error') cb(new Error('spawn failed'));
        return fakeProc;
      }),
      kill: vi.fn(),
      killed: false,
    } as unknown as child_process.ChildProcess;

    spawn.mockReturnValue(fakeProc);

    const onError = vi.fn();
    const cleanup = createRexStream({ onEvent: () => {}, onError });

    await new Promise(r => setTimeout(r, 50));
    expect(onError).toHaveBeenCalledWith(expect.any(Error));

    cleanup();
  });
});
