import React, { useState } from 'react';
import { Play, Pause, Scissors, ZoomIn, ZoomOut, Check, ShieldCheck, Film, Type, Layers, Code, AlertTriangle } from 'lucide-react';

interface Clip {
  id: string;
  name: string;
  start: number; // in seconds
  duration: number; // in seconds
  color: string;
}

export const TimelineVisualizer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(2.8); // current playhead position in seconds
  const [zoom, setZoom] = useState(1);
  const [activeTab, setActiveTab] = useState<'visual' | 'json'>('visual');

  // Multi-track state simulating CapCut draft_content.json
  const [mainClips, setMainClips] = useState<Clip[]>([
    { id: 'c1', name: 'intro_hook.mov', start: 0, duration: 2.4, color: 'bg-blue-600/80 border-blue-500' },
    { id: 'c2', name: 'demo_problem.mov', start: 2.4, duration: 3.6, color: 'bg-blue-700/80 border-blue-600' },
    { id: 'c3', name: 'solution_reveal.mov', start: 6.0, duration: 4.1, color: 'bg-blue-600/80 border-blue-500' },
    { id: 'c4', name: 'call_to_action.mov', start: 10.1, duration: 2.8, color: 'bg-blue-800/80 border-blue-700' },
  ]);

  const [overlayClips, setOverlayClips] = useState<Clip[]>([
    { id: 'ov1', name: 'broll_highlight.mov', start: 3.0, duration: 2.5, color: 'bg-purple-600/80 border-purple-500' },
  ]);

  const [textClips, setTextClips] = useState<Clip[]>([
    { id: 't1', name: 'STOP SCROLLING 🚨', start: 0.2, duration: 2.2, color: 'bg-amber-600/80 border-amber-500' },
    { id: 't2', name: 'Stop editing manually', start: 2.6, duration: 3.2, color: 'bg-amber-700/80 border-amber-600' },
    { id: 't3', name: 'CapCut Bridge Active', start: 6.2, duration: 3.5, color: 'bg-amber-600/80 border-amber-500' },
  ]);

  const totalDuration = 13.0; // seconds

  const formatTimecode = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const formatMicroseconds = (sec: number) => {
    return `${Math.round(sec * 1_000_000).toLocaleString()} µs`;
  };

  const handleSplit = () => {
    // Find main track clip under playhead
    const targetIdx = mainClips.findIndex((c) => playhead > c.start && playhead < c.start + c.duration);
    if (targetIdx === -1) return;

    const target = mainClips[targetIdx];
    const cutPoint = playhead - target.start;

    const left: Clip = {
      ...target,
      id: `${target.id}_a`,
      duration: cutPoint,
    };

    const right: Clip = {
      ...target,
      id: `${target.id}_b`,
      name: `${target.name} (Split)`,
      start: playhead,
      duration: target.duration - cutPoint,
    };

    const updated = [...mainClips];
    updated.splice(targetIdx, 1, left, right);
    setMainClips(updated);
  };

  // Generate synthetic CapCut JSON
  const draftJson = {
    id: 'DRAFT_UUID_83F91A',
    version: 2,
    canvas_config: { width: 1080, height: 1920, ratio: '9:16' },
    fps: 30.0,
    duration: Math.round(totalDuration * 1_000_000),
    tracks: [
      {
        id: 'TRACK_MAIN_VIDEO',
        type: 'video',
        attribute: 0,
        segments: mainClips.map((c, i) => ({
          id: `SEG_${c.id}`,
          material_id: `MAT_${c.id}`,
          render_index: i,
          target_timerange: { start: Math.round(c.start * 1e6), duration: Math.round(c.duration * 1e6) },
          source_timerange: { start: 0, duration: Math.round(c.duration * 1e6) },
        })),
      },
      {
        id: 'TRACK_OVERLAY_VIDEO',
        type: 'video',
        attribute: 1,
        segments: overlayClips.map((c, i) => ({
          id: `SEG_${c.id}`,
          material_id: `MAT_${c.id}`,
          render_index: 100 + i,
          target_timerange: { start: Math.round(c.start * 1e6), duration: Math.round(c.duration * 1e6) },
          source_timerange: { start: 0, duration: Math.round(c.duration * 1e6) },
        })),
      },
      {
        id: 'TRACK_CAPTIONS_TEXT',
        type: 'text',
        attribute: 0,
        segments: textClips.map((c, i) => ({
          id: `SEG_${c.id}`,
          material_id: `MAT_TEXT_${c.id}`,
          render_index: 200 + i,
          target_timerange: { start: Math.round(c.start * 1e6), duration: Math.round(c.duration * 1e6) },
          // Repaired timerange rule enforced!
          source_timerange: { start: 0, duration: Math.round(c.duration * 1e6) },
        })),
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Header and Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white">Draft & Timeline Inspector</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Simulate CapCut’s multi-track timeline, test live frame-exact seeks, cuts, and inspect underlying draft JSON.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-lg">
          <button
            onClick={() => setActiveTab('visual')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'visual' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Visual Timeline
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
              activeTab === 'json' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>draft_content.json</span>
          </button>
        </div>
      </div>

      {activeTab === 'visual' ? (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl">
            {/* Playhead Timecode display */}
            <div className="flex items-center gap-4">
              <div className="px-3 py-1.5 bg-black rounded-lg border border-neutral-800 font-mono text-emerald-400 text-sm font-semibold tracking-wider">
                {formatTimecode(playhead)}
              </div>
              <div className="text-xs font-mono text-neutral-400 hidden sm:block">
                <span>CapCut Units: </span>
                <span className="text-neutral-200">{formatMicroseconds(playhead)}</span>
              </div>
            </div>

            {/* Editing buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSplit}
                className="px-3 py-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg border border-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Scissors className="w-3.5 h-3.5 text-emerald-400" />
                <span>Split Cut (Cmd+B)</span>
              </button>
              <button
                onClick={() => setPlayhead(0)}
                className="px-2.5 py-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-950 border border-neutral-800 rounded-lg transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>

            {/* Zoom / Info */}
            <div className="flex items-center gap-3 text-xs text-neutral-400">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Timeranges Repaired</span>
              </div>
              <span className="text-neutral-600">·</span>
              <span>Total: {totalDuration.toFixed(1)}s</span>
            </div>
          </div>

          {/* Interactive Multi-Track Canvas */}
          <div className="p-5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-4 overflow-x-auto select-none">
            {/* Scrubber Ruler */}
            <div className="relative h-6 bg-neutral-900/80 rounded border-b border-neutral-800">
              {Array.from({ length: 14 }).map((_, sec) => (
                <div
                  key={sec}
                  style={{ left: `${(sec / totalDuration) * 100}%` }}
                  className="absolute top-0 bottom-0 border-l border-neutral-700 text-[10px] font-mono text-neutral-400 pl-1"
                >
                  {sec}s
                </div>
              ))}
            </div>

            {/* Track 1: Text / Captions */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
                <Type className="w-3.5 h-3.5" />
                <span>Text / Subtitles Track (attribute: 0)</span>
              </div>
              <div className="relative h-10 bg-neutral-900/40 rounded border border-neutral-800">
                {textClips.map((clip) => {
                  const leftPct = (clip.start / totalDuration) * 100;
                  const widthPct = (clip.duration / totalDuration) * 100;
                  return (
                    <div
                      key={clip.id}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      className={`absolute top-1 bottom-1 ${clip.color} border rounded px-2 text-[11px] font-medium text-white flex items-center justify-between overflow-hidden shadow-sm`}
                      title={`${clip.name} (${clip.duration}s)`}
                    >
                      <span className="truncate">{clip.name}</span>
                      <span className="text-[10px] text-amber-200 ml-1 font-mono shrink-0">{clip.duration}s</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Track 2: Overlay Video */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-purple-400">
                <Layers className="w-3.5 h-3.5" />
                <span>Overlay Video Track (attribute: 1, B-Roll)</span>
              </div>
              <div className="relative h-11 bg-neutral-900/40 rounded border border-neutral-800">
                {overlayClips.map((clip) => {
                  const leftPct = (clip.start / totalDuration) * 100;
                  const widthPct = (clip.duration / totalDuration) * 100;
                  return (
                    <div
                      key={clip.id}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      className={`absolute top-1 bottom-1 ${clip.color} border rounded px-2.5 text-xs font-medium text-white flex items-center justify-between overflow-hidden shadow-sm`}
                      title={`${clip.name} (${clip.duration}s)`}
                    >
                      <span className="truncate">{clip.name}</span>
                      <span className="text-[10px] text-purple-200 ml-1 font-mono shrink-0">{clip.duration}s</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Track 3: Main Video Track */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-400">
                <Film className="w-3.5 h-3.5" />
                <span>Main Video Track (attribute: 0, Primary Cuts)</span>
              </div>
              <div className="relative h-14 bg-neutral-900/40 rounded border border-neutral-800">
                {mainClips.map((clip) => {
                  const leftPct = (clip.start / totalDuration) * 100;
                  const widthPct = (clip.duration / totalDuration) * 100;
                  return (
                    <div
                      key={clip.id}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      className={`absolute top-1 bottom-1 ${clip.color} border rounded px-3 text-xs font-medium text-white flex items-center justify-between overflow-hidden shadow-sm`}
                      title={`${clip.name} (In: ${clip.start}s, Dur: ${clip.duration}s)`}
                    >
                      <span className="truncate">{clip.name}</span>
                      <span className="text-[10px] text-blue-200 ml-1 font-mono shrink-0">{clip.duration.toFixed(1)}s</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Interactive Playhead Slider */}
            <div className="pt-2">
              <input
                type="range"
                min="0"
                max={totalDuration}
                step="0.05"
                value={playhead}
                onChange={(e) => setPlayhead(parseFloat(e.target.value))}
                className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <div className="flex justify-between text-[11px] font-mono text-neutral-400 mt-1">
                <span>0.00s</span>
                <span>Scrub Playhead (Seek Simulation)</span>
                <span>{totalDuration}s</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* JSON Inspector Card */
        <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <span className="text-xs font-mono text-neutral-400">
              ~/Movies/CapCut/User Data/Projects/com.lveditor.draft/Hook_Promo_V1/draft_content.json
            </span>
            <span className="text-xs text-emerald-400 font-mono">Strict CapCut Schema V2</span>
          </div>
          <pre className="font-mono text-xs text-neutral-300 bg-neutral-900 p-4 rounded-lg overflow-x-auto max-h-96 leading-relaxed">
            {JSON.stringify(draftJson, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
