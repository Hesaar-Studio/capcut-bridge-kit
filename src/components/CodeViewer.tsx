import React, { useState } from 'react';
import { Copy, Check, Download, FileCode, Search, Terminal } from 'lucide-react';
import {
  CAPCUT_BRIDGE_PY,
  CAPCUT_BRIDGE_WIN_PY,
  INSTALL_PLUGIN_WIN_BAT,
  CAPCUT_PLUGIN_WIN_PY,
  INPUT_CONTRACT_MD,
  TEXT_MATERIAL_JSON,
  TEXT_SEGMENT_JSON,
  TEXT_ANIMATIONS_JSON,
  SAMPLE_CUTS_JSON,
  SAMPLE_GRAPHICS_PLAN_JSON,
} from '../data/bridgeSource';

const FILES = [
  { id: 'py_win', name: 'capcut-bridge-win.py', lang: 'python', content: CAPCUT_BRIDGE_WIN_PY, desc: 'Windows edition with pyautogui & Windows draft paths' },
  { id: 'plugin_win', name: 'capcut-plugin-win.py', lang: 'python', content: CAPCUT_PLUGIN_WIN_PY, desc: 'Windows Local REST Plugin Server & HTTP daemon (Port 8765)' },
  { id: 'bat_win', name: 'install-plugin-win.bat', lang: 'bat', content: INSTALL_PLUGIN_WIN_BAT, desc: 'Windows One-Click Automated Plugin & PATH Installer' },
  { id: 'py', name: 'capcut-bridge.py', lang: 'python', content: CAPCUT_BRIDGE_PY, desc: 'Complete macOS bridge script (PEP 723, PyObjC)' },
  { id: 'contract', name: 'INPUT-CONTRACT.md', lang: 'markdown', content: INPUT_CONTRACT_MD, desc: 'Cuts & Graphics Plan JSON schema contract' },
  { id: 'tpl_mat', name: 'text-material.json', lang: 'json', content: TEXT_MATERIAL_JSON, desc: 'CapCut text style material stub' },
  { id: 'tpl_seg', name: 'text-segment.json', lang: 'json', content: TEXT_SEGMENT_JSON, desc: 'CapCut text segment with repaired timerange' },
  { id: 'tpl_anim', name: 'text-ref-material_animations.json', lang: 'json', content: TEXT_ANIMATIONS_JSON, desc: 'In/Out animation material reference' },
  { id: 'cuts', name: 'sample-cuts.json', lang: 'json', content: SAMPLE_CUTS_JSON, desc: 'EDL cut list for replay command' },
  { id: 'graphics', name: 'sample-graphics-plan.json', lang: 'json', content: SAMPLE_GRAPHICS_PLAN_JSON, desc: 'Batch graphics plan for graphics command' },
];

export const CodeViewer: React.FC = () => {
  const [selectedFileId, setSelectedFileId] = useState('py');
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const currentFile = FILES.find((f) => f.id === selectedFileId) || FILES[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (file: typeof currentFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Line numbering
  const lines = currentFile.content.split('\n');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white">Source Code & Templates</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Production-ready script with PEP 723 inline dependencies header, accessibility hooks, and template stubs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownload(currentFile)}
            className="px-3 py-1.5 text-xs font-medium text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download {currentFile.name}</span>
          </button>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium text-black bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>
        </div>
      </div>

      {/* Workspace: File Tree and Code Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: File Catalog */}
        <div className="lg:col-span-4 space-y-2">
          <span className="text-xs font-medium text-neutral-400 tracking-wider">PROJECT FILES</span>
          <div className="space-y-1.5 mt-2">
            {FILES.map((file) => {
              const isSelected = file.id === currentFile.id;
              return (
                <button
                  key={file.id}
                  onClick={() => setSelectedFileId(file.id)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-neutral-900 border-neutral-700 text-white shadow-sm'
                      : 'bg-neutral-950 border-neutral-900 text-neutral-400 hover:bg-neutral-900/60 hover:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileCode className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-neutral-500'}`} />
                    <span className="font-mono text-xs font-semibold text-neutral-200">{file.name}</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1">{file.desc}</p>
                </button>
              );
            })}
          </div>

          {/* UV installation reminder */}
          <div className="p-3.5 bg-neutral-900/60 border border-neutral-800 rounded-lg text-xs space-y-2 mt-4">
            <span className="font-mono text-emerald-400 font-medium flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              <span>Zero-Config uv Execution</span>
            </span>
            <p className="text-neutral-400 text-[11px] leading-relaxed">
              No virtual environment or pip installation required. The script's PEP 723 metadata header auto-installs PyObjC dependencies:
            </p>
            <div className="p-2 bg-black rounded font-mono text-[11px] text-neutral-300 border border-neutral-800 select-all">
              uv run capcut-bridge.py --help
            </div>
          </div>
        </div>

        {/* Right Code Display */}
        <div className="lg:col-span-8 bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden flex flex-col">
          {/* File Tab Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900/80 border-b border-neutral-800 text-xs font-mono">
            <div className="flex items-center gap-2 text-neutral-300">
              <span className="text-emerald-400 font-semibold">{currentFile.name}</span>
              <span className="text-neutral-600">·</span>
              <span className="text-neutral-400">{lines.length} lines</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3 h-3 text-neutral-500 absolute left-2 top-2" />
                <input
                  type="text"
                  placeholder="Find in file..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded px-2 pl-6 py-1 text-[11px] text-neutral-300 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Code Viewer with Line Numbers */}
          <div className="overflow-x-auto max-h-[580px] p-4 text-xs font-mono leading-relaxed bg-black/60">
            <pre className="table">
              {lines.map((line, idx) => {
                const lineNum = idx + 1;
                const matches = searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase());
                return (
                  <div
                    key={idx}
                    className={`table-row ${matches ? 'bg-emerald-950/60' : 'hover:bg-neutral-900/40'}`}
                  >
                    <span className="table-cell select-none text-right pr-4 text-neutral-600 font-mono text-[11px] w-12">
                      {lineNum}
                    </span>
                    <span className="table-cell whitespace-pre text-neutral-300">
                      {line}
                    </span>
                  </div>
                );
              })}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
