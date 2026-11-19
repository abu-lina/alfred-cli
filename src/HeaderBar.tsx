import React from 'react';
import { Text, Box, useInput } from 'ink';
import type { Route } from './useNavigation.js';

interface Props {
  view: Route;
  canGoBack: boolean;
  onBack: () => void;
  onNavigateTo: (route: Route) => void;
  projectCount: number;
}

export function HeaderBar({ view, canGoBack, onBack, onNavigateTo, projectCount }: Props) {
  useInput((input, key) => {
    if (key.escape && canGoBack) onBack();
    if (input === '1') onNavigateTo({ type: 'inbox' });
    if (input === '2') onNavigateTo({ type: 'board' });
    if (input === '3') onNavigateTo({ type: 'standup' });
  });

  return (
    <Box>
      <Text bold color="cyan">Alfred — </Text>
      <Text bold color={view.type === 'inbox' ? 'cyan' : 'gray'} underline={view.type === 'inbox'}>Inbox</Text>
      <Text> </Text>
      <Text bold color={view.type === 'board' ? 'cyan' : 'gray'} underline={view.type === 'board'}>Board</Text>
      <Text> </Text>
      <Text bold color={view.type === 'standup' ? 'cyan' : 'gray'} underline={view.type === 'standup'}>Standup</Text>
      {view.type === 'tasks' && (
        <>
          <Text bold color="cyan"> — </Text>
          <Text bold color="cyan">{view.repo}#{view.issue}</Text>
        </>
      )}
      <Text dimColor> ({projectCount} projects)</Text>
      {canGoBack && (
        <Text dimColor>  [Esc] Back</Text>
      )}
    </Box>
  );
}
