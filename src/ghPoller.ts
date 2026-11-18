import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ProjectConfig } from './config.js';
import type { PullRequest, GitHubState } from './types.js';

const execFileAsync = promisify(execFile);

interface GhPrRaw {
  number: number;
  title: string;
  state: string;
  isDraft: boolean;
  url: string;
  headRefName: string;
  labels: { name: string }[];
  reviewDecision: string;
  statusCheckRollup?: { state: string }[];
  createdAt: string;
}

interface GhIssueRaw {
  number: number;
  title: string;
  labels: { name: string }[];
  createdAt: string;
}

function checksState(rollup?: { state: string }[]): PullRequest['checksStatus'] {
  if (!rollup || rollup.length === 0) return 'unknown';
  const states = rollup.map(c => c.state);
  if (states.some(s => s === 'FAILURE' || s === 'ERROR')) return 'fail';
  if (states.some(s => s === 'PENDING' || s === 'EXPECTED')) return 'pending';
  return 'pass';
}

export function parseGhPrJson(json: string): PullRequest[] {
  const raw: GhPrRaw[] = JSON.parse(json);
  return raw.map(pr => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    isDraft: pr.isDraft,
    url: pr.url,
    headRefName: pr.headRefName,
    labels: pr.labels.map(l => l.name),
    reviewDecision: pr.reviewDecision,
    checksStatus: checksState(pr.statusCheckRollup),
    createdAt: new Date(pr.createdAt).getTime(),
  }));
}

export function parseGhIssueJson(json: string): GitHubState['openIssues'] {
  const raw: GhIssueRaw[] = JSON.parse(json);
  return raw.map(i => ({
    number: i.number,
    title: i.title,
    labels: i.labels.map(l => l.name),
    createdAt: new Date(i.createdAt).getTime(),
  }));
}

const PR_FIELDS = 'number,title,state,isDraft,url,headRefName,labels,reviewDecision,statusCheckRollup,createdAt';
const ISSUE_FIELDS = 'number,title,labels,createdAt';

export async function pollGitHub(project: ProjectConfig): Promise<GitHubState> {
  const [prResult, issueResult] = await Promise.all([
    execFileAsync(
      'gh',
      ['pr', 'list', '--repo', project.repo, '--state', 'open', '--json', PR_FIELDS, '--limit', '100'],
      { encoding: 'utf-8', timeout: 30_000 },
    ),
    execFileAsync(
      'gh',
      ['issue', 'list', '--repo', project.repo, '--state', 'open', '--json', ISSUE_FIELDS, '--limit', '200'],
      { encoding: 'utf-8', timeout: 30_000 },
    ),
  ]);

  return {
    prs: parseGhPrJson(prResult.stdout),
    openIssues: parseGhIssueJson(issueResult.stdout),
    updatedAt: Date.now(),
  };
}
