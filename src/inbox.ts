import type { ProjectConfig } from './config.js';
import type { RefreshState, LaneSignal } from './types.js';

export type InboxReason = 'Blocked' | 'Finished' | 'Failed CI' | 'Review ready';

export interface InboxItem {
  prefix: string;
  issue: number;
  title: string;
  repo: string;
  reason: InboxReason;
  detail: string;
  since: number;
}

const LANE_BRANCH_RE = /^(?:feat|fix|refactor|test|chore|docs|ci)\/(\d+)-/;

function issueFromBranch(branch: string): number {
  const m = branch.match(LANE_BRANCH_RE);
  return m ? parseInt(m[1]!, 10) : 0;
}

export function buildInbox(projects: ProjectConfig[], state: RefreshState): InboxItem[] {
  const items: InboxItem[] = [];

  for (const project of projects) {
    const gh = state.github.get(project.repo);
    const files = state.files.get(project.path);
    if (!gh) continue;

    const signals = files?.signals ?? [];
    const reviews = files?.reviews ?? [];

    const signalPriority: Record<LaneSignal['type'], number> = { block: 2, handoff: 1, progress: 0 };
    const signalByIssue = new Map<number, LaneSignal>();
    for (const s of signals) {
      const existing = signalByIssue.get(s.issue);
      if (!existing
        || signalPriority[s.type] > signalPriority[existing.type]
        || (signalPriority[s.type] === signalPriority[existing.type] && s.timestamp > existing.timestamp)) {
        signalByIssue.set(s.issue, s);
      }
    }

    const reviewsByIssue = new Map<number, typeof reviews>();
    for (const r of reviews) {
      const arr = reviewsByIssue.get(r.issue) ?? [];
      arr.push(r);
      reviewsByIssue.set(r.issue, arr);
    }

    for (const pr of gh.prs) {
      const issue = issueFromBranch(pr.headRefName);
      if (!issue) continue;

      const signal = signalByIssue.get(issue);

      if (signal?.type === 'block') {
        items.push({
          prefix: project.prefix,
          issue,
          title: pr.title,
          repo: project.repo,
          reason: 'Blocked',
          detail: signal.message,
          since: signal.timestamp,
        });
      } else if (signal?.type === 'handoff') {
        items.push({
          prefix: project.prefix,
          issue,
          title: pr.title,
          repo: project.repo,
          reason: 'Finished',
          detail: signal.message,
          since: signal.timestamp,
        });
      }

      if (pr.checksStatus === 'fail') {
        items.push({
          prefix: project.prefix,
          issue,
          title: pr.title,
          repo: project.repo,
          reason: 'Failed CI',
          detail: '',
          since: pr.createdAt,
        });
      }

      const issueReviews = reviewsByIssue.get(issue);
      if (issueReviews && issueReviews.length > 0) {
        items.push({
          prefix: project.prefix,
          issue,
          title: pr.title,
          repo: project.repo,
          reason: 'Review ready',
          detail: `${issueReviews.length} review(s)`,
          since: issueReviews[0]!.updatedAt,
        });
      }
    }
  }

  return items;
}
