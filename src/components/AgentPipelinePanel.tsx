import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, Check, Clipboard, FileSearch, ListChecks, Loader2, RefreshCw, Sparkles, Workflow } from 'lucide-react';
import { callContract, getBridgeStatus, getProjectTimeline, getProjects } from '../services/bridgeApi';
import type { BridgeStatus, ProjectSummary, ProjectTimeline } from '../types/bridge';

type ContractTool = {
  name: string;
  category: string;
  status: string;
  read_only: boolean;
  mutating: boolean;
  description: string;
};

type ContractCapabilities = {
  protocol_version: string;
  bridge_version: string;
  platform: string;
  tools: ContractTool[];
};

type SurfaceStatus = 'FOUND' | 'SUPPORTED' | 'EXPERIMENTAL' | 'UNVERIFIED' | 'UNAVAILABLE';
type SurfaceEvidence = { kind: string; label: string; url?: string; repository_path?: string; observed_at: string };
type IntegrationSurface = {
  id: string;
  name: string;
  status: SurfaceStatus;
  scope: string;
  finding: string;
  limitations: string[];
  safe_next_probe: string;
  evidence: SurfaceEvidence[];
  runtime_verified: boolean;
  version_scope: string;
  regional_availability: Array<{ scope: string; status: SurfaceStatus; basis: string }>;
};
type CapCutSurfaceMap = {
  schema_version: string;
  map_version: string;
  as_of: string;
  target: string;
  read_only: boolean;
  runtime_probes_performed: boolean;
  surface_count: number;
  status_legend: Record<SurfaceStatus, string>;
  agent_guidance: string[];
  surfaces: IntegrationSurface[];
};

type EditPlan = {
  project_name: string;
  total_duration_sec: number;
  planned_operations_count: number;
  items: Array<{
    action: string;
    target_segment_ids: string[];
    description: string;
    time_range?: { start: number; duration: number } | null;
    parameters?: Record<string, unknown>;
  }>;
  metadata: Record<string, unknown>;
};

type PlanValidation = { is_valid: boolean; errors: string[]; warnings: string[] };
type PlanPreview = {
  project_name: string;
  current_duration_sec: number;
  projected_duration_sec: number;
  net_time_saved_sec: number;
  planned_actions_count: number;
  is_dry_run: boolean;
};

function surfaceStatusClass(status: SurfaceStatus): string {
  switch (status) {
    case 'SUPPORTED': return 'border-emerald-800 bg-emerald-950/40 text-emerald-200';
    case 'FOUND': return 'border-cyan-800 bg-cyan-950/40 text-cyan-200';
    case 'EXPERIMENTAL': return 'border-amber-800 bg-amber-950/40 text-amber-200';
    case 'UNAVAILABLE': return 'border-rose-800 bg-rose-950/40 text-rose-200';
    default: return 'border-neutral-700 bg-neutral-800 text-neutral-200';
  }
}

function formatDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return 'Unknown';
  const minutes = Math.floor(seconds / 60);
  const remainder = (seconds % 60).toFixed(1).padStart(4, '0');
  return `${minutes}:${remainder}`;
}

export function AgentPipelinePanel() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [capabilities, setCapabilities] = useState<ContractCapabilities | null>(null);
  const [surfaceMap, setSurfaceMap] = useState<CapCutSurfaceMap | null>(null);
  const [selectedProject, setSelectedProject] = useState('');
  const [timeline, setTimeline] = useState<ProjectTimeline | null>(null);
  const [plan, setPlan] = useState<EditPlan | null>(null);
  const [validation, setValidation] = useState<PlanValidation | null>(null);
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'inspect' | 'plan' | 'validate' | 'preview' | null>(null);
  const [error, setError] = useState('');
  const [copyLabel, setCopyLabel] = useState('Copy JSON');

  const availableTools = useMemo(
    () => capabilities?.tools.filter((tool) => tool.status === 'available') ?? [],
    [capabilities],
  );

  const refresh = async () => {
    setLoading(true);
    setError('');
    const [statusResult, projectResult, capabilitiesResult, surfaceMapResult] = await Promise.allSettled([
      getBridgeStatus(),
      getProjects(),
      callContract<ContractCapabilities>('get_capabilities'),
      callContract<CapCutSurfaceMap>('get_capcut_surface_map'),
    ]);

    if (statusResult.status === 'fulfilled') setStatus(statusResult.value);
    else setStatus(null);

    if (projectResult.status === 'fulfilled') {
      const nextProjects = projectResult.value.projects ?? [];
      setProjects(nextProjects);
      setSelectedProject((current) => current && nextProjects.some((item) => item.name === current)
        ? current
        : nextProjects[0]?.name ?? '');
    } else {
      setProjects([]);
      setSelectedProject('');
    }

    if (capabilitiesResult.status === 'fulfilled' && capabilitiesResult.value.success) {
      setCapabilities(capabilitiesResult.value.data ?? null);
    } else {
      setCapabilities(null);
    }

    if (surfaceMapResult.status === 'fulfilled' && surfaceMapResult.value.success) {
      setSurfaceMap(surfaceMapResult.value.data ?? null);
    } else {
      setSurfaceMap(null);
    }

    const failures = [statusResult, projectResult, capabilitiesResult, surfaceMapResult]
      .filter((result) => result.status === 'rejected')
      .map((result) => result.status === 'rejected' ? result.reason : null)
      .filter(Boolean) as Error[];
    if (failures.length) setError(failures.map((failure) => failure.message).join(' · '));
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const inspectProject = async () => {
    if (!selectedProject) return;
    setBusy('inspect');
    setError('');
    setTimeline(null);
    try {
      setTimeline(await getProjectTimeline(selectedProject));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Project readback failed.');
    } finally {
      setBusy(null);
    }
  };

  const generatePlan = async () => {
    if (!selectedProject) return;
    setBusy('plan');
    setError('');
    setValidation(null);
    setPreview(null);
    setPlan(null);
    try {
      const response = await callContract<EditPlan>('create_edit_plan', { project_name: selectedProject });
      if (!response.success || !response.data) throw new Error(response.error?.message || 'Planner returned no plan.');
      setPlan(response.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Plan generation failed.');
    } finally {
      setBusy(null);
    }
  };

  const validatePlan = async () => {
    if (!selectedProject || !plan) return;
    setBusy('validate');
    setError('');
    try {
      const response = await callContract<PlanValidation>('validate_edit_plan', { project_name: selectedProject, plan });
      if (!response.success || !response.data) throw new Error(response.error?.message || 'Plan validation returned no result.');
      setValidation(response.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Plan validation failed.');
    } finally {
      setBusy(null);
    }
  };

  const previewPlan = async () => {
    if (!selectedProject || !plan) return;
    setBusy('preview');
    setError('');
    try {
      const response = await callContract<PlanPreview>('preview_edit_plan', { project_name: selectedProject, plan });
      if (!response.success || !response.data) throw new Error(response.error?.message || 'Plan preview returned no result.');
      setPreview(response.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Plan preview failed.');
    } finally {
      setBusy(null);
    }
  };

  const copyPlan = async () => {
    if (!plan) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(plan, null, 2));
      setCopyLabel('Copied');
      window.setTimeout(() => setCopyLabel('Copy JSON'), 1600);
    } catch {
      setCopyLabel('Clipboard unavailable');
      window.setTimeout(() => setCopyLabel('Copy JSON'), 2000);
    }
  };

  const editorStatus = status?.editor?.status ?? 'unknown';

  return (
    <div className="min-h-[calc(100vh-140px)] rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-neutral-100 sm:p-6 space-y-5">
      <section className="rounded-2xl border border-cyan-900/80 bg-gradient-to-r from-[#0b2646] to-[#111827] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-cyan-300"><Workflow size={18} /><span className="text-sm font-semibold">HS.Tech · Provider-neutral contract</span></div>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Editing Agent Pipeline</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">Inspect a real local CapCut draft, create a machine-readable heuristic EditPlan, validate it, and preview projected changes. This view does not apply edits.</p>
          </div>
          <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm hover:border-cyan-500 disabled:opacity-50">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Refresh backend data
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatusCard label="Desktop service" value={status?.bridge.status ?? 'unknown'} detail={status?.bridge.detail ?? 'Status unavailable in this run mode.'} />
          <StatusCard label="MCP session" value={status?.mcp.status ?? 'unknown'} detail={status?.mcp.detail ?? 'MCP status unavailable.'} />
          <StatusCard label="CapCut process" value={editorStatus} detail={status?.editor.detail ?? 'Editor state is unknown; this is not a timeline readback.'} />
        </div>
      </section>

      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</div>}

      <section className="grid gap-5 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.6fr)]">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5">
          <div className="flex items-center gap-2"><FileSearch size={17} className="text-cyan-300" /><h2 className="font-semibold">1 · Select and inspect</h2></div>
          <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-neutral-400" htmlFor="agent-project">Local project</label>
          <select id="agent-project" value={selectedProject} onChange={(event) => { setSelectedProject(event.target.value); setTimeline(null); setPlan(null); setValidation(null); setPreview(null); }} className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-white">
            <option value="">{projects.length ? 'Select a project' : 'No project data available'}</option>
            {projects.map((project) => <option key={project.name} value={project.name}>{project.name}</option>)}
          </select>
          <div className="mt-3 text-xs text-neutral-400">Source: {projects.length ? 'local project index' : 'unknown'} · {projects.length} projects returned by the backend</div>
          <button onClick={() => void inspectProject()} disabled={!selectedProject || busy !== null} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-800 bg-cyan-950/40 px-3 py-2.5 text-sm font-medium text-cyan-100 hover:bg-cyan-900/50 disabled:cursor-not-allowed disabled:opacity-40">
            {busy === 'inspect' ? <Loader2 size={15} className="animate-spin" /> : <FileSearch size={15} />} Read on-disk timeline
          </button>
          {timeline && <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-sm">
            <div className="font-medium text-white">{timeline.project_name}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-neutral-300">
              <span>Duration: {formatDuration(timeline.duration_seconds)}</span>
              <span>Tracks: {timeline.tracks_count}</span>
              <span>Segments: {timeline.segments_count}</span>
              <span>Media references: {timeline.media_count}</span>
            </div>
            <div className="mt-2 break-all text-[11px] text-neutral-500">Read source: {timeline.source}</div>
            <div className="mt-2 text-[11px] text-amber-300">This is draft-file readback. It does not confirm the currently open CapCut timeline.</div>
          </div>}
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><Sparkles size={17} className="text-violet-300" /><h2 className="font-semibold">2 · Plan → validate → preview</h2></div>
            <span className="rounded-full border border-violet-800 bg-violet-950/40 px-2.5 py-1 text-[11px] text-violet-200">Read-only heuristic planner</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-neutral-400">The backend’s existing subtitle-gap and duplicate-candidate analysis generates the plan. No external AI provider is called from this panel; provider-neutral means the contract format is independent of a model vendor.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => void generatePlan()} disabled={!selectedProject || busy !== null} className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-3.5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">
              {busy === 'plan' ? <Loader2 size={15} className="animate-spin" /> : <ListChecks size={15} />} Generate EditPlan
            </button>
            <button onClick={() => void validatePlan()} disabled={!plan || busy !== null} className="inline-flex items-center gap-2 rounded-lg border border-neutral-600 px-3.5 py-2.5 text-sm hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">
              {busy === 'validate' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Validate
            </button>
            <button onClick={() => void previewPlan()} disabled={!plan || busy !== null} className="inline-flex items-center gap-2 rounded-lg border border-neutral-600 px-3.5 py-2.5 text-sm hover:border-violet-500 disabled:cursor-not-allowed disabled:opacity-40">
              {busy === 'preview' ? <Loader2 size={15} className="animate-spin" /> : <Activity size={15} />} Dry-run preview
            </button>
          </div>

          {validation && <div className={`mt-4 rounded-lg border p-3 text-sm ${validation.is_valid ? 'border-emerald-800 bg-emerald-950/30 text-emerald-200' : 'border-rose-800 bg-rose-950/30 text-rose-200'}`}>
            <div className="font-semibold">Structural validation: {validation.is_valid ? 'valid' : 'invalid'}</div>
            {validation.errors?.length > 0 && <ul className="mt-2 list-disc pl-5">{validation.errors.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>}
            {validation.warnings?.length > 0 && <ul className="mt-2 list-disc pl-5 text-amber-200">{validation.warnings.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>}
          </div>}

          {preview && <div className="mt-4 rounded-lg border border-violet-800 bg-violet-950/20 p-3 text-sm">
            <div className="font-semibold text-violet-100">Dry run only · no project files changed</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-neutral-200 sm:grid-cols-4">
              <span>Current: {formatDuration(preview.current_duration_sec)}</span>
              <span>Projected: {formatDuration(preview.projected_duration_sec)}</span>
              <span>Time delta: {preview.net_time_saved_sec.toFixed(2)}s</span>
              <span>Actions: {preview.planned_actions_count}</span>
            </div>
          </div>}

          {plan && <div className="mt-4 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
            <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2.5">
              <div className="text-sm font-medium">Machine-readable plan · {plan.planned_operations_count ?? plan.items.length} proposed items</div>
              <button onClick={() => void copyPlan()} className="inline-flex items-center gap-1.5 rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:text-white"><Clipboard size={13} />{copyLabel}</button>
            </div>
            <div className="max-h-64 overflow-auto divide-y divide-neutral-800">
              {plan.items.map((item, index) => <div key={`${item.action}-${index}`} className="p-3">
                <div className="flex flex-wrap items-center gap-2"><span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-[10px] text-cyan-200">{item.action}</span><span className="text-xs text-neutral-500">{item.target_segment_ids?.length ?? 0} segment references</span></div>
                <p className="mt-1.5 text-sm text-neutral-200">{item.description}</p>
              </div>)}
              {plan.items.length === 0 && <p className="p-4 text-sm text-neutral-400">The backend returned an empty plan; no actions are proposed.</p>}
            </div>
            <details className="border-t border-neutral-800 p-3">
              <summary className="cursor-pointer text-xs text-neutral-400">View raw JSON</summary>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-emerald-200">{JSON.stringify(plan, null, 2)}</pre>
            </details>
          </div>}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Activity size={17} className="text-cyan-300" /> Contract capabilities</h2>
          {capabilities ? <>
            <p className="mt-2 text-xs text-neutral-400">Protocol {capabilities.protocol_version} · bridge {capabilities.bridge_version} · {capabilities.platform}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {availableTools.map((tool) => <div key={tool.name} className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
                <div className="flex items-center justify-between gap-2"><code className="text-xs text-cyan-200">{tool.name}</code><span className="text-[10px] text-emerald-300">available</span></div>
                <p className="mt-1 text-[11px] text-neutral-400">{tool.description}</p>
              </div>)}
            </div>
            {capabilities.tools.filter((tool) => tool.status !== 'available').map((tool) => <div key={tool.name} className="mt-2 rounded-lg border border-amber-900/70 bg-amber-950/20 p-3 text-xs text-amber-200"><code>{tool.name}</code> · {tool.status} · {tool.description}</div>)}
          </> : <p className="mt-3 text-sm text-neutral-400">Capability registry unavailable in this run mode; it is not inferred from the UI.</p>}
        </div>
        <div className="rounded-xl border border-amber-900/70 bg-amber-950/20 p-5">
          <h2 className="font-semibold text-amber-100">Execution and readback boundary</h2>
          <p className="mt-2 text-sm leading-6 text-amber-100/80">EditPlan application is unavailable. Validation and preview are read-only; they do not mutate a CapCut project. File-lane JSON readback is not proof that CapCut loaded, displayed, or rendered a change.</p>
          <button disabled title="Execution is explicitly unavailable" className="mt-4 cursor-not-allowed rounded-lg border border-amber-800 px-3 py-2 text-sm text-amber-200/60">Execute plan · unavailable</button>
          <p className="mt-3 text-xs text-neutral-400">Approval pipeline: plan output → structural validation → dry-run preview → human review. Execution and editor-side verification are intentionally not wired.</p>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><FileSearch size={17} className="text-cyan-300" /> CapCut integration-surface map</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">Evidence snapshot {surfaceMap?.as_of ?? 'unavailable'} · {surfaceMap?.surface_count ?? 0} pathways · read-only inventory, not a live probe.</p>
          </div>
          <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs hover:border-cyan-500 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh evidence map
          </button>
        </div>
        {surfaceMap ? <>
          <p className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100/80">{surfaceMap.target} Runtime probes performed: {surfaceMap.runtime_probes_performed ? 'yes' : 'no'}. This map does not execute its suggested next steps. Disk/JSON readback is not CapCut UI acceptance.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {surfaceMap.surfaces.map((surface) => <details key={surface.id} className="rounded-lg border border-neutral-800 bg-neutral-950">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
                <span className="text-sm font-medium text-neutral-100">{surface.name}</span>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${surfaceStatusClass(surface.status)}`}>{surface.status}</span>
              </summary>
              <div className="border-t border-neutral-800 p-3 text-xs leading-5 text-neutral-300">
                <p className="text-neutral-400">{surface.scope}</p>
                <p className="mt-2">{surface.finding}</p>
                <p className="mt-2 text-amber-200"><strong>Limitations:</strong> {surface.limitations.join(' ')}</p>
                {surface.regional_availability.length > 0 && <div className="mt-2 space-y-1 rounded border border-neutral-800 bg-neutral-900 p-2">
                  {surface.regional_availability.map((region) => <p key={region.scope}><span className={`mr-1 rounded border px-1.5 py-0.5 text-[9px] ${surfaceStatusClass(region.status)}`}>{region.status}</span>{region.scope}: {region.basis}</p>)}
                </div>}
                <p className="mt-2"><strong>Safe next probe:</strong> {surface.safe_next_probe}</p>
                <p className="mt-2 text-neutral-500"><strong>Version scope:</strong> {surface.version_scope} · CapCut runtime {surface.runtime_verified ? 'verified' : 'not verified'}</p>
                {surface.evidence.length > 0 && <div className="mt-2 border-t border-neutral-800 pt-2">
                  <div className="mb-1 font-semibold text-neutral-400">Evidence</div>
                  <ul className="space-y-1">
                    {surface.evidence.map((source) => <li key={`${surface.id}-${source.label}`}>
                      {source.url ? <a className="text-cyan-300 underline decoration-cyan-900 underline-offset-2 hover:text-cyan-100" href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : <span>{source.label}</span>}
                      {source.repository_path && <code className="ml-1 break-all text-neutral-500">{source.repository_path}</code>}
                    </li>)}
                  </ul>
                </div>}
              </div>
            </details>)}
          </div>
          <details className="mt-3 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
            <summary className="cursor-pointer text-xs font-medium text-neutral-400">Status definitions and agent guardrails</summary>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              {Object.entries(surfaceMap.status_legend).map(([label, meaning]) => <p key={label}><span className="mr-1 font-semibold text-cyan-200">{label}</span>{meaning}</p>)}
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-neutral-400">
              {surfaceMap.agent_guidance.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
          </details>
        </> : <p className="mt-3 text-sm text-neutral-400">Surface map unavailable in this run mode; no status is inferred from the UI.</p>}
      </section>
    </div>
  );
}

function StatusCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 p-3">
    <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
    <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    <div className="mt-1 text-xs leading-5 text-slate-400">{detail}</div>
  </div>;
}
