import React from 'react';
import { Text, Box } from 'ink';
import type { StandupData } from './standup.js';

interface Props {
  data: StandupData | null;
}

export function StandupView({ data }: Props) {
  if (!data) {
    return (
      <Box paddingLeft={1}>
        <Text dimColor>Loading standup data...</Text>
      </Box>
    );
  }

  const hasBlockers = data.blockers.length > 0;
  const hasSections = data.sections.length > 0;

  if (!hasBlockers && !hasSections) {
    return (
      <Box paddingLeft={1}>
        <Text dimColor>No activity since yesterday</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingLeft={1}>
      {hasBlockers && (
        <Box flexDirection="column">
          <Text bold color="red">Blockers</Text>
          {data.blockers.map(b => (
            <Text key={`${b.repo}-${b.issue}`}>
              <Text color="red">  !</Text>
              <Text bold> {b.prefix}</Text>
              <Text dimColor> #{b.issue}</Text>
              <Text>  {b.detail || b.title}</Text>
            </Text>
          ))}
          <Text>{' '}</Text>
        </Box>
      )}
      {data.sections.map(section => (
        <Box key={section.repo} flexDirection="column">
          <Text bold color="cyan">{section.prefix} {section.name}</Text>
          {section.mergedPRs.length > 0 && (
            <Box flexDirection="column">
              <Text dimColor>  Merged PRs:</Text>
              {section.mergedPRs.map(pr => (
                <Text key={pr.number}>    <Text color="green">+</Text> #{pr.number} {pr.title}</Text>
              ))}
            </Box>
          )}
          {section.closedIssues.length > 0 && (
            <Box flexDirection="column">
              <Text dimColor>  Closed issues:</Text>
              {section.closedIssues.map(issue => (
                <Text key={issue.number}>    <Text color="green">+</Text> #{issue.number} {issue.title}</Text>
              ))}
            </Box>
          )}
          {section.commits.length > 0 && (
            <Box flexDirection="column">
              <Text dimColor>  Commits ({section.commits.length}):</Text>
              {section.commits.slice(0, 10).map(c => (
                <Text key={c.sha}>    <Text dimColor>{c.sha.slice(0, 7)}</Text> {c.message}</Text>
              ))}
              {section.commits.length > 10 && (
                <Text dimColor>    ...and {section.commits.length - 10} more</Text>
              )}
            </Box>
          )}
          <Text>{' '}</Text>
        </Box>
      ))}
    </Box>
  );
}
