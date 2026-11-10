export type RuntimeState = 'online' | 'offline' | 'starting' | 'warning' | 'available' | 'waiting' | 'configured' | 'not_configured' | 'unavailable' | 'conflict' | 'unknown' | 'foreground' | 'running_background' | 'not_foreground';

export interface ServiceState {
  status: RuntimeState | string;
  label?: string;
  detail?: string;
  connected?: boolean;
  tools?: string[];
}

export interface BridgeStatus {
  version: string;
  platform: string;
  uptimeSeconds: number;
  bridge: ServiceState;
  api: ServiceState;
  editor: ServiceState & { running?: boolean | null; foreground?: boolean | null };
  mcp: ServiceState;
  ai: ServiceState;
  automation: ServiceState;
  capabilities: {
    fileLane: boolean;
    liveLane: boolean;
    projectReadback: boolean;
    pluginAvailable: boolean;
  };
  plugin: {
    status: string;
    managed: boolean;
    error: string | null;
    port: number;
    projectsPathExists: boolean;
  };
}

export interface ProjectSummary {
  name: string;
  modified_at: string | null;
  media_count: number | null;
  video_count?: number | null;
  audio_count?: number | null;
  timeline_count: number | null;
  clip_count?: number | null;
  duration_seconds: number | null;
  path?: string;
  read_error?: boolean;
}

export interface ProjectListResponse {
  projects: ProjectSummary[];
  source: string;
  count: number;
}

export interface ProjectTimeline {
  project_name: string;
  source: string;
  duration: number;
  duration_seconds: number;
  tracks_count: number;
  segments_count: number;
  media_count: number;
  media_counts: { video: number; audio: number };
  media: Array<{
    id: string;
    type: 'video' | 'audio';
    name: string;
    path: string;
    duration_us?: number;
    exists_on_disk: boolean;
  }>;
  tracks: Array<{
    track_type: string;
    track_id: string;
    segments_count: number;
    segments: unknown[];
  }>;
  read_only: true;
}

export interface ApiLogs {
  path: string;
  lines: string[];
}

export interface EditingCommandResponse {
  status: 'planned' | 'unsupported' | 'draft_readback_verified' | 'verified' | 'sent_unverified' | 'readback_complete' | 'failed';
  interpretedBy?: 'gemini' | 'allowlist-parser';
  intent?: Record<string, unknown>;
  verified?: boolean;
  verificationScope?: string;
  requiresConfirmation?: boolean;
  result?: unknown;
  message?: string;
  error?: string;
}
