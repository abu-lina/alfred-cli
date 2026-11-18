#!/usr/bin/env node
import {render, Text, Box} from 'ink';
import React, { useState, useEffect } from 'react';
import meow from 'meow';
import { Init } from './init.js';
import { DEFAULT_CONFIG_PATH, loadConfig } from './config.js';
import { createRefreshManager } from './refresh.js';
import { classifyCards } from './board.js';
import { BoardView } from './BoardView.js';
import { HeaderBar } from './HeaderBar.js';
import { TasksView } from './TasksView.js';
import { useNavigation } from './useNavigation.js';
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
  const [config, setConfig] = useState<import('./config.js').Config | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigation();

  useEffect(() => {
    let cfg;
    try {
      cfg = loadConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    setConfig(cfg);
    const mgr = createRefreshManager(cfg, setState);
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

  if (!config) return <Text>Loading...</Text>;

  const columns = classifyCards(config.projects, state);
  return (
    <Box flexDirection="column">
      <HeaderBar view={nav.view} canGoBack={nav.canGoBack} onBack={nav.back} onNavigateTo={nav.navigateTo} />
      {nav.view.type === 'board' && (
        <BoardView columns={columns} onSelect={(card) => nav.push({ type: 'tasks', repo: card.repo, issue: card.issue })} />
      )}
      {nav.view.type === 'tasks' && (() => {
        const tasksRoute = nav.view;
        const filesState = state.files.get(
          config.projects.find(p => p.repo === tasksRoute.repo)?.path ?? '',
        );
        const reviews = (filesState?.reviews ?? []).filter(r => r.issue === tasksRoute.issue);
        return (
          <TasksView repo={tasksRoute.repo} issue={tasksRoute.issue} reviews={reviews} />
        );
      })()}
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
