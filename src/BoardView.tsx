import React, { useState } from 'react';
import { Text, Box, useInput } from 'ink';
import type { BoardColumns, BoardCard } from './board.js';

interface Props {
  columns: BoardColumns;
  onSelect: (card: BoardCard) => void;
}

function formatAge(since: number): string {
  const ms = Date.now() - since;
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const COLUMN_COLORS: Record<BoardCard['column'], string> = {
  needsYou: 'red',
  inProgress: 'yellow',
  inReview: 'cyan',
  todo: 'white',
};

const COLUMN_LABELS: Record<BoardCard['column'], string> = {
  needsYou: 'Needs you',
  inProgress: 'In progress',
  inReview: 'In review',
  todo: 'Todo',
};

function Card({ card, focused }: { card: BoardCard; focused: boolean }) {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Text>
        <Text>{focused ? '▸' : ' '}</Text>
        <Text bold color={COLUMN_COLORS[card.column]}>{card.prefix}</Text>
        <Text dimColor> #{card.issue}</Text>
        <Text dimColor> {formatAge(card.since)}</Text>
      </Text>
      <Text wrap="truncate">  {card.title}</Text>
    </Box>
  );
}

function Column({ name, cards, focusIndex, offset }: { name: BoardCard['column']; cards: BoardCard[]; focusIndex: number; offset: number }) {
  return (
    <Box flexDirection="column" flexGrow={1} flexBasis={0}>
      <Box paddingLeft={1}>
        <Text bold underline color={COLUMN_COLORS[name]}>{COLUMN_LABELS[name]}</Text>
        <Text dimColor> ({cards.length})</Text>
      </Box>
      {cards.map((c, i) => (
        <Card key={`${c.repo}-${c.issue}`} card={c} focused={focusIndex === offset + i} />
      ))}
    </Box>
  );
}

export function BoardView({ columns, onSelect }: Props) {
  const allCards = [...columns.needsYou, ...columns.inProgress, ...columns.inReview, ...columns.todo];
  const [focusIndex, setFocusIndex] = useState(0);

  useInput((_input, key) => {
    if (allCards.length === 0) return;
    if (key.downArrow || key.tab) {
      setFocusIndex(i => (i + 1) % allCards.length);
    } else if (key.upArrow) {
      setFocusIndex(i => (i - 1 + allCards.length) % allCards.length);
    } else if (key.return) {
      const card = allCards[focusIndex];
      if (card) onSelect(card);
    }
  });

  const offsets = {
    needsYou: 0,
    inProgress: columns.needsYou.length,
    inReview: columns.needsYou.length + columns.inProgress.length,
    todo: columns.needsYou.length + columns.inProgress.length + columns.inReview.length,
  };

  return (
    <Box flexDirection="row" width="100%">
      <Column name="needsYou" cards={columns.needsYou} focusIndex={focusIndex} offset={offsets.needsYou} />
      <Column name="inProgress" cards={columns.inProgress} focusIndex={focusIndex} offset={offsets.inProgress} />
      <Column name="inReview" cards={columns.inReview} focusIndex={focusIndex} offset={offsets.inReview} />
      <Column name="todo" cards={columns.todo} focusIndex={focusIndex} offset={offsets.todo} />
    </Box>
  );
}
