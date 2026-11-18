import React from 'react';
import { Text, Box, useInput } from 'ink';
import { Clickable } from 'ink-use-mouse';
import type { Route } from './useNavigation.js';

interface Props {
  view: Route;
  canGoBack: boolean;
  onBack: () => void;
  onNavigateTo?: (route: Route) => void;
}

function viewTitle(view: Route): string {
  switch (view.type) {
    case 'board': return 'Board';
    case 'tasks': return `Tasks — ${view.repo}#${view.issue}`;
  }
}

export function HeaderBar({ view, canGoBack, onBack, onNavigateTo }: Props) {
  useInput((_input, key) => {
    if (key.escape && canGoBack) onBack();
  });

  return (
    <Box>
      <Text bold color="cyan">Alfred — </Text>
      {onNavigateTo ? (
        <Clickable onClick={() => onNavigateTo({ type: 'board' })}>
          <Text bold color={view.type === 'board' ? 'cyan' : 'gray'} underline={view.type === 'board'}>Board</Text>
        </Clickable>
      ) : (
        <Text bold color="cyan">{viewTitle(view)}</Text>
      )}
      {view.type === 'tasks' && onNavigateTo && (
        <>
          <Text bold color="cyan"> — </Text>
          <Text bold color="cyan">{view.repo}#{view.issue}</Text>
        </>
      )}
      {canGoBack && (
        <Clickable onClick={onBack}>
          <Text dimColor>  [Esc] Back</Text>
        </Clickable>
      )}
    </Box>
  );
}
