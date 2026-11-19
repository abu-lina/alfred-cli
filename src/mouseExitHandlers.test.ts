import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { disableMouseTracking, installExitHandlers, _resetExitHandlers } from './MouseProvider.js';

describe('mouse exit handlers', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetExitHandlers();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true) as any;
  });

  afterEach(() => {
    writeSpy.mockRestore();
    process.removeAllListeners('exit');
    process.removeAllListeners('uncaughtException');
  });

  it('disableMouseTracking writes disable sequences to stdout', () => {
    disableMouseTracking();
    expect(writeSpy).toHaveBeenCalledWith('\x1b[?1000l\x1b[?1006l');
  });

  it('installExitHandlers registers an exit listener', () => {
    const before = process.listenerCount('exit');
    installExitHandlers();
    expect(process.listenerCount('exit')).toBe(before + 1);
  });

  it('installExitHandlers is idempotent', () => {
    installExitHandlers();
    const count = process.listenerCount('exit');
    installExitHandlers();
    expect(process.listenerCount('exit')).toBe(count);
  });

  it('exit handler calls disableMouseTracking', () => {
    installExitHandlers();
    process.emit('exit', 0);
    expect(writeSpy).toHaveBeenCalledWith('\x1b[?1000l\x1b[?1006l');
  });

  it('does not throw if stdout.write fails', () => {
    writeSpy.mockRestore();
    vi.spyOn(process.stdout, 'write').mockImplementation(() => { throw new Error('broken'); });
    expect(() => disableMouseTracking()).not.toThrow();
    vi.restoreAllMocks();
  });
});
