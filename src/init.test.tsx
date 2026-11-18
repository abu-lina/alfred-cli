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
    writeFileSync(configPath, JSON.stringify({
      projects: [{ name: 'old', prefix: 'OL', path: '/tmp/old', repo: 'o/old', rexSession: 'old' }],
      github: { pollIntervalSeconds: 60 },
    }));

    const inst = render(<Init configPath={configPath} />);
    await wait();

    expect(inst.lastFrame()).toContain('already exists');
    inst.unmount();
  });
});
