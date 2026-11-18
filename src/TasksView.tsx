import React, { useState } from 'react';
import { Text, Box, useInput } from 'ink';
import type { ReviewResult } from './types.js';

interface Props {
  repo: string;
  issue: number;
  reviews: ReviewResult[];
}

function verdictColor(verdict: string): string {
  if (verdict === 'Pass') return 'green';
  if (verdict === 'Fail') return 'red';
  if (verdict.startsWith('Pass')) return 'yellow';
  return 'white';
}

export function TasksView({ repo, issue, reviews }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  useInput((_input, key) => {
    if (reviews.length === 0) return;
    if (key.downArrow || key.tab) {
      setFocusIndex(i => (i + 1) % reviews.length);
    } else if (key.upArrow) {
      setFocusIndex(i => (i - 1 + reviews.length) % reviews.length);
    } else if (key.return) {
      setExpandedIndex(prev => (prev === focusIndex ? null : focusIndex));
    }
  });

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Text bold>Tasks — {repo}#{issue}</Text>
      {reviews.length === 0 ? (
        <Text dimColor>No reviews yet</Text>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Text bold underline>Reviews</Text>
          {reviews.map((r, i) => (
            <Box key={r.reviewer} flexDirection="column">
              <Text>
                <Text>{focusIndex === i ? '▸' : ' '}</Text>
                <Text bold> {r.reviewer}</Text>
                <Text color={verdictColor(r.verdict)}> {r.verdict}</Text>
                <Text dimColor>  C:{r.critical} I:{r.important}</Text>
              </Text>
              {expandedIndex === i && (
                <Box paddingLeft={2} flexDirection="column">
                  <Text>{r.raw}</Text>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
