import React from 'react';
import { Text, Box } from 'ink';
import { parseLaneNotesSections } from './fileWatcher.js';
import type { LaneNotes } from './types.js';

interface Props {
  repo: string;
  issue: number;
  notes: LaneNotes | undefined;
}

export function TasksView({ repo, issue, notes }: Props) {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Text bold>Tasks — {repo}#{issue}</Text>
      {!notes ? (
        <Text dimColor>Lane notes not yet written</Text>
      ) : (
        <LaneNotesDetail raw={notes.raw} />
      )}
    </Box>
  );
}

function LaneNotesDetail({ raw }: { raw: string }) {
  const s = parseLaneNotesSections(raw);
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
