import { describe, it, expect, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { loadConfig, saveConfig, validateProject, type Config, type ProjectConfig } from './config.js';

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

  // #13 — hardened coverage

  it('throws when root JSON is an array', () => {
    const p = writeConfig([]);
    expect(() => loadConfig(p)).toThrow(/config must be a json object/i);
  });

  it('throws when root JSON is a primitive string', () => {
    const p = tmpFile();
    dirs.push(join(p, '..'));
    writeFileSync(p, '"string"');
    expect(() => loadConfig(p)).toThrow(/config must be a json object/i);
  });

  it('throws when root JSON is null', () => {
    const p = tmpFile();
    dirs.push(join(p, '..'));
    writeFileSync(p, 'null');
    expect(() => loadConfig(p)).toThrow(/config must be a json object/i);
  });

  it('throws when a project entry is not an object', () => {
    const p = writeConfig({
      projects: ['not-an-object'],
      github: { pollIntervalSeconds: 60 },
    });
    expect(() => loadConfig(p)).toThrow(/projects\[0\] must be an object/i);
  });

  it('throws when pollIntervalSeconds is exactly zero', () => {
    const p = writeConfig({
      projects: [validProject],
      github: { pollIntervalSeconds: 0 },
    });
    expect(() => loadConfig(p)).toThrow(/github\.pollIntervalSeconds.*positive/i);
  });

  it('throws when projects is not an array', () => {
    const p = writeConfig({
      projects: 'oops',
      github: { pollIntervalSeconds: 60 },
    });
    expect(() => loadConfig(p)).toThrow(/projects.*required.*array/i);
  });

  it('throws when github is an array', () => {
    const p = writeConfig({
      projects: [validProject],
      github: [],
    });
    expect(() => loadConfig(p)).toThrow(/github.*required.*object/i);
  });

  it('throws when a project field is an empty string', () => {
    const p = writeConfig({
      projects: [{ ...validProject, name: '' }],
      github: { pollIntervalSeconds: 60 },
    });
    expect(() => loadConfig(p)).toThrow(/projects\[0\]\.name.*required.*non-empty/i);
  });

  it('throws when a project field has wrong type', () => {
    const p = writeConfig({
      projects: [{ ...validProject, name: 123 }],
      github: { pollIntervalSeconds: 60 },
    });
    expect(() => loadConfig(p)).toThrow(/projects\[0\]\.name.*required.*non-empty string/i);
  });

  it('rejects prefix edge cases: single char, three chars, digits', () => {
    for (const prefix of ['A', 'ABC', 'A1']) {
      const p = writeConfig({
        projects: [{ ...validProject, prefix }],
        github: { pollIntervalSeconds: 60 },
      });
      expect(() => loadConfig(p)).toThrow(/projects\[0\]\.prefix.*2 uppercase/i);
    }
  });

  it('rejects repo with multiple slashes', () => {
    const p = writeConfig({
      projects: [{ ...validProject, repo: 'owner/name/extra' }],
      github: { pollIntervalSeconds: 60 },
    });
    expect(() => loadConfig(p)).toThrow(/projects\[0\]\.repo.*owner\/name/i);
  });

  it('silently ignores non-string theme', () => {
    const p = writeConfig({ ...validConfig, theme: 123 });
    const cfg = loadConfig(p);
    expect(cfg.theme).toBeUndefined();
  });

  it('includes correct index in multi-project error messages', () => {
    const p = writeConfig({
      projects: [validProject, { ...validProject, prefix: 'bad' }],
      github: { pollIntervalSeconds: 60 },
    });
    expect(() => loadConfig(p)).toThrow(/projects\[1\]\.prefix.*2 uppercase/i);
  });
});

describe('saveConfig', () => {
  it('writes a valid config file that loadConfig can read back', () => {
    const p = tmpFile();
    dirs.push(join(p, '..'));
    const cfg: Config = {
      projects: [validProject as ProjectConfig],
      github: { pollIntervalSeconds: 60 },
    };
    saveConfig(cfg, p);
    const loaded = loadConfig(p);
    expect(loaded).toEqual(cfg);
  });

  it('creates parent directories if they do not exist', () => {
    const dir = join(tmpdir(), `alfred-test-${randomUUID()}`, 'nested', 'dir');
    const p = join(dir, 'config.json');
    dirs.push(join(tmpdir(), `alfred-test-${p.split('alfred-test-')[1]!.split('/')[0]!}`));
    const cfg: Config = {
      projects: [validProject as ProjectConfig],
      github: { pollIntervalSeconds: 60 },
    };
    saveConfig(cfg, p);
    expect(existsSync(p)).toBe(true);
  });

  it('throws descriptive error on write failure', () => {
    const p = tmpFile();
    dirs.push(join(p, '..'));
    // Write a regular file, then try to saveConfig using it as a directory
    writeFileSync(p, 'block');
    const badPath = join(p, 'nested', 'config.json');
    const cfg: Config = {
      projects: [validProject as ProjectConfig],
      github: { pollIntervalSeconds: 60 },
    };
    expect(() => saveConfig(cfg, badPath)).toThrow(/failed to write config/i);
  });
});

describe('validateProject', () => {
  it('returns no errors for a valid project with no existing prefixes', () => {
    const errors = validateProject(validProject as ProjectConfig, []);
    expect(errors).toEqual([]);
  });

  it('returns error when prefix is duplicate', () => {
    const errors = validateProject(validProject as ProjectConfig, ['MP']);
    expect(errors.some(e => /prefix.*already/i.test(e))).toBe(true);
  });

  it('returns error when prefix is not 2 uppercase letters', () => {
    const errors = validateProject({ ...validProject, prefix: 'mp' } as ProjectConfig, []);
    expect(errors.some(e => /prefix.*2 uppercase/i.test(e))).toBe(true);
  });

  it('returns error when path is not absolute', () => {
    const errors = validateProject({ ...validProject, path: 'relative' } as ProjectConfig, []);
    expect(errors.some(e => /absolute/i.test(e))).toBe(true);
  });

  it('returns error when repo format is invalid', () => {
    const errors = validateProject({ ...validProject, repo: 'noslash' } as ProjectConfig, []);
    expect(errors.some(e => /owner\/name/i.test(e))).toBe(true);
  });

  it('returns multiple errors at once', () => {
    const errors = validateProject(
      { ...validProject, prefix: 'mp', path: 'rel', repo: 'bad' } as ProjectConfig,
      [],
    );
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('returns error when name is empty', () => {
    const errors = validateProject({ ...validProject, name: '' } as ProjectConfig, []);
    expect(errors.some(e => /name.*empty/i.test(e))).toBe(true);
  });

  it('returns error when path is empty', () => {
    const errors = validateProject({ ...validProject, path: '' } as ProjectConfig, []);
    expect(errors.some(e => /path.*empty/i.test(e))).toBe(true);
  });

  it('returns error when repo is empty', () => {
    const errors = validateProject({ ...validProject, repo: '' } as ProjectConfig, []);
    expect(errors.some(e => /repo.*empty/i.test(e))).toBe(true);
  });
});
