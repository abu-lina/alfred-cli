import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ProjectConfig } from './config.js';
import type { RefreshState } from './types.js';
import { buildInbox, type InboxItem } from './inbox.js';

const execFileAsync = promisify(execFile);

export interface StandupPR {
  number: number;
  title: string;
  mergedAt: string;
}

export interface StandupIssue {
  number: number;
  title: string;
  closedAt: string;
}

export interface StandupCommit {
  sha: string;
  message: string;
  date: string;
}

export interface StandupSection {
  prefix: string;
  name: string;
  repo: string;
  mergedPRs: StandupPR[];
  closedIssues: StandupIssue[];
  commits: StandupCommit[];
}

export interface StandupData {
  blockers: InboxItem[];
  sections: StandupSection[];
  asOf: number;
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function fetchMergedPRs(repo: string, since: string): Promise<StandupPR[]> {
  try {
    const { stdout } = await execFileAsync(
      'gh',
      ['pr', 'list', '--repo', repo, '--state', 'merged', '--json', 'number,title,mergedAt',
       '--search', `merged:>=${since}`, '--limit', '50'],
      { encoding: 'utf-8', timeout: 30_000 },
    );
    const raw: { number: number; title: string; mergedAt: string }[] = JSON.parse(stdout);
    return raw.map(pr => ({ number: pr.number, title: pr.title, mergedAt: pr.mergedAt }));
  } catch {
    return [];
  }
}

export async function fetchClosedIssues(repo: string, since: string): Promise<StandupIssue[]> {
  try {
    const { stdout } = await execFileAsync(
      'gh',
      ['issue', 'list', '--repo', repo, '--state', 'closed', '--json', 'number,title,closedAt',
       '--search', `closed:>=${since}`, '--limit', '50'],
      { encoding: 'utf-8', timeout: 30_000 },
    );
    const raw: { number: number; title: string; closedAt: string }[] = JSON.parse(stdout);
    return raw.map(i => ({ number: i.number, title: i.title, closedAt: i.closedAt }));
  } catch {
    return [];
  }
}

export async function fetchCommits(projectPath: string, since: string): Promise<StandupCommit[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['log', '--since', since, '--format=%H%x00%s%x00%aI', '--all'],
      { encoding: 'utf-8', timeout: 15_000, cwd: projectPath },
    );
    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [sha, message, date] = line.split('\0', 3);
        return { sha: sha!, message: message!, date: date! };
      });
  } catch {
    return [];
  }
}

export async function buildStandup(
  projects: ProjectConfig[],
  state: RefreshState,
): Promise<StandupData> {
  const since = yesterday();
  const blockers = buildInbox(projects, state).filter(i => i.reason === 'Blocked');

  const sections: StandupSection[] = [];

  const results = await Promise.all(
    projects.map(async (project) => {
      const [mergedPRs, closedIssues, commits] = await Promise.all([
        fetchMergedPRs(project.repo, since),
        fetchClosedIssues(project.repo, since),
        fetchCommits(project.path, since),
      ]);
      return { project, mergedPRs, closedIssues, commits };
    }),
  );

  for (const { project, mergedPRs, closedIssues, commits } of results) {
    if (mergedPRs.length === 0 && closedIssues.length === 0 && commits.length === 0) continue;
    sections.push({
      prefix: project.prefix,
      name: project.name,
      repo: project.repo,
      mergedPRs,
      closedIssues,
      commits,
    });
  }

  return { blockers, sections, asOf: Date.now() };
}
