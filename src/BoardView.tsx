import React from 'react';
import { Text, Box } from 'ink';
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

function Card({ card }: { card: BoardCard }) {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Text>
        <Text bold color={COLUMN_COLORS[card.column]}>{card.prefix}</Text>
        <Text dimColor> #{card.issue}</Text>
        <Text dimColor> {formatAge(card.since)}</Text>
      </Text>
      <Text wrap="truncate">  {card.title}</Text>
    </Box>
  );
}

function Column({ name, cards }: { name: BoardCard['column']; cards: BoardCard[] }) {
  return (
    <Box flexDirection="column" flexGrow={1} flexBasis={0}>
      <Box paddingLeft={1}>
        <Text bold underline color={COLUMN_COLORS[name]}>{COLUMN_LABELS[name]}</Text>
        <Text dimColor> ({cards.length})</Text>
      </Box>
      {cards.map(c => (
        <Card key={`${c.repo}-${c.issue}`} card={c} />
      ))}
    </Box>
  );
}

export function BoardView({ columns, onSelect: _onSelect }: Props) {
  return (
    <Box flexDirection="row" width="100%">
      <Column name="needsYou" cards={columns.needsYou} />
      <Column name="inProgress" cards={columns.inProgress} />
      <Column name="inReview" cards={columns.inReview} />
      <Column name="todo" cards={columns.todo} />
    </Box>
  );
}
