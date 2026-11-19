#!/usr/bin/env node
import {render, Text, Box, useStdout} from 'ink';
import React, { useState, useEffect } from 'react';
import { existsSync } from 'node:fs';
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
import { MouseProvider } from './MouseProvider.js';
import type { RefreshState } from './types.js';
import { emptyRefreshState } from './types.js';

const cli = meow(`
  Usage
    $ alf <command>

  Commands
    start    Launch the dashboard TUI (default)
    init     Interactive project setup
    status   One-shot status output

  Options
    --help   Show this help
`, {
  importMeta: import.meta,
});

function App({ config }: { config: import('./config.js').Config }) {
  const [state, setState] = useState<RefreshState>(emptyRefreshState());
  const [standupData, setStandupData] = useState<StandupData | null>(null);
  const nav = useNavigation();
  const { stdout } = useStdout();
  const [rows, setRows] = useState(stdout.rows);

  useEffect(() => {
    const onResize = () => setRows(stdout.rows);
    stdout.on('resize', onResize);
    return () => { stdout.off('resize', onResize); };
  }, [stdout]);

  useEffect(() => {
    const mgr = createRefreshManager(config, setState);
    return () => mgr.stop();
  }, [config]);

  useEffect(() => {
    if (nav.view.type !== 'standup') return;
    setStandupData(null);
    buildStandup(config.projects, state).then(setStandupData).catch(() => {
      setStandupData({ blockers: [], sections: [], asOf: Date.now() });
    });
  }, [nav.view.type === 'standup']);

  const columns = classifyCards(config.projects, state);
  const inboxItems = buildInbox(config.projects, state);
  const tasksRoute = nav.view.type === 'tasks' ? nav.view : null;
  const filesState = tasksRoute
    ? state.files.get(config.projects.find(p => p.repo === tasksRoute.repo)?.path ?? '')
    : undefined;
  const tasksReviews = (filesState?.reviews ?? []).filter(r => tasksRoute && r.issue === tasksRoute.issue);
  const tasksNotes = filesState?.notes.find(n => tasksRoute && n.issue === tasksRoute.issue);

  return (
    <MouseProvider>
    {/* Clip to rows - 1 so the header never scrolls off row 1 (Clickable assumes it's there); Ink appends a trailing newline */}
    <Box flexDirection="column" height={rows ? rows - 1 : undefined} overflow="hidden">
    {/* flexShrink 0: otherwise Yoga squeezes children to fit the clip and their text overlaps */}
    <Box flexDirection="column" flexShrink={0}>
      <HeaderBar view={nav.view} canGoBack={nav.canGoBack} onBack={nav.back} onNavigateTo={nav.navigateTo} projectCount={config.projects.length} />
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
    </Box>
    </MouseProvider>
  );
}

const command = cli.input[0];

if (!command || command === 'start') {
  if (!existsSync(DEFAULT_CONFIG_PATH)) {
    console.error("Run 'alf init' first");
    process.exit(1);
  }
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
  // Alternate screen pins Ink's output to row 1 for mouse hit-testing; must precede the first frame
  const altScreen = process.stdout.isTTY;
  const leaveAltScreen = () => { if (altScreen) process.stdout.write('\x1b[?1049l'); };
  if (altScreen) process.stdout.write('\x1b[?1049h\x1b[H');
  process.on('exit', leaveAltScreen);
  // Crashes outside React (refresh manager async code) would print on the alt screen and vanish; Node routes unhandled rejections here too
  process.on('uncaughtException', (err) => {
    leaveAltScreen();
    console.error(err);
    process.exit(1);
  });
  render(<App config={config} />).waitUntilExit().catch((err) => {
    // Ink drew the error on the alt screen, which is about to vanish; reprint it on the primary screen
    leaveAltScreen();
    console.error(err);
    process.exitCode = 1;
  });
} else if (command === 'init') {
  render(<Init configPath={DEFAULT_CONFIG_PATH} />);
} else if (command === 'status') {
  console.log('alf status — not yet implemented');
} else {
  cli.showHelp();
}
