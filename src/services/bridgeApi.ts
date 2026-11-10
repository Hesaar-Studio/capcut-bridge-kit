import type {
  ApiLogs,
  BridgeStatus,
  EditingCommandResponse,
  ProjectListResponse,
  ProjectTimeline,
} from '../types/bridge';

export class BridgeApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'BridgeApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error: unknown }).error)
      : `${response.status} ${response.statusText}`;
    throw new BridgeApiError(message, response.status, payload);
  }
  return payload as T;
}

export function getBridgeStatus(signal?: AbortSignal): Promise<BridgeStatus> {
  return request<BridgeStatus>('/api/desktop/status', { signal });
}

export function getProjects(signal?: AbortSignal): Promise<ProjectListResponse> {
  return request<ProjectListResponse>('/api/bridge/projects', { signal });
}

export function getProjectTimeline(name: string, signal?: AbortSignal): Promise<ProjectTimeline> {
  return request<ProjectTimeline>(`/api/bridge/projects/${encodeURIComponent(name)}`, { signal });
}

export function runCommand(text: string, confirmLive = false): Promise<EditingCommandResponse> {
  return request<EditingCommandResponse>('/api/bridge/command', {
    method: 'POST',
    body: JSON.stringify({ text, confirmed: confirmLive }),
  });
}

export function createProject(name: string, cuts: Array<{ source_path: string; start: number; duration: number }>) {
  return request<{ verified: boolean; projectName?: string; result?: unknown; error?: string }>(
    '/api/bridge/projects',
    { method: 'POST', body: JSON.stringify({ projectName: name, cuts }) },
  );
}

export function addText(projectName: string, text: string, at: number, duration: number) {
  return request<{ verified: boolean; projectName?: string; result?: unknown; error?: string }>(
    '/api/bridge/add-text',
    { method: 'POST', body: JSON.stringify({ projectName, text, at, duration }) },
  );
}

export function getLogs(limit = 150): Promise<ApiLogs> {
  return request<ApiLogs>(`/api/desktop/logs?lines=${encodeURIComponent(String(limit))}`);
}

export interface ContractResponse<T = unknown> {
  operation: string;
  success: boolean;
  request_id?: string | null;
  data?: T;
  error?: { code?: string; message?: string };
}

export function callContract<T = unknown>(operation: string, parameters: Record<string, unknown> = {}): Promise<ContractResponse<T>> {
  return request<ContractResponse<T>>('/api/bridge/contract', {
    method: 'POST',
    body: JSON.stringify({ operation, parameters }),
  });
}
