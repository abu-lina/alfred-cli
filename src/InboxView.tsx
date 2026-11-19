import React, { useState } from 'react';
import { Text, Box, useInput } from 'ink';
import type { InboxItem, InboxReason } from './inbox.js';
import { formatAge } from './format.js';
import { Clickable } from './Clickable.js';

interface Props {
  items: InboxItem[];
  onSelect: (item: InboxItem) => void;
}

const REASON_COLORS: Record<InboxReason, string> = {
  'Blocked': 'red',
  'Finished': 'green',
  'Failed CI': 'red',
  'Review ready': 'cyan',
};

export function InboxView({ items, onSelect }: Props) {
  const [focusIndex, setFocusIndex] = useState(0);

  const clamped = Math.min(focusIndex, Math.max(items.length - 1, 0));
  if (clamped !== focusIndex) setFocusIndex(clamped);

  useInput((_input, key) => {
    if (items.length === 0) return;
    if (key.downArrow || key.tab) {
      setFocusIndex(i => (i + 1) % items.length);
    } else if (key.upArrow) {
      setFocusIndex(i => (i - 1 + items.length) % items.length);
    } else if (key.return) {
      const item = items[clamped];
      if (item) onSelect(item);
    }
  });

  if (items.length === 0) {
    return (
      <Box paddingLeft={1}>
        <Text dimColor>Nothing needs your attention</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingLeft={1}>
      {items.map((item, i) => (
        <Clickable key={`${item.repo}-${item.issue}-${item.reason}`} onClick={() => onSelect(item)}>
          <Text>
            <Text>{clamped === i ? '▸' : ' '}</Text>
            <Text bold color={REASON_COLORS[item.reason] ?? 'white'}>{item.prefix}</Text>
            <Text dimColor> #{item.issue}</Text>
            <Text color={REASON_COLORS[item.reason] ?? 'white'}> {item.reason}</Text>
            <Text dimColor> {formatAge(item.since)}</Text>
            <Text>  {item.title}</Text>
            {item.detail ? <Text dimColor>  ({item.detail})</Text> : null}
          </Text>
        </Clickable>
      ))}
    </Box>
  );
}
