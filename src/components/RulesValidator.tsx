import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, Wrench, Download, FileText } from 'lucide-react';

export const RulesValidator: React.FC = () => {
  const [jsonInput, setJsonInput] = useState<string>(`{
  "draft_name": "Test_Project_V1",
  "tracks": [
    {
      "type": "video",
      "segments": [
        {
          "id": "SEG_01",
          "material_id": "MAT_01",
          "path": "/Users/someone/Downloads/Take1.mov",
          "source_timerange": { "start": 0, "duration": 3000000 },
          "target_timerange": { "start": 0, "duration": 3000000 }
        }
      ]
    },
    {
      "type": "text",
      "segments": [
        {
          "id": "SEG_TEXT_01",
          "material_id": "MAT_TEXT_01",
          "source_timerange": null,
          "target_timerange": { "start": 500000, "duration": 2500000 }
        }
      ]
    }
  ]
}`);

  const [auditResults, setAuditResults] = useState<{
    nullTimeranges: number;
    sandboxIssues: string[];
    cacheWarning: boolean;
    cleanJson: string | null;
  } | null>(null);

  const runAudit = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      let nullRanges = 0;
      const badPaths: string[] = [];

      // Check tracks
      if (Array.isArray(parsed.tracks)) {
        parsed.tracks.forEach((track: any) => {
          if (Array.isArray(track.segments)) {
            track.segments.forEach((seg: any) => {
              // Check Rule 5: null source_timerange
              if (seg.source_timerange === null || seg.source_timerange === undefined) {
                nullRanges++;
                // Auto repair
                const dur = seg.target_timerange?.duration || 3000000;
                seg.source_timerange = { start: 0, duration: dur };
              }

              // Check Rule 2: paths outside ~/Movies
              if (seg.path && typeof seg.path === 'string') {
                if (!seg.path.includes('/Movies/') && !seg.path.startsWith('~/Movies')) {
                  badPaths.push(seg.path);
                }
              }
            });
          }
        });
      }

      setAuditResults({
        nullTimeranges: nullRanges,
        sandboxIssues: badPaths,
        cacheWarning: true,
        cleanJson: JSON.stringify(parsed, null, 2),
      });
    } catch (e: any) {
      alert(`Invalid JSON format: ${e.message}`);
    }
  };

  const handleDownloadRepaired = () => {
    if (!auditResults?.cleanJson) return;
    const blob = new Blob([auditResults.cleanJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'repaired_draft_content.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-neutral-800 pb-4">
        <h2 className="text-xl font-semibold tracking-tight text-white">Hard Rules Audit & Diagnostic Tool</h2>
        <p className="text-xs text-neutral-400 mt-1">
          Detect and repair common issues (null timeranges, sandbox violations, cache stale state) before CapCut fails or crashes.
        </p>
      </div>

      {/* Rules Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-medium text-xs">
            <ShieldCheck className="w-4 h-4" />
            <span>Rule 1: Quit Before Writing</span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            CapCut rewrites its own draft registry on quit. The bridge halts CapCut before modifying disk files to prevent data loss.
          </p>
        </div>

        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-medium text-xs">
            <AlertTriangle className="w-4 h-4" />
            <span>Rule 2: Footage in ~/Movies</span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            CapCut's sandbox cannot read outside <code className="text-neutral-200">~/Movies</code>. The bridge hardlinks media into <code className="text-neutral-200">Resources/</code>.
          </p>
        </div>

        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-medium text-xs">
            <RefreshCw className="w-4 h-4" />
            <span>Rule 3: Wipe Timelines/ Cache</span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            CapCut prioritizes its native cache over disk files. Wiping <code className="text-neutral-200">Timelines/</code> forces re-import.
          </p>
        </div>

        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-blue-400 font-medium text-xs">
            <Wrench className="w-4 h-4" />
            <span>Rule 4: Additive Only Once Edited</span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Use <code className="text-neutral-200">add-overlay</code> and <code className="text-neutral-200">add-text</code> after manual edits. <code className="text-neutral-200">replay</code> rebuilds from scratch.
          </p>
        </div>

        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-purple-400 font-medium text-xs">
            <ShieldCheck className="w-4 h-4" />
            <span>Rule 5: Null Timerange Repair</span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            <code className="text-neutral-200">source_timerange: null</code> crashes CapCut's encoder during export. Bridge repairs each segment.
          </p>
        </div>

        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-medium text-xs">
            <CheckCircle className="w-4 h-4" />
            <span>Rule 6: Modal Export Clearance</span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Auto-dismisses the post-export "Share to TikTok/YouTube" modal without publishing.
          </p>
        </div>
      </div>

      {/* Interactive JSON Inspector & Fixer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input Textarea */}
        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>Paste Draft JSON to Audit</span>
            </span>
            <button
              onClick={runAudit}
              className="px-3 py-1 text-xs font-medium text-black bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors cursor-pointer"
            >
              Run Audit & Auto-Fix
            </button>
          </div>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            rows={14}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs font-mono text-neutral-200 focus:outline-none focus:border-emerald-500 leading-relaxed"
          />
        </div>

        {/* Right: Results & Repaired Output */}
        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <span className="text-xs font-semibold text-white">Diagnostic Results</span>
            {auditResults?.cleanJson && (
              <button
                onClick={handleDownloadRepaired}
                className="px-2.5 py-1 text-xs font-medium text-white bg-neutral-800 hover:bg-neutral-700 rounded border border-neutral-700 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3 text-emerald-400" />
                <span>Save Repaired JSON</span>
              </button>
            )}
          </div>

          {!auditResults ? (
            <div className="py-16 text-center text-xs text-neutral-500">
              Click "Run Audit & Auto-Fix" to scan the JSON against CapCut's engine constraints.
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Finding 1 */}
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg flex items-start gap-3">
                {auditResults.nullTimeranges > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-medium text-white">
                    {auditResults.nullTimeranges > 0
                      ? `Detected ${auditResults.nullTimeranges} Null Source Timeranges (Fixed!)`
                      : 'All Source Timeranges Safe'}
                  </div>
                  <p className="text-neutral-400 text-[11px] mt-0.5">
                    {auditResults.nullTimeranges > 0
                      ? 'Text segments have been populated with default start: 0, preventing encoder wedging during export.'
                      : 'No export-blocking null timeranges found.'}
                  </p>
                </div>
              </div>

              {/* Finding 2 */}
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg flex items-start gap-3">
                {auditResults.sandboxIssues.length > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-medium text-white">
                    {auditResults.sandboxIssues.length > 0
                      ? `${auditResults.sandboxIssues.length} Media Path(s) Outside ~/Movies`
                      : 'Sandbox Path Compliance Verified'}
                  </div>
                  <p className="text-neutral-400 text-[11px] mt-0.5">
                    {auditResults.sandboxIssues.length > 0
                      ? `Found paths like "${auditResults.sandboxIssues[0]}". The bridge will hardlink these into Resources/ automatically.`
                      : 'Footage paths conform to macOS CapCut sandbox security limits.'}
                  </p>
                </div>
              </div>

              {/* Repaired JSON Preview */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-mono text-neutral-400">Repaired & Sanitized Draft Snippet:</span>
                <pre className="p-3 bg-black border border-neutral-800 rounded-lg font-mono text-[11px] text-emerald-400 max-h-48 overflow-x-auto">
                  {auditResults.cleanJson}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
