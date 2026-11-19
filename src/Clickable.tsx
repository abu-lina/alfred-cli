import React, { useRef, useCallback } from 'react';
import { Box, DOMElement } from 'ink';
import { useMouseClick } from './MouseProvider.js';
import type { MouseEvent } from './parseMouse.js';

interface Props {
  children: React.ReactNode;
  onClick: () => void;
}

/** Walk up the Ink DOMElement tree to compute absolute terminal position. */
function getAbsolutePosition(node: DOMElement): { x: number; y: number; width: number; height: number } | null {
  const yoga = node.yogaNode;
  if (!yoga) return null;
  let x = yoga.getComputedLeft();
  let y = yoga.getComputedTop();
  const width = yoga.getComputedWidth();
  const height = yoga.getComputedHeight();
  // Walk up parents to accumulate offsets
  let parent = node.parentNode as DOMElement | null;
  while (parent?.yogaNode) {
    x += parent.yogaNode.getComputedLeft();
    y += parent.yogaNode.getComputedTop();
    parent = parent.parentNode as DOMElement | null;
  }
  return { x, y, width, height };
}

/**
 * Wraps children in a Box and fires onClick when a left-click lands inside its bounds.
 * Uses Yoga layout nodes for hit-testing. No state updates on irrelevant mouse events
 * (avoids re-render loops).
 */
export function Clickable({ children, onClick }: Props) {
  const ref = useRef<DOMElement>(null);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  const handler = useCallback((e: MouseEvent) => {
    if (e.button !== 'left') return;
    if (!ref.current) return;
    const pos = getAbsolutePosition(ref.current);
    if (!pos) return;
    // SGR mouse coords are 1-based; yoga layout is 0-based
    const mx = e.x - 1;
    const my = e.y - 1;
    if (mx >= pos.x && mx < pos.x + pos.width && my >= pos.y && my < pos.y + pos.height) {
      onClickRef.current();
    }
  }, []);

  useMouseClick(handler);

  return <Box ref={ref}>{children}</Box>;
}
