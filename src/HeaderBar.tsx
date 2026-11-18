import React from 'react';
import { Text, Box, useInput } from 'ink';
import { Clickable, Hoverable } from 'ink-use-mouse';
import type { Route } from './useNavigation.js';

interface Props {
  view: Route;
  canGoBack: boolean;
  onBack: () => void;
  onNavigateTo: (route: Route) => void;
}

export function HeaderBar({ view, canGoBack, onBack, onNavigateTo }: Props) {
  useInput((_input, key) => {
    if (key.escape && canGoBack) onBack();
  });

  return (
    <Box>
      <Text bold color="cyan">Alfred — </Text>
      <Clickable onClick={() => onNavigateTo({ type: 'board' })}>
        <Hoverable>
          {(hovered) => (
            <Text bold color={view.type === 'board' ? 'cyan' : hovered ? 'white' : 'gray'} underline={view.type === 'board' || hovered}>Board</Text>
          )}
        </Hoverable>
      </Clickable>
      {view.type === 'tasks' && (
        <>
          <Text bold color="cyan"> — </Text>
          <Text bold color="cyan">{view.repo}#{view.issue}</Text>
        </>
      )}
      {canGoBack && (
        <Clickable onClick={onBack}>
          <Hoverable>
            {(hovered) => (
              <Text dimColor={!hovered} color={hovered ? 'white' : undefined}>  [Esc] Back</Text>
            )}
          </Hoverable>
        </Clickable>
      )}
    </Box>
  );
}
