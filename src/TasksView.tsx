import React, { useState } from 'react';
import { Text, Box, useInput } from 'ink';
import { parseLaneNotesSections, sanitizeContent } from './fileWatcher.js';
import type { ReviewResult, LaneNotes } from './types.js';

interface Props {
  repo: string;
  issue: number;
  reviews: ReviewResult[];
  notes: LaneNotes | undefined;
}

function verdictColor(verdict: string): string {
  if (verdict === 'Pass') return 'green';
  if (verdict === 'Fail') return 'red';
  if (verdict.startsWith('Pass')) return 'yellow';
  return 'white';
}

export function TasksView({ repo, issue, reviews, notes }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  const clamped = Math.min(focusIndex, Math.max(reviews.length - 1, 0));
  if (clamped !== focusIndex) setFocusIndex(clamped);

  useInput((_input, key) => {
    if (reviews.length === 0) return;
    if (key.downArrow || key.tab) {
      setFocusIndex(i => (i + 1) % reviews.length);
    } else if (key.upArrow) {
      setFocusIndex(i => (i - 1 + reviews.length) % reviews.length);
    } else if (key.return) {
      setExpandedIndex(prev => (prev === clamped ? null : clamped));
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
                <Text>{clamped === i ? '▸' : ' '}</Text>
                <Text bold> {r.reviewer}</Text>
                <Text color={verdictColor(r.verdict)}> {r.verdict}</Text>
                <Text dimColor>  C:{r.critical} I:{r.important}</Text>
              </Text>
              {expandedIndex === i && (
                <Box paddingLeft={2} flexDirection="column">
                  <Text>{sanitizeContent(r.raw)}</Text>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}
      {!notes ? (
        <Text dimColor>Lane notes not yet written</Text>
      ) : (
        <LaneNotesDetail raw={notes.raw} />
      )}
    </Box>
  );
}

function LaneNotesDetail({ raw }: { raw: string }) {
  const s = parseLaneNotesSections(sanitizeContent(raw));
  return (
    <Box flexDirection="column" marginTop={1}>
      {s.goal ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Goal</Text>
          <Text>{s.goal}</Text>
        </Box>
      ) : null}

      {s.plan.length > 0 ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Plan</Text>
          {s.plan.map((item, i) => (
            <Text key={i}>
              <Text color={item.done ? 'green' : 'white'}>{item.done ? '✓' : '○'} </Text>
              <Text dimColor={item.done}>{item.text}</Text>
            </Text>
          ))}
        </Box>
      ) : null}

      {s.blockers ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="red">Blockers</Text>
          <Text color="red">{s.blockers}</Text>
        </Box>
      ) : null}

      {s.decisions ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Decisions</Text>
          <Text>{s.decisions}</Text>
        </Box>
      ) : null}

      {s.changedFiles.length > 0 ? (
        <Box flexDirection="column">
          <Text bold>Changed Files</Text>
          {s.changedFiles.map((f, i) => (
            <Text key={i} dimColor>{f}</Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
