export interface PullRequest {
  number: number;
  title: string;
  state: string;
  isDraft: boolean;
  url: string;
  headRefName: string;
  labels: string[];
  reviewDecision: string;
  checksStatus: 'pass' | 'fail' | 'pending' | 'unknown';
  createdAt: number;
}

export interface GitHubState {
  prs: PullRequest[];
  openIssues: { number: number; title: string; labels: string[] }[];
  updatedAt: number;
}

export interface LaneSignal {
  type: 'block' | 'handoff' | 'progress';
  issue: number;
  message: string;
  timestamp: number;
}

export interface LaneNotes {
  issue: number;
  raw: string;
  updatedAt: number;
}

export interface ReviewResult {
  issue: number;
  reviewer: string;
  verdict: string;
  critical: number;
  important: number;
  raw: string;
  updatedAt: number;
}

export interface FileWatchState {
  signals: LaneSignal[];
  notes: LaneNotes[];
  reviews: ReviewResult[];
}

export interface RexEvent {
  type: string;
  session?: string;
  block?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export type SourceStatus = 'ok' | 'unavailable' | 'error';

export interface RefreshState {
  github: Map<string, GitHubState>;
  files: Map<string, FileWatchState>;
  rexEvents: RexEvent[];
  sources: {
    github: SourceStatus;
    fileWatch: SourceStatus;
    rex: SourceStatus;
  };
}

export function emptyRefreshState(): RefreshState {
  return {
    github: new Map(),
    files: new Map(),
    rexEvents: [],
    sources: { github: 'unavailable', fileWatch: 'unavailable', rex: 'unavailable' },
  };
}
