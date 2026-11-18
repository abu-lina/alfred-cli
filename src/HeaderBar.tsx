import React from 'react';
import { Text, Box, useInput } from 'ink';
import type { Route } from './useNavigation.js';

interface Props {
  view: Route;
  canGoBack: boolean;
  onBack: () => void;
}

function viewTitle(view: Route): string {
  switch (view.type) {
    case 'board': return 'Board';
    case 'tasks': return `Tasks — ${view.repo}#${view.issue}`;
  }
}

export function HeaderBar({ view, canGoBack, onBack }: Props) {
  useInput((_input, key) => {
    if (key.escape && canGoBack) onBack();
  });

  return (
    <Box>
      <Text bold color="cyan">Alfred — {viewTitle(view)}</Text>
      {canGoBack && <Text dimColor>  [Esc] Back</Text>}
    </Box>
  );
}
