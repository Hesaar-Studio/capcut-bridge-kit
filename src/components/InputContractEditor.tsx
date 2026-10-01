import React, { useState } from 'react';
import { Plus, Trash2, Download, Copy, Check, Terminal, ExternalLink, Sparkles, BookOpen } from 'lucide-react';
import { CutItem, GraphicsElement } from '../types';

export const InputContractEditor: React.FC = () => {
  const [subTab, setSubTab] = useState<'cuts' | 'graphics' | 'kie' | 'persian'>('cuts');
  const [copied, setCopied] = useState(false);

  // Cuts state
  const [draftName, setDraftName] = useState('Hook_Promo_V1');
  const [cuts, setCuts] = useState<CutItem[]>([
    { id: '1', source_path: '/Users/username/Movies/Takes/take1.mov', start: 0.0, duration: 2.4, width: 1080, height: 1920, label: 'Intro Hook' },
    { id: '2', source_path: '/Users/username/Movies/Takes/take2.mov', start: 1.5, duration: 3.2, width: 1080, height: 1920, label: 'Problem Statement' },
    { id: '3', source_path: '/Users/username/Movies/Takes/take3.mov', start: 0.0, duration: 4.1, width: 1080, height: 1920, label: 'Feature Demo' },
  ]);

  // Graphics Plan state
  const [elements, setElements] = useState<GraphicsElement[]>([
    { id: 'g1', type: 'text', text: 'STOP SCROLLING 🚨', start: 0.2, duration: 2.0, style: 'tiktok-raw', color: '#ffffff', font_size: 34, position: { x: 0, y: -0.32 } },
    { id: 'g2', type: 'text', text: '3 CapCut Automation Tricks', start: 2.2, duration: 3.0, style: 'captions', color: '#ffd700', font_size: 26, position: { x: 0, y: -0.35 } },
  ]);

  // Kie AI params
  const [kieModel, setKieModel] = useState('kling/video-generator');
  const [kiePrompt, setKiePrompt] = useState('Cinematic vertical shot of modern laptop editing 4k video, soft studio lighting');
  const [kieApiKey, setKieApiKey] = useState('YOUR_KIE_AI_KEY');

  const addCut = () => {
    setCuts((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        source_path: `/Users/username/Movies/Takes/take${prev.length + 1}.mov`,
        start: 0.0,
        duration: 3.0,
        width: 1080,
        height: 1920,
        label: `Cut ${prev.length + 1}`,
      },
    ]);
  };

  const removeCut = (id: string) => {
    setCuts((prev) => prev.filter((c) => c.id !== id));
  };

  const addElement = () => {
    setElements((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        type: 'text',
        text: 'New Caption',
        start: 5.5,
        duration: 2.5,
        style: 'tiktok-raw',
        color: '#ffffff',
        font_size: 28,
        position: { x: 0, y: -0.32 },
      },
    ]);
  };

  const removeElement = (id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id));
  };

  const generatedCutsJson = JSON.stringify(
    {
      draft_name: draftName,
      resolution: { width: 1080, height: 1920, ratio: '9:16' },
      fps: 30.0,
      cuts: cuts.map(({ source_path, start, duration, width, height }) => ({
        source_path,
        start,
        duration,
        width,
        height,
      })),
    },
    null,
    2
  );

  const generatedGraphicsJson = JSON.stringify({ elements }, null, 2);

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Kie AI direct curl strings
  const kieCurlCreate = `curl -X POST https://api.kie.ai/api/v1/jobs/createTask \\
  -H "Authorization: Bearer ${kieApiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${kieModel}",
    "input": {
      "prompt": "${kiePrompt}",
      "aspect_ratio": "9:16"
    }
  }'`;

  const kieCurlPoll = `curl -X GET "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=TASK_ID_HERE" \\
  -H "Authorization: Bearer ${kieApiKey}"`;

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white">Input Contracts & Guides</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Build and validate <code className="text-neutral-300">cuts.json</code>, <code className="text-neutral-300">graphics-plan.json</code>, Kie AI REST pipelines, and prompt guides.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-lg">
          <button
            onClick={() => setSubTab('cuts')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              subTab === 'cuts' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            cuts.json (EDL)
          </button>
          <button
            onClick={() => setSubTab('graphics')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              subTab === 'graphics' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            graphics-plan.json
          </button>
          <button
            onClick={() => setSubTab('kie')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              subTab === 'kie' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Kie AI REST (Direct)
          </button>
          <button
            onClick={() => setSubTab('persian')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
              subTab === 'persian' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>راهنما و پرامپت فارسی</span>
          </button>
        </div>
      </div>

      {/* Subtab 1: cuts.json */}
      {subTab === 'cuts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Draft & Clip Sequence</span>
                <button
                  onClick={addCut}
                  className="px-2.5 py-1 text-xs font-medium text-emerald-400 bg-neutral-800 hover:bg-neutral-700 rounded border border-neutral-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Cut Clip</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">Target Draft Name</label>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="space-y-3 pt-2">
                {cuts.map((cut, idx) => (
                  <div key={cut.id} className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-emerald-400">
                        Cut #{idx + 1}: {cut.label || 'Take'}
                      </span>
                      <button
                        onClick={() => removeCut(cut.id)}
                        className="text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <label className="text-[11px] text-neutral-400">Source Path (under ~/Movies)</label>
                        <input
                          type="text"
                          value={cut.source_path}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCuts((prev) => prev.map((c) => (c.id === cut.id ? { ...c, source_path: val } : c)));
                          }}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 font-mono mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-neutral-400">Duration (s)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={cut.duration}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setCuts((prev) => prev.map((c) => (c.id === cut.id ? { ...c, duration: val } : c)));
                          }}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 font-mono mt-0.5"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-neutral-400">Generated cuts.json</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadJson('cuts.json', generatedCutsJson)}
                    className="px-2 py-1 text-xs text-white bg-neutral-800 hover:bg-neutral-700 rounded transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-emerald-400" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={() => handleCopyText(generatedCutsJson)}
                    className="px-2 py-1 text-xs text-black bg-emerald-400 hover:bg-emerald-300 rounded transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
              <pre className="font-mono text-xs text-neutral-300 bg-neutral-900 p-3 rounded-lg overflow-x-auto max-h-96 leading-relaxed">
                {generatedCutsJson}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 2: graphics-plan.json */}
      {subTab === 'graphics' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Graphics & Captions Sequence</span>
                <button
                  onClick={addElement}
                  className="px-2.5 py-1 text-xs font-medium text-emerald-400 bg-neutral-800 hover:bg-neutral-700 rounded border border-neutral-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Caption Element</span>
                </button>
              </div>

              <div className="space-y-3">
                {elements.map((elem, idx) => (
                  <div key={elem.id} className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-amber-400">
                        Element #{idx + 1} ({elem.type})
                      </span>
                      <button
                        onClick={() => removeElement(elem.id)}
                        className="text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="text-[11px] text-neutral-400">Caption Text</label>
                        <input
                          type="text"
                          value={elem.text || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setElements((prev) => prev.map((item) => (item.id === elem.id ? { ...item, text: val } : item)));
                          }}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 mt-0.5"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] text-neutral-400">Start (s)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={elem.start}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setElements((prev) => prev.map((item) => (item.id === elem.id ? { ...item, start: val } : item)));
                            }}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 font-mono mt-0.5"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-neutral-400">Duration (s)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={elem.duration}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setElements((prev) => prev.map((item) => (item.id === elem.id ? { ...item, duration: val } : item)));
                            }}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 font-mono mt-0.5"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-neutral-400">Style</label>
                          <select
                            value={elem.style || 'tiktok-raw'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setElements((prev) => prev.map((item) => (item.id === elem.id ? { ...item, style: val } : item)));
                            }}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 mt-0.5"
                          >
                            <option value="tiktok-raw">TikTok Raw</option>
                            <option value="captions">Boxed Captions</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-neutral-400">Generated graphics-plan.json</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadJson('graphics-plan.json', generatedGraphicsJson)}
                    className="px-2 py-1 text-xs text-white bg-neutral-800 hover:bg-neutral-700 rounded transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-emerald-400" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={() => handleCopyText(generatedGraphicsJson)}
                    className="px-2 py-1 text-xs text-black bg-emerald-400 hover:bg-emerald-300 rounded transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
              <pre className="font-mono text-xs text-neutral-300 bg-neutral-900 p-3 rounded-lg overflow-x-auto max-h-96 leading-relaxed">
                {generatedGraphicsJson}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 3: Kie AI Direct REST */}
      {subTab === 'kie' && (
        <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Kie AI Direct REST API Generator (Bypassing MCP Tool Block)</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Notice: The <code className="text-neutral-300">mcp__kie-ai__*</code> MCP tools fail with <code className="text-red-400">"Host declined the approval request"</code> even with valid balance. Hard Rule 7 mandates calling Kie AI's REST endpoints directly with <code className="text-emerald-400">curl</code>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-neutral-300">Kie AI Model</label>
              <input
                type="text"
                value={kieModel}
                onChange={(e) => setKieModel(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-300">API Key</label>
              <input
                type="text"
                value={kieApiKey}
                onChange={(e) => setKieApiKey(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-300">Prompt Text</label>
              <input
                type="text"
                value={kiePrompt}
                onChange={(e) => setKiePrompt(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono mt-1"
              />
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400 pb-1">
                <span>1. Create Task (POST /createTask)</span>
                <button
                  onClick={() => handleCopyText(kieCurlCreate)}
                  className="text-emerald-400 hover:underline cursor-pointer"
                >
                  Copy Curl
                </button>
              </div>
              <pre className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto select-all">
                {kieCurlCreate}
              </pre>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400 pb-1">
                <span>2. Poll Status (GET /recordInfo?taskId=...)</span>
                <button
                  onClick={() => handleCopyText(kieCurlPoll)}
                  className="text-emerald-400 hover:underline cursor-pointer"
                >
                  Copy Curl
                </button>
              </div>
              <pre className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto select-all">
                {kieCurlPoll}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 4: Persian Prompt & Guide */}
      {subTab === 'persian' && (
        <div className="p-6 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-6" dir="rtl">
          <div>
            <h3 className="text-base font-semibold text-white">راهنما و پرامپت آماده CapCut Bridge Kit</h3>
            <p className="text-xs text-neutral-400 mt-1">
              متن کامل پرامپت پیشنهادی و دستورالعمل اجرایی برای راه‌اندازی اتوماسیون کپکات دسکتاپ در سیستم‌عامل macOS:
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span className="font-semibold text-neutral-200">پرامپت پیشنهادی تولید سورس‌کد:</span>
              <button
                onClick={() =>
                  handleCopyText(
                    `من مستندات و راهنمای کامل یک ابزار پایتون به نام CapCut Bridge Kit را دارم که برای اتصال اتوماتیک اسکریپت‌ها به نرم‌افزار دسکتاپ کپکات در macOS نوشته شده است.\n\nلطفاً بر اساس اطلاعات و دستورات زیر، سورس‌کد کامل فایل اصلی capcut-bridge.py را با تمام دستورات ذکر شده (File Lane و Live Lane مثل replay, add-text, add-overlay, export, split, و غیره) و با استفاده از کتابخانه‌های pyobjc-framework-ApplicationServices و pyobjc-framework-Quartz به صورت تمیز و استاندارد (همراه با هدر اسکریپت uv) برای من بنویس.`
                  )
                }
                className="px-2.5 py-1 text-xs text-black bg-emerald-400 hover:bg-emerald-300 rounded transition-colors cursor-pointer"
              >
                کپی پرامپت
              </button>
            </div>
            <div className="p-4 bg-black border border-neutral-800 rounded-lg text-xs font-sans text-neutral-200 leading-relaxed select-all">
              "من مستندات و راهنمای کامل یک ابزار پایتون به نام CapCut Bridge Kit را دارم که برای اتصال اتوماتیک اسکریپت‌ها به نرم‌افزار دسکتاپ کپکات در macOS نوشته شده است.
              <br /><br />
              لطفاً بر اساس اطلاعات و دستورات زیر، سورس‌کد کامل فایل اصلی capcut-bridge.py را با تمام دستورات ذکر شده (File Lane و Live Lane مثل replay, add-text, add-overlay, export, split, و غیره) و با استفاده از کتابخانه‌های pyobjc-framework-ApplicationServices و pyobjc-framework-Quartz به صورت تمیز و استاندارد (همراه با هدر اسکریپت uv) برای من بنویس."
            </div>
          </div>

          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-lg space-y-3" dir="ltr">
            <span className="text-xs font-mono font-semibold text-emerald-400 block" dir="rtl">
              مراحل نصب و اجرا در مک (Quick Start):
            </span>
            <div className="space-y-2 text-xs font-mono text-neutral-300">
              <div className="p-2 bg-neutral-900 rounded"># 1. Install uv package runner</div>
              <div className="p-2 bg-black rounded text-emerald-400 select-all">brew install uv</div>
              <div className="p-2 bg-neutral-900 rounded"># 2. Run CapCut bridge directly (dependencies auto-install)</div>
              <div className="p-2 bg-black rounded text-emerald-400 select-all">uv run capcut-bridge.py ls</div>
              <div className="p-2 bg-neutral-900 rounded"># 3. Grant Accessibility Permissions:</div>
              <div className="p-2 bg-neutral-900 text-neutral-400">
                System Settings → Privacy & Security → Accessibility → Enable Terminal / iTerm / VSCode
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
