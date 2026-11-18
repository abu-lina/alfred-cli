#!/usr/bin/env node
import {render, Text, Box} from 'ink';
import React, { useState, useEffect } from 'react';
import meow from 'meow';
import { Init } from './init.js';
import { DEFAULT_CONFIG_PATH, loadConfig } from './config.js';
import { createRefreshManager } from './refresh.js';
import { classifyCards } from './board.js';
import { BoardView } from './BoardView.js';
import type { RefreshState } from './types.js';
import { emptyRefreshState } from './types.js';

const cli = meow(`
  Usage
    $ alf <command>

  Commands
    start    Launch the dashboard TUI (default)
    board    Show the Kanban board view
    init     Interactive project setup
    status   One-shot status output

  Options
    --help   Show this help
`, {
  importMeta: import.meta,
});

function App() {
  const [state, setState] = useState<RefreshState>(emptyRefreshState());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let config;
    try {
      config = loadConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    const mgr = createRefreshManager(config, setState);
    return () => mgr.stop();
  }, []);

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Run `alf init` to set up your config.</Text>
      </Box>
    );
  }

  let config;
  try {
    config = loadConfig();
  } catch {
    return <Text>Loading...</Text>;
  }

  const columns = classifyCards(config.projects, state);
  return (
    <Box flexDirection="column">
      <Text bold color="cyan">Alfred — Board</Text>
      <BoardView columns={columns} onSelect={() => {}} />
    </Box>
  );
}

const command = cli.input[0];

if (!command || command === 'start' || command === 'board') {
  render(<App />);
} else if (command === 'init') {
  render(<Init configPath={DEFAULT_CONFIG_PATH} />);
} else if (command === 'status') {
  console.log('alf status — not yet implemented');
} else {
  cli.showHelp();
}
