#!/usr/bin/env node
import {render, Text} from 'ink';
import React from 'react';
import meow from 'meow';
import { Init } from './init.js';
import { DEFAULT_CONFIG_PATH } from './config.js';

const cli = meow(`
  Usage
    $ alf <command>

  Commands
    start    Launch the dashboard TUI
    init     Interactive project setup
    status   One-shot status output

  Options
    --help   Show this help
`, {
  importMeta: import.meta,
});

function App() {
  return <Text>Alfred v0.1.0</Text>;
}

const command = cli.input[0];

if (!command || command === 'start') {
  render(<App />);
} else if (command === 'init') {
  render(<Init configPath={DEFAULT_CONFIG_PATH} />);
} else if (command === 'status') {
  console.log('alf status — not yet implemented');
} else {
  cli.showHelp();
}
