import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { join } from 'node:path';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';

const DELAY = 50;
const wait = (ms = DELAY) => new Promise(r => setTimeout(r, ms));

const dirs: string[] = [];

function tmpDir(): string {
  const d = join(tmpdir(), `alfred-init-${randomUUID()}`);
  mkdirSync(d, { recursive: true });
  dirs.push(d);
  return d;
}

function writeExistingConfig(configPath: string, projects = [
  { name: 'old', prefix: 'OL', path: '/tmp/old', repo: 'o/old', rexSession: 'old-foreman' },
]) {
  writeFileSync(configPath, JSON.stringify({
    projects,
    github: { pollIntervalSeconds: 60 },
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

async function importInit() {
  return import('./init.js');
}

describe('Init component', () => {
  it('shows welcome message on start', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    const inst = render(<Init configPath={configPath} />);
    await wait();
    expect(inst.lastFrame()).toContain('Alfred CLI Setup');
    inst.unmount();
  });

  it('prompts for project name first', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    const inst = render(<Init configPath={configPath} />);
    await wait();
    expect(inst.lastFrame()).toContain('Project name');
    inst.unmount();
  });

  it('walks through all fields and writes config', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    const inst = render(<Init configPath={configPath} />);
    await wait();

    // Type project name
    inst.stdin.write('myproject');
    await wait();
    inst.stdin.write('\r');
    await wait();

    // Type prefix
    inst.stdin.write('MP');
    await wait();
    inst.stdin.write('\r');
    await wait();

    // Type path
    inst.stdin.write('/tmp/myproject');
    await wait();
    inst.stdin.write('\r');
    await wait();

    // Type repo
    inst.stdin.write('owner/myproject');
    await wait();
    inst.stdin.write('\r');
    await wait();

    // Type rex session
    inst.stdin.write('myproject-foreman');
    await wait();
    inst.stdin.write('\r');
    await wait();

    // Should ask to add another — say no
    expect(inst.lastFrame()).toContain('Add another');
    inst.stdin.write('n');
    await wait();

    // Should write config and show done
    expect(inst.lastFrame()).toContain('Config saved');

    const cfg = loadConfig(configPath);
    expect(cfg.projects).toHaveLength(1);
    expect(cfg.projects[0]!.name).toBe('myproject');
    expect(cfg.projects[0]!.prefix).toBe('MP');
    expect(cfg.github.pollIntervalSeconds).toBe(60);
    inst.unmount();
  });

  it('shows validation error for bad prefix and lets user retry', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    const inst = render(<Init configPath={configPath} />);
    await wait();

    // Name
    inst.stdin.write('test');
    await wait();
    inst.stdin.write('\r');
    await wait();

    // Bad prefix (lowercase)
    inst.stdin.write('mp');
    await wait();
    inst.stdin.write('\r');
    await wait();

    expect(inst.lastFrame()).toContain('2 uppercase');

    // Correct prefix
    inst.stdin.write('MP');
    await wait();
    inst.stdin.write('\r');
    await wait();

    // Continue with valid data
    inst.stdin.write('/tmp/test');
    await wait();
    inst.stdin.write('\r');
    await wait();

    inst.stdin.write('owner/test');
    await wait();
    inst.stdin.write('\r');
    await wait();

    inst.stdin.write('test-foreman');
    await wait();
    inst.stdin.write('\r');
    await wait();

    inst.stdin.write('n');
    await wait();

    expect(inst.lastFrame()).toContain('Config saved');
    inst.unmount();
  });

  it('allows adding multiple projects', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    const inst = render(<Init configPath={configPath} />);
    await wait();

    // First project
    inst.stdin.write('proj1');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('AA');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('/tmp/proj1');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('owner/proj1');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('proj1-foreman');
    await wait();
    inst.stdin.write('\r');
    await wait();

    // Add another — yes
    inst.stdin.write('y');
    await wait();

    // Second project
    inst.stdin.write('proj2');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('BB');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('/tmp/proj2');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('owner/proj2');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('proj2-foreman');
    await wait();
    inst.stdin.write('\r');
    await wait();

    // No more
    inst.stdin.write('n');
    await wait();

    const cfg = loadConfig(configPath);
    expect(cfg.projects).toHaveLength(2);
    expect(cfg.projects[0]!.prefix).toBe('AA');
    expect(cfg.projects[1]!.prefix).toBe('BB');
    inst.unmount();
  });

  it('asks to overwrite when config already exists', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    writeExistingConfig(configPath);

    const inst = render(<Init configPath={configPath} />);
    await wait();

    expect(inst.lastFrame()).toContain('already exists');
    inst.unmount();
  });

  it('shows Edit option when config exists', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    writeExistingConfig(configPath);

    const inst = render(<Init configPath={configPath} />);
    await wait();

    expect(inst.lastFrame()).toContain('[e] Edit');
    inst.unmount();
  });

  it('edit mode pre-fills fields from existing config', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    writeExistingConfig(configPath);

    const inst = render(<Init configPath={configPath} />);
    await wait();

    // Press 'e' to edit
    inst.stdin.write('e');
    await wait();

    // Should show the form with the first field pre-filled
    expect(inst.lastFrame()).toContain('Editing project: old');
    expect(inst.lastFrame()).toContain('old');
    inst.unmount();
  });

  it('edit mode preserves unchanged fields on Enter', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    writeExistingConfig(configPath);

    const inst = render(<Init configPath={configPath} />);
    await wait();

    // Press 'e' to edit
    inst.stdin.write('e');
    await wait();

    // Accept all existing fields by pressing Enter
    inst.stdin.write('\r'); // name: old
    await wait();
    inst.stdin.write('\r'); // prefix: OL
    await wait();
    inst.stdin.write('\r'); // path: /tmp/old
    await wait();
    inst.stdin.write('\r'); // repo: o/old
    await wait();
    inst.stdin.write('\r'); // rexSession: old-foreman
    await wait();

    // Should ask to add another — say no
    expect(inst.lastFrame()).toContain('Add another');
    inst.stdin.write('n');
    await wait();

    expect(inst.lastFrame()).toContain('Config saved');
    const cfg = loadConfig(configPath);
    expect(cfg.projects).toHaveLength(1);
    expect(cfg.projects[0]!.name).toBe('old');
    expect(cfg.projects[0]!.prefix).toBe('OL');
    expect(cfg.projects[0]!.path).toBe('/tmp/old');
    expect(cfg.projects[0]!.repo).toBe('o/old');
    expect(cfg.projects[0]!.rexSession).toBe('old-foreman');
    inst.unmount();
  });

  it('edit mode allows modifying individual fields', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    writeExistingConfig(configPath);

    const inst = render(<Init configPath={configPath} />);
    await wait();

    // Press 'e' to edit
    inst.stdin.write('e');
    await wait();

    // Clear the pre-filled name and type a new one
    // Need to backspace the existing "old" (3 chars) and type "newname"
    inst.stdin.write('\x7f'); // backspace
    await wait();
    inst.stdin.write('\x7f');
    await wait();
    inst.stdin.write('\x7f');
    await wait();
    inst.stdin.write('newname');
    await wait();
    inst.stdin.write('\r');
    await wait();

    // Accept remaining fields
    inst.stdin.write('\r'); // prefix: OL
    await wait();
    inst.stdin.write('\r'); // path: /tmp/old
    await wait();
    inst.stdin.write('\r'); // repo: o/old
    await wait();
    inst.stdin.write('\r'); // rexSession: old-foreman
    await wait();

    expect(inst.lastFrame()).toContain('Add another');
    inst.stdin.write('n');
    await wait();

    expect(inst.lastFrame()).toContain('Config saved');
    const cfg = loadConfig(configPath);
    expect(cfg.projects[0]!.name).toBe('newname');
    // Unchanged fields preserved
    expect(cfg.projects[0]!.prefix).toBe('OL');
    expect(cfg.projects[0]!.path).toBe('/tmp/old');
    expect(cfg.projects[0]!.repo).toBe('o/old');
    expect(cfg.projects[0]!.rexSession).toBe('old-foreman');
    inst.unmount();
  });

  it('edit mode validates modified fields', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    writeExistingConfig(configPath);

    const inst = render(<Init configPath={configPath} />);
    await wait();

    inst.stdin.write('e');
    await wait();

    // Accept name
    inst.stdin.write('\r');
    await wait();

    // Try to change prefix to invalid value
    inst.stdin.write('\x7f');
    await wait();
    inst.stdin.write('\x7f');
    await wait();
    inst.stdin.write('zz');
    await wait();
    inst.stdin.write('\r');
    await wait();

    expect(inst.lastFrame()).toContain('2 uppercase');

    // Fix it
    inst.stdin.write('ZZ');
    await wait();
    inst.stdin.write('\r');
    await wait();

    // Accept remaining fields
    inst.stdin.write('\r'); // path
    await wait();
    inst.stdin.write('\r'); // repo
    await wait();
    inst.stdin.write('\r'); // rexSession
    await wait();

    inst.stdin.write('n');
    await wait();

    expect(inst.lastFrame()).toContain('Config saved');
    const cfg = loadConfig(configPath);
    expect(cfg.projects[0]!.prefix).toBe('ZZ');
    inst.unmount();
  });

  it('edit mode handles multiple existing projects', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    writeExistingConfig(configPath, [
      { name: 'alpha', prefix: 'AA', path: '/tmp/alpha', repo: 'o/alpha', rexSession: 'alpha-f' },
      { name: 'beta', prefix: 'BB', path: '/tmp/beta', repo: 'o/beta', rexSession: 'beta-f' },
    ]);

    const inst = render(<Init configPath={configPath} />);
    await wait();

    inst.stdin.write('e');
    await wait();

    // Accept all fields of first project
    expect(inst.lastFrame()).toContain('Editing project: alpha');
    inst.stdin.write('\r'); // name
    await wait();
    inst.stdin.write('\r'); // prefix
    await wait();
    inst.stdin.write('\r'); // path
    await wait();
    inst.stdin.write('\r'); // repo
    await wait();
    inst.stdin.write('\r'); // rexSession
    await wait();

    // Should move to second project
    expect(inst.lastFrame()).toContain('Editing project: beta');
    inst.stdin.write('\r'); // name
    await wait();
    inst.stdin.write('\r'); // prefix
    await wait();
    inst.stdin.write('\r'); // path
    await wait();
    inst.stdin.write('\r'); // repo
    await wait();
    inst.stdin.write('\r'); // rexSession
    await wait();

    expect(inst.lastFrame()).toContain('Add another');
    inst.stdin.write('n');
    await wait();

    expect(inst.lastFrame()).toContain('Config saved');
    const cfg = loadConfig(configPath);
    expect(cfg.projects).toHaveLength(2);
    expect(cfg.projects[0]!.name).toBe('alpha');
    expect(cfg.projects[1]!.name).toBe('beta');
    inst.unmount();
  });

  it('cancel flow exits without modifying config when user presses c', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    writeExistingConfig(configPath);
    const originalContent = require('node:fs').readFileSync(configPath, 'utf-8');

    const inst = render(<Init configPath={configPath} />);
    await wait();

    expect(inst.lastFrame()).toContain('already exists');

    // Press 'c' to cancel
    inst.stdin.write('c');
    await wait();

    // Component exits to 'done' phase — original config untouched
    const afterContent = require('node:fs').readFileSync(configPath, 'utf-8');
    expect(afterContent).toBe(originalContent);
    inst.unmount();
  });

  it('shows error when submitting empty project name', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    const inst = render(<Init configPath={configPath} />);
    await wait();

    // Submit empty name
    inst.stdin.write('\r');
    await wait();

    expect(inst.lastFrame()).toContain('cannot be empty');
    inst.unmount();
  });

  it('shows error when submitting empty prefix', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    const inst = render(<Init configPath={configPath} />);
    await wait();

    // Fill name, then submit empty prefix
    inst.stdin.write('test');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('\r'); // empty prefix
    await wait();

    expect(inst.lastFrame()).toContain('cannot be empty');
    inst.unmount();
  });

  it('rejects relative path at component level', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    const inst = render(<Init configPath={configPath} />);
    await wait();

    // Name
    inst.stdin.write('test');
    await wait();
    inst.stdin.write('\r');
    await wait();

    // Prefix
    inst.stdin.write('TP');
    await wait();
    inst.stdin.write('\r');
    await wait();

    // Relative path
    inst.stdin.write('relative/path');
    await wait();
    inst.stdin.write('\r');
    await wait();

    expect(inst.lastFrame()).toContain('absolute path');
    inst.unmount();
  });

  it('rejects bad repo format at component level', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    const inst = render(<Init configPath={configPath} />);
    await wait();

    // Name
    inst.stdin.write('test');
    await wait();
    inst.stdin.write('\r');
    await wait();

    // Prefix
    inst.stdin.write('TP');
    await wait();
    inst.stdin.write('\r');
    await wait();

    // Path
    inst.stdin.write('/tmp/test');
    await wait();
    inst.stdin.write('\r');
    await wait();

    // Bad repo
    inst.stdin.write('noslash');
    await wait();
    inst.stdin.write('\r');
    await wait();

    expect(inst.lastFrame()).toContain('owner/name');
    inst.unmount();
  });

  it('rejects duplicate prefix when adding second project', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    const inst = render(<Init configPath={configPath} />);
    await wait();

    // First project
    inst.stdin.write('proj1');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('AA');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('/tmp/proj1');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('owner/proj1');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('proj1-foreman');
    await wait();
    inst.stdin.write('\r');
    await wait();

    // Add another
    inst.stdin.write('y');
    await wait();

    // Second project with duplicate prefix
    inst.stdin.write('proj2');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('AA');
    await wait();
    inst.stdin.write('\r');
    await wait();

    expect(inst.lastFrame()).toContain('already in use');
    inst.unmount();
  });
  it('edit mode preserves pollIntervalSeconds and theme from existing config', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    // Write config with custom pollInterval and theme
    writeFileSync(configPath, JSON.stringify({
      projects: [
        { name: 'proj', prefix: 'PJ', path: '/tmp/proj', repo: 'o/proj', rexSession: 'proj-f' },
      ],
      github: { pollIntervalSeconds: 120 },
      theme: 'dark',
    }));

    const inst = render(<Init configPath={configPath} />);
    await wait();

    // Press 'e' to edit
    inst.stdin.write('e');
    await wait();

    // Accept all fields unchanged
    inst.stdin.write('\r'); // name
    await wait();
    inst.stdin.write('\r'); // prefix
    await wait();
    inst.stdin.write('\r'); // path
    await wait();
    inst.stdin.write('\r'); // repo
    await wait();
    inst.stdin.write('\r'); // rexSession
    await wait();

    // No more projects
    inst.stdin.write('n');
    await wait();

    expect(inst.lastFrame()).toContain('Config saved');
    const cfg = loadConfig(configPath);
    expect(cfg.github.pollIntervalSeconds).toBe(120);
    expect(cfg.theme).toBe('dark');
    inst.unmount();
  });

  it('overwrite mode writes fresh defaults without loaded config', async () => {
    const { Init } = await importInit();
    const dir = tmpDir();
    const configPath = join(dir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      projects: [
        { name: 'old', prefix: 'OL', path: '/tmp/old', repo: 'o/old', rexSession: 'old-f' },
      ],
      github: { pollIntervalSeconds: 120 },
      theme: 'dark',
    }));

    const inst = render(<Init configPath={configPath} />);
    await wait();

    // Press 'o' to overwrite
    inst.stdin.write('o');
    await wait();

    // Fill in a new project from scratch
    inst.stdin.write('fresh');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('FR');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('/tmp/fresh');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('o/fresh');
    await wait();
    inst.stdin.write('\r');
    await wait();
    inst.stdin.write('fresh-f');
    await wait();
    inst.stdin.write('\r');
    await wait();

    inst.stdin.write('n');
    await wait();

    expect(inst.lastFrame()).toContain('Config saved');
    const cfg = loadConfig(configPath);
    expect(cfg.github.pollIntervalSeconds).toBe(60);
    expect(cfg.theme).toBeUndefined();
    inst.unmount();
  });
});
