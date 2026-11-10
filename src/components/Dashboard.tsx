import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle, ArrowRight, Cpu, FileSearch, FolderOpen, RefreshCw, ShieldCheck, Workflow } from 'lucide-react';
import { getBridgeStatus, getProjects } from '../services/bridgeApi';
import type { BridgeStatus, ProjectSummary } from '../types/bridge';

export function Dashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [source, setSource] = useState('unknown');
  const [selectedName, setSelectedName] = useState('');
  const [statusError, setStatusError] = useState('');
  const [projectsError, setProjectsError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = async (signal?: AbortSignal) => {
    setLoading(true);
    setStatusError('');
    setProjectsError('');
    const [statusResult, projectResult] = await Promise.allSettled([
      getBridgeStatus(signal),
      getProjects(signal),
    ]);
    if (statusResult.status === 'fulfilled') setStatus(statusResult.value);
    else {
      setStatus(null);
      setStatusError(statusResult.reason instanceof Error ? statusResult.reason.message : 'Backend status unavailable.');
    }
    if (projectResult.status === 'fulfilled') {
      const rows = projectResult.value.projects ?? [];
      setProjects(rows);
      setSource(projectResult.value.source || 'unknown');
      setSelectedName((current) => current && rows.some((project) => project.name === current) ? current : rows[0]?.name ?? '');
    } else {
      setProjects([]);
      setSource('unknown');
      setSelectedName('');
      setProjectsError(projectResult.reason instanceof Error ? projectResult.reason.message : 'Project index unavailable.');
    }
    setLoading(false);
  };

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, []);

  const selected = projects.find((project) => project.name === selectedName) ?? null;
  const editorValue = status?.editor?.status ?? 'unknown';
  const backendAvailable = Boolean(status);

  return <div className="min-h-[calc(100vh-140px)] space-y-6 rounded-2xl bg-[#061326] p-5 text-white sm:p-7">
    <section className="rounded-2xl border border-cyan-900 bg-gradient-to-r from-[#0b2646] to-[#10213a] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-cyan-300"><Activity size={16} /> Local backend status</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">CapCut Bridge Kit</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Existing local project bridge with separate file-readback and live-shortcut lanes. Status and project details below are fetched from the desktop service; unavailable data stays unknown.</p>
        </div>
        <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-cyan-700 bg-slate-950/40 px-3 py-2 text-sm text-cyan-100 hover:border-cyan-400 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <StatusPill label="Bridge service" value={status?.bridge.status ?? 'unknown'} />
        <StatusPill label="MCP session" value={status?.mcp.status ?? 'unknown'} />
        <StatusPill label="CapCut process" value={editorValue} />
        <StatusPill label="AI provider" value={status?.ai.status ?? 'unknown'} />
      </div>
      {statusError && <p className="mt-4 flex items-center gap-2 text-sm text-amber-200"><AlertCircle size={15} /> Backend status not available: {statusError}</p>}
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Indexed projects" value={backendAvailable && !projectsError ? String(projects.length) : 'Unknown'} detail={`Source: ${source}`} />
      <MetricCard label="Selected project" value={selected?.name ?? 'None selected'} detail={selected ? `Modified: ${selected.modified_at ?? 'unknown'}` : 'Select from backend results below'} />
      <MetricCard label="Referenced media" value={selected?.media_count == null ? 'Unknown' : String(selected.media_count)} detail={selected ? 'Value returned by project index; may be unknown' : 'No project selected'} />
      <MetricCard label="Timeline entries" value={selected?.clip_count == null ? 'Unknown' : String(selected.clip_count)} detail={selected ? 'Backend-derived clip/segment count' : 'No project selected'} />
    </section>

    {projectsError && <div role="alert" className="rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-100">Project list unavailable: {projectsError}</div>}

    <div className="grid gap-5 lg:grid-cols-3">
      <section className="rounded-xl border border-cyan-900 bg-[#0b1d35] p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><FolderOpen size={18} className="text-cyan-300" /><h2 className="text-lg font-semibold">Local project index</h2></div>
          {selected && <button onClick={() => onNavigate('agent')} className="inline-flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-100">Inspect & plan <ArrowRight size={14} /></button>}
        </div>
        {projects.length ? <>
          <label htmlFor="dashboard-project" className="mt-4 block text-xs text-slate-400">Select a project returned by the backend</label>
          <select id="dashboard-project" value={selectedName} onChange={(event) => setSelectedName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white">
            {projects.map((project) => <option key={project.name} value={project.name}>{project.name}</option>)}
          </select>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
            <div className="grid grid-cols-[minmax(0,1.5fr)_0.8fr_0.7fr_0.8fr] gap-2 bg-slate-900 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400">
              <span>Project</span><span>Duration</span><span>Media</span><span>Clips</span>
            </div>
            {projects.map((project) => <button key={project.name} onClick={() => setSelectedName(project.name)} className={`grid w-full grid-cols-[minmax(0,1.5fr)_0.8fr_0.7fr_0.8fr] gap-2 border-t border-slate-800 px-3 py-3 text-left text-xs hover:bg-slate-900/70 ${selectedName === project.name ? 'bg-cyan-950/20' : ''}`}>
              <span className="truncate font-medium text-white">{project.name}</span>
              <span className="text-slate-300">{typeof project.duration_seconds === 'number' ? `${project.duration_seconds.toFixed(1)}s` : 'Unknown'}</span>
              <span className="text-slate-300">{project.media_count ?? 'Unknown'}</span>
              <span className="text-slate-300">{project.clip_count ?? 'Unknown'}</span>
            </button>)}
          </div>
        </> : <div className="mt-4 rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">{loading ? 'Loading backend project list…' : 'No project records were returned. The dashboard does not invent sample projects or counts.'}</div>}
        <p className="mt-3 break-all text-[11px] text-slate-500">Project source: {source}. Project files remain the local source of truth; no timeline database is inferred.</p>
      </section>

      <section className="rounded-xl border border-cyan-900 bg-[#0b1d35] p-5">
        <h2 className="text-lg font-semibold">Quick navigation</h2>
        <div className="mt-4 grid gap-2">
          <ActionButton icon={<Workflow size={16} />} label="Editing agent pipeline" detail="Inspect, plan, validate, preview" onClick={() => onNavigate('agent')} />
          <ActionButton icon={<Cpu size={16} />} label="Bridge and MCP details" detail="Capabilities and setup notes" onClick={() => onNavigate('bridge')} />
          <ActionButton icon={<FileSearch size={16} />} label="Command allowlist" detail="Preview only where marked" onClick={() => onNavigate('commands')} />
          <ActionButton icon={<ShieldCheck size={16} />} label="Hardening rules" detail="Security and verification boundaries" onClick={() => onNavigate('rules')} />
        </div>
      </section>
    </div>

    <div className="grid gap-5 md:grid-cols-2">
      <section className="rounded-xl border border-emerald-900 bg-emerald-950/20 p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-emerald-200"><ShieldCheck size={17} /> File lane · disk changes</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">Draft JSON writes are backed up and read back from disk. Existing sidecars and timeline caches are preserved. Writes refuse to run while CapCut is open. JSON readback does not verify that CapCut accepted the project.</p>
      </section>
      <section className="rounded-xl border border-violet-900 bg-violet-950/20 p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-violet-200"><Activity size={17} /> Live lane · shortcuts</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">Supported shortcuts require CapCut to be foreground. Keyboard events are reported as unverified; export completion, rendered output, and unsupported seek/timed split operations are not presented as successful.</p>
      </section>
    </div>
  </div>;
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-xl border border-cyan-900 bg-[#0b1d35] p-4">
    <div className="text-xs text-slate-400">{label}</div>
    <div className="mt-2 break-words text-xl font-semibold">{value}</div>
    <div className="mt-1 text-xs text-slate-500">{detail}</div>
  </div>;
}

function StatusPill({ label, value }: { label: string; value: string }) {
  const color = value === 'online' || value === 'foreground' || value === 'configured'
    ? 'border-emerald-700 bg-emerald-950/40 text-emerald-200'
    : value === 'unknown' || value === 'offline' || value === 'unavailable' || value === 'not_configured'
      ? 'border-neutral-700 bg-neutral-900 text-neutral-300'
      : 'border-amber-800 bg-amber-950/30 text-amber-200';
  return <span className={`rounded-full border px-3 py-1.5 ${color}`}><span className="text-slate-400">{label}: </span>{value}</span>;
}

function ActionButton({ icon, label, detail, onClick }: { icon: React.ReactNode; label: string; detail: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-left hover:border-cyan-700">
    <span className="text-cyan-300">{icon}</span><span><span className="block text-sm font-medium">{label}</span><span className="mt-0.5 block text-xs text-slate-400">{detail}</span></span>
  </button>;
}
