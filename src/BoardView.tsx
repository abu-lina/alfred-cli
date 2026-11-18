import React, { useState } from 'react';
import { Text, Box, useInput } from 'ink';
import { Clickable, Hoverable } from 'ink-use-mouse';
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

function Card({ card, focused, onSelect }: { card: BoardCard; focused: boolean; onSelect: () => void }) {
  return (
    <Clickable onClick={onSelect}>
      <Hoverable>
        {(hovered) => (
          <Box flexDirection="column" paddingLeft={1}>
            <Text>
              <Text>{focused ? '▸' : hovered ? '›' : ' '}</Text>
              <Text bold color={COLUMN_COLORS[card.column]}>{card.prefix}</Text>
              <Text dimColor> #{card.issue}</Text>
              <Text dimColor> {formatAge(card.since)}</Text>
            </Text>
            <Text wrap="truncate">  {card.title}</Text>
          </Box>
        )}
      </Hoverable>
    </Clickable>
  );
}

function Column({ name, cards, focusIndex, offset, onSelect }: { name: BoardCard['column']; cards: BoardCard[]; focusIndex: number; offset: number; onSelect: (card: BoardCard) => void }) {
  return (
    <Box flexDirection="column" flexGrow={1} flexBasis={0}>
      <Box paddingLeft={1}>
        <Text bold underline color={COLUMN_COLORS[name]}>{COLUMN_LABELS[name]}</Text>
        <Text dimColor> ({cards.length})</Text>
      </Box>
      {cards.map((c, i) => (
        <Card key={`${c.repo}-${c.issue}`} card={c} focused={focusIndex === offset + i} onSelect={() => onSelect(c)} />
      ))}
    </Box>
  );
}

export function BoardView({ columns, onSelect }: Props) {
  const allCards = [...columns.needsYou, ...columns.inProgress, ...columns.inReview, ...columns.todo];
  const [focusIndex, setFocusIndex] = useState(0);

  const clamped = Math.min(focusIndex, Math.max(allCards.length - 1, 0));
  if (clamped !== focusIndex) setFocusIndex(clamped);

  useInput((_input, key) => {
    if (allCards.length === 0) return;
    if (key.downArrow || key.tab) {
      setFocusIndex(i => (i + 1) % allCards.length);
    } else if (key.upArrow) {
      setFocusIndex(i => (i - 1 + allCards.length) % allCards.length);
    } else if (key.return) {
      const card = allCards[clamped];
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
      <Column name="needsYou" cards={columns.needsYou} focusIndex={clamped} offset={offsets.needsYou} onSelect={onSelect} />
      <Column name="inProgress" cards={columns.inProgress} focusIndex={clamped} offset={offsets.inProgress} onSelect={onSelect} />
      <Column name="inReview" cards={columns.inReview} focusIndex={clamped} offset={offsets.inReview} onSelect={onSelect} />
      <Column name="todo" cards={columns.todo} focusIndex={clamped} offset={offsets.todo} onSelect={onSelect} />
    </Box>
  );
}
