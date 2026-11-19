/** Pure parser for SGR extended mouse sequences: \x1b[<Btn;X;Y[Mm] */

export type MouseButton = 'left' | 'middle' | 'right' | null;
export type MouseEventType = 'press' | 'release' | 'scroll-up' | 'scroll-down' | 'move' | null;

export interface MouseEvent {
  x: number;
  y: number;
  button: MouseButton;
  type: MouseEventType;
}

// SGR mouse format: ESC [ < Btn ; Col ; Row M  (press) or  ESC [ < Btn ; Col ; Row m  (release)
const SGR_RE = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/;

export function parseSgrMouse(data: string): MouseEvent | null {
  const m = SGR_RE.exec(data);
  if (!m) return null;

  const btn = Number(m[1]);
  const x = Number(m[2]);
  const y = Number(m[3]);
  const suffix = m[4]; // 'M' = press, 'm' = release

  // Scroll events (btn 64 = scroll up, 65 = scroll down)
  if (btn === 64) return { x, y, button: null, type: 'scroll-up' };
  if (btn === 65) return { x, y, button: null, type: 'scroll-down' };

  // Motion events (btn >= 32 and < 64)
  if (btn >= 32 && btn < 64) {
    const base = btn - 32;
    const button: MouseButton = base === 0 ? 'left' : base === 1 ? 'middle' : base === 2 ? 'right' : null;
    return { x, y, button, type: 'move' };
  }

  // Regular button events
  const button: MouseButton = btn === 0 ? 'left' : btn === 1 ? 'middle' : btn === 2 ? 'right' : null;
  const type: MouseEventType = suffix === 'M' ? 'press' : 'release';

  return { x, y, button, type };
}
