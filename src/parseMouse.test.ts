import { describe, it, expect } from 'vitest';
import { parseSgrMouse } from './parseMouse.js';

describe('parseSgrMouse', () => {
  it('parses left click press', () => {
    // ESC [ < 0 ; 10 ; 5 M  (left press at col 10, row 5)
    const result = parseSgrMouse('\x1b[<0;10;5M');
    expect(result).toEqual({ x: 10, y: 5, button: 'left', type: 'press' });
  });

  it('parses left click release', () => {
    const result = parseSgrMouse('\x1b[<0;10;5m');
    expect(result).toEqual({ x: 10, y: 5, button: 'left', type: 'release' });
  });

  it('parses middle click', () => {
    const result = parseSgrMouse('\x1b[<1;3;7M');
    expect(result).toEqual({ x: 3, y: 7, button: 'middle', type: 'press' });
  });

  it('parses right click', () => {
    const result = parseSgrMouse('\x1b[<2;1;1M');
    expect(result).toEqual({ x: 1, y: 1, button: 'right', type: 'press' });
  });

  it('parses scroll up', () => {
    const result = parseSgrMouse('\x1b[<64;5;10M');
    expect(result).toEqual({ x: 5, y: 10, button: null, type: 'scroll-up' });
  });

  it('parses scroll down', () => {
    const result = parseSgrMouse('\x1b[<65;5;10M');
    expect(result).toEqual({ x: 5, y: 10, button: null, type: 'scroll-down' });
  });

  it('parses mouse motion with left button held', () => {
    // btn 32 = motion + left button
    const result = parseSgrMouse('\x1b[<32;20;15M');
    expect(result).toEqual({ x: 20, y: 15, button: 'left', type: 'move' });
  });

  it('parses large coordinates (SGR extended mode)', () => {
    // Coordinates > 223 only work in SGR mode
    const result = parseSgrMouse('\x1b[<0;300;250M');
    expect(result).toEqual({ x: 300, y: 250, button: 'left', type: 'press' });
  });

  it('returns null for non-mouse data', () => {
    expect(parseSgrMouse('hello')).toBeNull();
    expect(parseSgrMouse('\x1b[A')).toBeNull(); // arrow key
    expect(parseSgrMouse('')).toBeNull();
  });

  it('parses mouse event embedded in other data', () => {
    // Terminal may send mouse sequences mixed with other data
    const result = parseSgrMouse('garbage\x1b[<0;5;3Mmore');
    expect(result).toEqual({ x: 5, y: 3, button: 'left', type: 'press' });
  });
});
