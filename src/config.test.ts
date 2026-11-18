import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';

function tmpFile(): string {
  const dir = join(tmpdir(), `alfred-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return join(dir, 'config.json');
}

const dirs: string[] = [];

function writeConfig(data: unknown): string {
  const p = tmpFile();
  dirs.push(join(p, '..'));
  writeFileSync(p, JSON.stringify(data));
  return p;
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

const validProject = {
  name: 'My Project',
  prefix: 'MP',
  path: '/home/user/projects/my-project',
  repo: 'owner/my-project',
  rexSession: 'my-project-foreman',
};

const validConfig = {
  projects: [validProject],
  github: { pollIntervalSeconds: 60 },
};

describe('loadConfig', () => {
  it('returns a valid config', () => {
    const p = writeConfig(validConfig);
    const cfg = loadConfig(p);
    expect(cfg.projects).toHaveLength(1);
    expect(cfg.projects[0].prefix).toBe('MP');
    expect(cfg.github.pollIntervalSeconds).toBe(60);
    expect(cfg.theme).toBeUndefined();
  });

  it('accepts optional theme field', () => {
    const p = writeConfig({ ...validConfig, theme: 'dark' });
    const cfg = loadConfig(p);
    expect(cfg.theme).toBe('dark');
  });

  it('throws on missing file', () => {
    expect(() => loadConfig('/nonexistent/config.json')).toThrow(
      /config file not found/i,
    );
  });

  it('throws on invalid JSON', () => {
    const p = tmpFile();
    dirs.push(join(p, '..'));
    writeFileSync(p, '{not json}');
    expect(() => loadConfig(p)).toThrow(/invalid json/i);
  });

  it('throws when projects is missing', () => {
    const p = writeConfig({ github: { pollIntervalSeconds: 60 } });
    expect(() => loadConfig(p)).toThrow(/projects.*required/i);
  });

  it('throws when projects is empty', () => {
    const p = writeConfig({ projects: [], github: { pollIntervalSeconds: 60 } });
    expect(() => loadConfig(p)).toThrow(/projects.*at least one/i);
  });

  it('throws when a project field is missing', () => {
    const p = writeConfig({
      projects: [{ name: 'X' }],
      github: { pollIntervalSeconds: 60 },
    });
    expect(() => loadConfig(p)).toThrow(/projects\[0\]\.prefix.*required/i);
  });

  it('throws when prefix is not 2 uppercase letters', () => {
    const p = writeConfig({
      projects: [{ ...validProject, prefix: 'mp' }],
      github: { pollIntervalSeconds: 60 },
    });
    expect(() => loadConfig(p)).toThrow(/projects\[0\]\.prefix.*2 uppercase/i);
  });

  it('throws when github section is missing', () => {
    const p = writeConfig({ projects: [validProject] });
    expect(() => loadConfig(p)).toThrow(/github.*required/i);
  });

  it('throws when pollIntervalSeconds is missing', () => {
    const p = writeConfig({ projects: [validProject], github: {} });
    expect(() => loadConfig(p)).toThrow(/github\.pollIntervalSeconds.*required/i);
  });

  it('throws when pollIntervalSeconds is not a positive number', () => {
    const p = writeConfig({
      projects: [validProject],
      github: { pollIntervalSeconds: -1 },
    });
    expect(() => loadConfig(p)).toThrow(/github\.pollIntervalSeconds.*positive/i);
  });

  it('throws when path is not absolute', () => {
    const p = writeConfig({
      projects: [{ ...validProject, path: 'relative/path' }],
      github: { pollIntervalSeconds: 60 },
    });
    expect(() => loadConfig(p)).toThrow(/projects\[0\]\.path.*absolute/i);
  });

  it('throws when repo format is invalid', () => {
    const p = writeConfig({
      projects: [{ ...validProject, repo: 'noslash' }],
      github: { pollIntervalSeconds: 60 },
    });
    expect(() => loadConfig(p)).toThrow(/projects\[0\]\.repo.*owner\/name/i);
  });
});
