import type { ProjectConfig } from './config.js';
import type { RefreshState, LaneSignal } from './types.js';

export interface BoardCard {
  prefix: string;
  issue: number;
  title: string;
  repo: string;
  column: 'needsYou' | 'inProgress' | 'inReview' | 'todo';
  since: number;
}

export interface BoardColumns {
  needsYou: BoardCard[];
  inProgress: BoardCard[];
  inReview: BoardCard[];
  todo: BoardCard[];
}

const LANE_BRANCH_RE = /^(?:feat|fix|refactor|test|chore|docs|ci)\/(\d+)-/;

function issueFromBranch(branch: string): number {
  const m = branch.match(LANE_BRANCH_RE);
  return m ? parseInt(m[1]!, 10) : 0;
}

export function classifyCards(projects: ProjectConfig[], state: RefreshState): BoardColumns {
  const cols: BoardColumns = { needsYou: [], inProgress: [], inReview: [], todo: [] };

  for (const project of projects) {
    const gh = state.github.get(project.repo);
    const files = state.files.get(project.path);
    if (!gh) continue;

    const signals = files?.signals ?? [];
    const activeIssues = new Set<number>();

    const signalByIssue = new Map<number, LaneSignal>();
    for (const s of signals) {
      const existing = signalByIssue.get(s.issue);
      if (!existing || s.timestamp > existing.timestamp) {
        signalByIssue.set(s.issue, s);
      }
    }

    for (const pr of gh.prs) {
      const issue = issueFromBranch(pr.headRefName);
      if (!issue) continue;
      activeIssues.add(issue);

      const signal = signalByIssue.get(issue);

      const card: BoardCard = {
        prefix: project.prefix,
        issue,
        title: pr.title,
        repo: project.repo,
        column: 'inProgress',
        since: gh.updatedAt,
      };

      if (signal?.type === 'block' || signal?.type === 'handoff') {
        card.column = 'needsYou';
        card.since = signal.timestamp;
      } else if (pr.checksStatus === 'fail') {
        card.column = 'needsYou';
      } else if (pr.reviewDecision !== '') {
        card.column = 'inReview';
      }

      cols[card.column].push(card);
    }

    for (const issue of gh.openIssues) {
      if (!issue.labels.includes('ready')) continue;
      if (activeIssues.has(issue.number)) continue;
      cols.todo.push({
        prefix: project.prefix,
        issue: issue.number,
        title: issue.title,
        repo: project.repo,
        column: 'todo',
        since: gh.updatedAt,
      });
    }
  }

  return cols;
}
