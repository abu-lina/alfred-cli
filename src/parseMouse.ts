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
const SGR_RE = /\x1b\[<(\d{1,4});(\d{1,4});(\d{1,4})([Mm])/; // bounded so huge numbers can't wrap in the bitwise ops

export function parseSgrMouse(data: string): MouseEvent | null {
  const m = SGR_RE.exec(data);
  if (!m) return null;

  const btn = Number(m[1]);
  const x = Number(m[2]);
  const y = Number(m[3]);
  const suffix = m[4]; // 'M' = press, 'm' = release

  // Shift (4), Meta (8) and Ctrl (16) add to the code; the low 2 bits are the button
  const base = btn & 0x03;

  // Scroll events (bit 64: base 0 = scroll up, 1 = scroll down)
  if ((btn & 0x40) && base === 0) return { x, y, button: null, type: 'scroll-up' };
  if ((btn & 0x40) && base === 1) return { x, y, button: null, type: 'scroll-down' };

  // Motion events (bit 32)
  if (btn & 0x20 && !(btn & 0x40)) {
    const button: MouseButton = base === 0 ? 'left' : base === 1 ? 'middle' : base === 2 ? 'right' : null;
    return { x, y, button, type: 'move' };
  }

  // Regular button events (scroll codes 66/67 and back/forward codes 128+ have no button)
  const button: MouseButton = btn & 0xc0 ? null : base === 0 ? 'left' : base === 1 ? 'middle' : base === 2 ? 'right' : null;
  const type: MouseEventType = suffix === 'M' ? 'press' : 'release';

  return { x, y, button, type };
}
