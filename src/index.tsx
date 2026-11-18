#!/usr/bin/env node
import {render, Text, Box} from 'ink';
import React, { useState, useEffect } from 'react';
import meow from 'meow';
import { Init } from './init.js';
import { DEFAULT_CONFIG_PATH, loadConfig } from './config.js';
import { createRefreshManager } from './refresh.js';
import { classifyCards } from './board.js';
import { buildInbox } from './inbox.js';
import { buildStandup, type StandupData } from './standup.js';
import { BoardView } from './BoardView.js';
import { InboxView } from './InboxView.js';
import { HeaderBar } from './HeaderBar.js';
import { TasksView } from './TasksView.js';
import { StandupView } from './StandupView.js';
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
  const [standupData, setStandupData] = useState<StandupData | null>(null);
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

  useEffect(() => {
    if (nav.view.type !== 'standup' || !config) return;
    setStandupData(null);
    buildStandup(config.projects, state).then(setStandupData).catch(() => {
      setStandupData({ blockers: [], sections: [], asOf: Date.now() });
    });
  }, [nav.view.type === 'standup']);

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
  const inboxItems = buildInbox(config.projects, state);
  const tasksRoute = nav.view.type === 'tasks' ? nav.view : null;
  const filesState = tasksRoute
    ? state.files.get(config.projects.find(p => p.repo === tasksRoute.repo)?.path ?? '')
    : undefined;
  const tasksReviews = (filesState?.reviews ?? []).filter(r => tasksRoute && r.issue === tasksRoute.issue);
  const tasksNotes = filesState?.notes.find(n => tasksRoute && n.issue === tasksRoute.issue);

  return (
    <Box flexDirection="column">
      <HeaderBar view={nav.view} canGoBack={nav.canGoBack} onBack={nav.back} onNavigateTo={nav.navigateTo} />
      {nav.view.type === 'inbox' && (
        <InboxView items={inboxItems} onSelect={(item) => nav.push({ type: 'tasks', repo: item.repo, issue: item.issue })} />
      )}
      {nav.view.type === 'board' && (
        <BoardView columns={columns} onSelect={(card) => nav.push({ type: 'tasks', repo: card.repo, issue: card.issue })} />
      )}
      {nav.view.type === 'standup' && (
        <StandupView data={standupData} />
      )}
      {tasksRoute && (
        <TasksView repo={tasksRoute.repo} issue={tasksRoute.issue} reviews={tasksReviews} notes={tasksNotes} />
      )}
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
