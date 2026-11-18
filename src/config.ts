import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ProjectConfig {
  name: string;
  prefix: string;
  path: string;
  repo: string;
  rexSession: string;
}

export interface Config {
  projects: ProjectConfig[];
  github: {
    pollIntervalSeconds: number;
  };
  theme?: string;
}

const PROJECT_FIELDS = ['name', 'prefix', 'path', 'repo', 'rexSession'] as const;

export const DEFAULT_CONFIG_PATH = join(
  process.env['XDG_CONFIG_HOME'] ?? join(process.env['HOME'] ?? '', '.config'),
  'alfred-cli',
  'config.json',
);

export function loadConfig(filePath: string = DEFAULT_CONFIG_PATH): Config {
  if (!existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    throw new Error(`Invalid JSON in config file: ${filePath}`);
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Config must be a JSON object');
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj['projects'])) {
    throw new Error('"projects" is required and must be an array');
  }
  if (obj['projects'].length === 0) {
    throw new Error('"projects" must contain at least one project');
  }

  const projects = obj['projects'].map((p: unknown, i: number) => {
    if (typeof p !== 'object' || p === null) {
      throw new Error(`projects[${i}] must be an object`);
    }
    const proj = p as Record<string, unknown>;

    for (const field of PROJECT_FIELDS) {
      if (typeof proj[field] !== 'string' || proj[field] === '') {
        throw new Error(`projects[${i}].${field} is required and must be a non-empty string`);
      }
    }

    if (!/^[A-Z]{2}$/.test(proj['prefix'] as string)) {
      throw new Error(`projects[${i}].prefix must be 2 uppercase letters`);
    }

    if (!(proj['path'] as string).startsWith('/')) {
      throw new Error(`projects[${i}].path must be an absolute path`);
    }

    if (!(/^[^/]+\/[^/]+$/.test(proj['repo'] as string))) {
      throw new Error(`projects[${i}].repo must be in owner/name format`);
    }

    return {
      name: proj['name'] as string,
      prefix: proj['prefix'] as string,
      path: proj['path'] as string,
      repo: proj['repo'] as string,
      rexSession: proj['rexSession'] as string,
    };
  });

  if (typeof obj['github'] !== 'object' || obj['github'] === null || Array.isArray(obj['github'])) {
    throw new Error('"github" is required and must be an object');
  }
  const gh = obj['github'] as Record<string, unknown>;

  if (typeof gh['pollIntervalSeconds'] !== 'number') {
    throw new Error('"github.pollIntervalSeconds" is required and must be a number');
  }
  if (gh['pollIntervalSeconds'] <= 0) {
    throw new Error('"github.pollIntervalSeconds" must be a positive number');
  }

  const theme = typeof obj['theme'] === 'string' ? obj['theme'] : undefined;

  return {
    projects,
    github: { pollIntervalSeconds: gh['pollIntervalSeconds'] },
    theme,
  };
}
