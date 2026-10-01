import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Scissors,
  Trash2,
  Download,
  Share2,
  Sparkles,
  Layers,
  Film,
  Type,
  Music,
  Settings,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  Maximize2,
  SkipBack,
  SkipForward,
  RotateCcw,
  Zap,
  Cpu,
  Monitor,
  Check,
  X
} from 'lucide-react';
import { Platform } from '../types';

interface CapCutStudioProps {
  platform: Platform;
  onOpenDocs?: () => void;
}

interface TimelineClip {
  id: string;
  track: 'text' | 'overlay' | 'main' | 'audio';
  title: string;
  start: number; // in seconds
  duration: number; // in seconds
  color: string;
  aiGenerated?: boolean;
  metadata?: {
    text?: string;
    style?: string;
    sourcePath?: string;
    scale?: number;
    posX?: number;
    posY?: number;
  };
}

export const CapCutStudio: React.FC<CapCutStudioProps> = ({ platform, onOpenDocs }) => {
  // Navigation inside CapCut
  const [leftTab, setLeftTab] = useState<'ai' | 'media' | 'text' | 'audio' | 'bridge'>('ai');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(2.4);
  const totalDuration = 14.0; // 14 seconds reel
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [selectedClipId, setSelectedClipId] = useState<string>('c1');

  // AI Pipeline inputs
  const [aiPrompt, setAiPrompt] = useState(
    'ویدیوی وایرال معرفی امکانات اتوماسیون هوش مصنوعی در کپکات دسکتاپ با هوک جذاب و زیرنویس پاپ‌آپ زرد'
  );
  const [aiPreset, setAiPreset] = useState<'viral_hook' | 'product_teaser' | 'explainer'>('viral_hook');
  const [aiModel, setAiModel] = useState('Kie AI / Kling v1.5');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiStep, setAiStep] = useState<number>(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportDone, setExportDone] = useState(false);
  const [shareModalDismissed, setShareModalDismissed] = useState(false);

  // Inspector transform state
  const [scale, setScale] = useState(1.0);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(-0.32);

  // Timeline Clips
  const [clips, setClips] = useState<TimelineClip[]>([
    {
      id: 't1',
      track: 'text',
      title: 'هوش مصنوعی کپکات فعال شد 🔥',
      start: 0.2,
      duration: 2.2,
      color: 'bg-amber-500/80 border-amber-400 text-white',
      aiGenerated: true,
      metadata: { text: 'هوش مصنوعی کپکات فعال شد 🔥', style: 'tiktok-raw', posY: -0.32 }
    },
    {
      id: 't2',
      track: 'text',
      title: 'خداحافظی با ادیت دستی در ۲۰۲۶',
      start: 2.5,
      duration: 3.4,
      color: 'bg-amber-600/80 border-amber-400 text-white',
      aiGenerated: true,
      metadata: { text: 'خداحافظی با ادیت دستی در ۲۰۲۶', style: 'captions', posY: -0.35 }
    },
    {
      id: 't3',
      track: 'text',
      title: 'اتصال مستقیم AI به تایم‌لاین ⚡',
      start: 6.2,
      duration: 3.8,
      color: 'bg-amber-500/80 border-amber-400 text-white',
      aiGenerated: true,
      metadata: { text: 'اتصال مستقیم AI به تایم‌لاین ⚡', style: 'tiktok-raw', posY: -0.32 }
    },
    {
      id: 'ov1',
      track: 'overlay',
      title: 'ai_broll_kling_render.mp4',
      start: 2.6,
      duration: 3.8,
      color: 'bg-purple-600/80 border-purple-400 text-white',
      aiGenerated: true,
      metadata: { sourcePath: 'C:\\Users\\User\\Videos\\ai_broll.mp4', scale: 1.15 }
    },
    {
      id: 'c1',
      track: 'main',
      title: 'take1_hook_presenter.mp4',
      start: 0.0,
      duration: 2.5,
      color: 'bg-teal-700/80 border-teal-500 text-white',
      aiGenerated: false,
      metadata: { sourcePath: 'C:\\Users\\User\\Videos\\take1.mp4' }
    },
    {
      id: 'c2',
      track: 'main',
      title: 'take2_screen_demo.mp4',
      start: 2.5,
      duration: 4.2,
      color: 'bg-teal-800/80 border-teal-500 text-white',
      aiGenerated: false,
      metadata: { sourcePath: 'C:\\Users\\User\\Videos\\take2.mp4' }
    },
    {
      id: 'c3',
      track: 'main',
      title: 'take3_ai_workflow.mp4',
      start: 6.7,
      duration: 4.5,
      color: 'bg-teal-700/80 border-teal-500 text-white',
      aiGenerated: true,
      metadata: { sourcePath: 'C:\\Users\\User\\Videos\\take3.mp4' }
    },
    {
      id: 'c4',
      track: 'main',
      title: 'take4_call_to_action.mp4',
      start: 11.2,
      duration: 2.8,
      color: 'bg-teal-900/80 border-teal-500 text-white',
      aiGenerated: false,
      metadata: { sourcePath: 'C:\\Users\\User\\Videos\\take4.mp4' }
    },
    {
      id: 'a1',
      track: 'audio',
      title: 'elevenlabs_ai_voiceover.wav',
      start: 0.0,
      duration: 13.5,
      color: 'bg-emerald-600/80 border-emerald-400 text-white',
      aiGenerated: true,
      metadata: { sourcePath: 'C:\\Users\\User\\Music\\voiceover.wav' }
    }
  ]);

  // Active clip selection
  const selectedClip = clips.find((c) => c.id === selectedClipId) || clips[0];

  // Playback timer
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return Math.min(totalDuration, prev + 0.05);
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Format timecode
  const formatTimecode = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const frames = Math.floor((sec % 1) * 30);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  // Find active caption under playhead
  const activeCaption = clips.find(
    (c) => c.track === 'text' && currentTime >= c.start && currentTime <= c.start + c.duration
  );

  // Split clip at playhead
  const handleSplit = () => {
    const targetIdx = clips.findIndex(
      (c) => c.track === 'main' && currentTime > c.start && currentTime < c.start + c.duration
    );
    if (targetIdx === -1) return;

    const target = clips[targetIdx];
    const cutPoint = currentTime - target.start;

    const left: TimelineClip = {
      ...target,
      id: `${target.id}_part1`,
      duration: cutPoint
    };

    const right: TimelineClip = {
      ...target,
      id: `${target.id}_part2`,
      title: `${target.title} (Split)`,
      start: currentTime,
      duration: target.duration - cutPoint
    };

    const nextClips = [...clips];
    nextClips.splice(targetIdx, 1, left, right);
    setClips(nextClips);
    setSelectedClipId(right.id);
  };

  // Delete selected clip
  const handleDelete = () => {
    if (clips.length <= 1) return;
    setClips((prev) => prev.filter((c) => c.id !== selectedClipId));
    setSelectedClipId(clips[0].id);
  };

  // Run AI Pipeline to CapCut Bridge Injection
  const handleTriggerAiPipeline = () => {
    setIsAiGenerating(true);
    setAiStep(1);

    setTimeout(() => setAiStep(2), 700);
    setTimeout(() => setAiStep(3), 1400);
    setTimeout(() => {
      setAiStep(4);
      // Inject new AI generated segment and subtitles
      const newAiClip: TimelineClip = {
        id: `ai_gen_${Date.now()}`,
        track: 'overlay',
        title: 'kling_ai_cyber_broll.mp4',
        start: 7.0,
        duration: 3.5,
        color: 'bg-purple-600/90 border-purple-300 text-white',
        aiGenerated: true,
        metadata: {
          sourcePath: platform === 'win' ? 'C:\\Users\\User\\Videos\\ai_gen.mp4' : '~/Movies/ai_gen.mp4',
          scale: 1.2
        }
      };

      const newAiText: TimelineClip = {
        id: `ai_txt_${Date.now()}`,
        track: 'text',
        title: 'تولید شده با هوش مصنوعی ✨',
        start: 7.2,
        duration: 3.2,
        color: 'bg-amber-400 border-amber-300 text-black font-bold',
        aiGenerated: true,
        metadata: { text: 'تولید شده با هوش مصنوعی ✨', style: 'tiktok-raw', posY: -0.32 }
      };

      setClips((prev) => [...prev, newAiClip, newAiText]);
      setIsAiGenerating(false);
      setSelectedClipId(newAiClip.id);
    }, 2200);
  };

  // Handle Export Flow
  const startExport = () => {
    setShowExportModal(true);
    setExportProgress(0);
    setExportDone(false);
    setShareModalDismissed(false);

    let p = 0;
    const interval = setInterval(() => {
      p += 15;
      if (p >= 100) {
        clearInterval(interval);
        setExportProgress(100);
        setExportDone(true);
        // Hard Rule 6 auto dismiss simulation
        setTimeout(() => {
          setShareModalDismissed(true);
        }, 800);
      } else {
        setExportProgress(p);
      }
    }, 180);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] min-h-[750px] bg-[#121214] text-neutral-200 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl select-none font-sans">
      {/* 1. TOP CAPCUT TITLE BAR */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#18181b] border-b border-neutral-800 text-xs shrink-0">
        {/* Left: CapCut Brand & Project Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-tr from-cyan-400 to-teal-400 flex items-center justify-center text-black font-black text-xs">
              C
            </div>
            <span className="font-semibold text-white tracking-tight">CapCut Pro Studio</span>
          </div>

          <span className="text-neutral-600">|</span>

          {/* Project title */}
          <div className="flex items-center gap-2 text-neutral-300">
            <span className="font-medium text-white">Viral_Reel_AI_01</span>
            <span className="text-[11px] text-neutral-400 font-mono">1080×1920 (9:16) · 30fps</span>
          </div>
        </div>

        {/* Center: This panel is a UI demo, not a live CapCut connection. */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[#1f1f23] rounded-md border border-neutral-700">
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <span className="text-cyan-400 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Pipeline Demo</span>
            </span>
            <ArrowRight className="w-3 h-3 text-neutral-500" />
            <span className="text-amber-300 font-semibold flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              <span>Preview only · no live CapCut link</span>
            </span>
          </div>
          <span className="w-2 h-2 rounded-full bg-amber-300 ml-1" />
        </div>

        {/* Right: Export Button & Platform Indicator */}
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-mono text-neutral-400 px-2 py-0.5 bg-neutral-900 rounded border border-neutral-800">
            OS: {platform === 'win' ? 'Windows (pyautogui)' : 'macOS (Quartz)'}
          </span>
          <button
            onClick={startExport}
            className="px-4 py-1.5 text-xs font-semibold text-black bg-[#00f5d4] hover:bg-[#00dfc0] transition-colors rounded-md flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Preview</span>
          </button>
        </div>
      </div>

      {/* 2. TOP EDITING PANELS (Left: AI & Media | Center: Player | Right: Inspector) */}
      <div className="grid grid-cols-12 flex-1 min-h-0 bg-[#141416] divide-x divide-neutral-800">
        {/* LEFT COLUMN: CAPCUT TABS (AI, Media, Text, Audio, Bridge) */}
        <div className="col-span-12 lg:col-span-4 flex flex-col min-h-0 bg-[#161619]">
          {/* CapCut Sub-tabs Header */}
          <div className="flex items-center border-b border-neutral-800 px-2 pt-2 bg-[#18181b] gap-1 overflow-x-auto">
            <button
              onClick={() => setLeftTab('ai')}
              className={`px-3 py-2 text-xs font-medium rounded-t flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                leftTab === 'ai'
                  ? 'border-cyan-400 text-white bg-[#202024]'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>پایپ‌لاین هوش مصنوعی</span>
            </button>
            <button
              onClick={() => setLeftTab('media')}
              className={`px-3 py-2 text-xs font-medium rounded-t flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                leftTab === 'media'
                  ? 'border-cyan-400 text-white bg-[#202024]'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-neutral-400" />
              <span>Media</span>
            </button>
            <button
              onClick={() => setLeftTab('text')}
              className={`px-3 py-2 text-xs font-medium rounded-t flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                leftTab === 'text'
                  ? 'border-cyan-400 text-white bg-[#202024]'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Type className="w-3.5 h-3.5 text-neutral-400" />
              <span>Text & Captions</span>
            </button>
            <button
              onClick={() => setLeftTab('bridge')}
              className={`px-3 py-2 text-xs font-medium rounded-t flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                leftTab === 'bridge'
                  ? 'border-cyan-400 text-white bg-[#202024]'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-neutral-400" />
              <span>پل ارتباطی (Bridge)</span>
            </button>
          </div>

          {/* Tab 1: AI Pipeline & Direct Generator */}
          {leftTab === 'ai' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Architecture Link Flow */}
              <div className="p-3 bg-[#1d1d21] border border-neutral-700/60 rounded-lg space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold block">
                  نقشه ارتباط هوش مصنوعی با تایم‌لاین کپکات
                </span>
                <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-mono">
                  <div className="p-2 bg-[#25252b] rounded border border-neutral-700">
                    <span className="text-neutral-300 block font-semibold">۱. پرامپت</span>
                    <span className="text-neutral-500 text-[9px]">ایده و سناریو</span>
                  </div>
                  <div className="p-2 bg-[#25252b] rounded border border-neutral-700">
                    <span className="text-cyan-300 block font-semibold">۲. هوش مصنوعی</span>
                    <span className="text-neutral-500 text-[9px]">Kling/Kie/Voice</span>
                  </div>
                  <div className="p-2 bg-[#25252b] rounded border border-neutral-700">
                    <span className="text-amber-300 block font-semibold">۳. مترجم JSON</span>
                    <span className="text-neutral-500 text-[9px]">Cuts & Captions</span>
                  </div>
                  <div className="p-2 bg-[#25252b] rounded border border-cyan-500/50 text-emerald-400">
                    <span className="block font-semibold">۴. تزریق دیسک</span>
                    <span className="text-neutral-400 text-[9px]">CapCut Draft</span>
                  </div>
                </div>
              </div>

              {/* Prompt Box */}
              <div className="space-y-1.5" dir="rtl">
                <label className="text-xs font-medium text-neutral-300 flex items-center justify-between">
                  <span>سناریو یا پرامپت تولید خودکار:</span>
                  <span className="text-[11px] text-cyan-400 font-mono">AI Generator v2.4</span>
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-[#121214] border border-neutral-700 rounded-lg p-2.5 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500 leading-relaxed font-sans"
                />
              </div>

              {/* AI Presets & Settings */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">قالب آماده (Preset)</label>
                  <select
                    value={aiPreset}
                    onChange={(e: any) => setAiPreset(e.target.value)}
                    className="w-full bg-[#121214] border border-neutral-700 rounded p-1.5 text-xs text-neutral-200 focus:outline-none"
                  >
                    <option value="viral_hook">هوک وایرال تیک‌تاک (Pop-In)</option>
                    <option value="product_teaser">تیزر معرفی محصول</option>
                    <option value="explainer">ویدیو آموزشی کوتاه</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">موتور هوش مصنوعی</label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full bg-[#121214] border border-neutral-700 rounded p-1.5 text-xs text-neutral-200 focus:outline-none"
                  >
                    <option value="Kie AI / Kling v1.5">Kling AI Video (Kie REST)</option>
                    <option value="Gemini MultiModal">Gemini MultiModal EDL</option>
                    <option value="ElevenLabs">ElevenLabs AI Voice</option>
                  </select>
                </div>
              </div>

              {/* Direct Inject Button */}
              <div className="pt-2">
                <button
                  onClick={handleTriggerAiPipeline}
                  disabled={isAiGenerating}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-black font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 fill-black" />
                  <span>
                    {isAiGenerating
                      ? 'در حال پردازش و تزریق مستقیم به کپکات...'
                      : 'تزریق مستقیم به تایم‌لاین کپکات (Inject to CapCut)'}
                  </span>
                </button>
              </div>

              {/* Pipeline Progress Stages */}
              {isAiGenerating && (
                <div className="p-3 bg-[#121214] border border-cyan-500/40 rounded-lg space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-cyan-400">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>اتوماسیون فعال CapCut Bridge</span>
                    </span>
                    <span>مرحله {aiStep} از ۴</span>
                  </div>
                  <div className="space-y-1 text-[11px] text-neutral-400">
                    <div className={aiStep >= 1 ? 'text-white' : 'text-neutral-600'}>
                      ✔ ۱. تولید متن سناریو و کات‌های هوشمند با هوش مصنوعی
                    </div>
                    <div className={aiStep >= 2 ? 'text-white' : 'text-neutral-600'}>
                      ✔ ۲. تولید رندر ویدیو با مدل {aiModel}
                    </div>
                    <div className={aiStep >= 3 ? 'text-white' : 'text-neutral-600'}>
                      ✔ ۳. بستن ایمن فرآیند کپکات و پاکسازی کش Timelines/
                    </div>
                    <div className={aiStep >= 4 ? 'text-emerald-400 font-semibold' : 'text-neutral-600'}>
                      ✔ ۴. ثبت در draft_content.json و بارگذاری خودکار روی تایم‌لاین
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Project Media */}
          {leftTab === 'media' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>فایل‌های پروژه (Draft Resources)</span>
                <span className="text-cyan-400 font-mono">~/Movies/Resources/</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {clips
                  .filter((c) => c.track === 'main' || c.track === 'overlay')
                  .map((clip) => (
                    <div
                      key={clip.id}
                      onClick={() => setSelectedClipId(clip.id)}
                      className={`p-2 rounded border cursor-pointer transition-all ${
                        selectedClipId === clip.id
                          ? 'border-cyan-400 bg-[#25252c]'
                          : 'border-neutral-800 bg-[#1c1c20] hover:border-neutral-700'
                      }`}
                    >
                      <div className="h-16 bg-neutral-900 rounded flex items-center justify-center text-neutral-500 mb-1.5 relative overflow-hidden">
                        <Film className="w-6 h-6 text-neutral-600" />
                        {clip.aiGenerated && (
                          <span className="absolute top-1 right-1 text-[9px] bg-cyan-400 text-black font-bold px-1 rounded">
                            AI
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono truncate block text-neutral-300">{clip.title}</span>
                      <span className="text-[10px] text-neutral-500">{clip.duration.toFixed(1)}s</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Tab 3: Text & Captions */}
          {leftTab === 'text' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <span className="text-xs font-semibold text-neutral-300 block">زیرنویس‌های هوشمند تولید شده:</span>
              <div className="space-y-2">
                {clips
                  .filter((c) => c.track === 'text')
                  .map((caption) => (
                    <div
                      key={caption.id}
                      onClick={() => {
                        setSelectedClipId(caption.id);
                        setCurrentTime(caption.start);
                      }}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedClipId === caption.id
                          ? 'border-amber-400 bg-[#26241e]'
                          : 'border-neutral-800 bg-[#1c1c20] hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-neutral-400 text-[11px] mb-1 font-mono">
                        <span className="text-amber-400 font-semibold">{formatTimecode(caption.start)}</span>
                        <span>{caption.duration.toFixed(1)}s</span>
                      </div>
                      <p className="text-neutral-200 font-medium">{caption.title}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Tab 4: Bridge Status */}
          {leftTab === 'bridge' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono">
              <div className="p-3 bg-[#1d1d21] border border-neutral-700 rounded-lg space-y-2">
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>وضعیت اتصال به سیستم‌عامل: فعال (Connected)</span>
                </span>
                <p className="text-neutral-400 text-[11px] font-sans">
                  {platform === 'win'
                    ? 'پلاگین سرور ویندوز روی 127.0.0.1:8765 آماده دریافت فرامین با شبیه‌سازی pyautogui است.'
                    : 'اسکریپت macOS از طریق لایه PyObjC و Quartz رویدادهای فیزیکی را به کپکات ارسال می‌کند.'}
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-neutral-400 text-[11px] block">کلیدهای میانبر هماهنگ شده:</span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-[#121214] rounded border border-neutral-800">
                    <span className="text-neutral-400">برش آنی (Split):</span>
                    <span className="text-cyan-400 font-bold ml-1">{platform === 'win' ? 'Ctrl + B' : 'Cmd + B'}</span>
                  </div>
                  <div className="p-2 bg-[#121214] rounded border border-neutral-800">
                    <span className="text-neutral-400">خروجی (Export):</span>
                    <span className="text-cyan-400 font-bold ml-1">{platform === 'win' ? 'Ctrl + E' : 'Cmd + E'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CENTER COLUMN: CAPCUT VIDEO PLAYER / MONITOR */}
        <div className="col-span-12 lg:col-span-5 flex flex-col min-h-0 bg-[#0d0d0f] items-center justify-between p-4">
          {/* Top Player Options */}
          <div className="w-full flex items-center justify-between text-xs text-neutral-400 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAspectRatio(aspectRatio === '9:16' ? '16:9' : '9:16')}
                className="px-2 py-1 bg-[#1c1c20] hover:bg-[#25252c] rounded border border-neutral-700 text-neutral-200 cursor-pointer font-mono text-[11px]"
              >
                Ratio: {aspectRatio}
              </button>
              <span className="text-[11px] font-mono text-neutral-500">100% Fit</span>
            </div>

            <span className="font-mono text-cyan-400 text-xs font-semibold">{formatTimecode(currentTime)}</span>
          </div>

          {/* Video Preview Canvas with Subtitles & AI Elements */}
          <div className="flex-1 flex items-center justify-center w-full min-h-[340px] my-auto">
            <div
              className={`relative bg-neutral-950 border-2 border-neutral-800 shadow-2xl rounded-lg overflow-hidden flex items-center justify-center transition-all ${
                aspectRatio === '9:16' ? 'w-[240px] h-[426px]' : 'w-[440px] h-[247px]'
              }`}
            >
              {/* Fake Video Screen Background with subtle movement */}
              <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-neutral-950 to-black flex items-center justify-center">
                <div className="text-center p-4">
                  <Film className="w-10 h-10 text-neutral-700 mx-auto mb-2 opacity-60" />
                  <span className="text-xs text-neutral-500 font-mono block">CapCut Video Output</span>
                  <span className="text-[10px] text-cyan-500 font-mono block mt-1">
                    Track: {selectedClip?.title}
                  </span>
                </div>
              </div>

              {/* Dynamic AI Badge Overlay */}
              {selectedClip?.aiGenerated && (
                <div className="absolute top-3 left-3 px-2 py-0.5 bg-black/70 backdrop-blur border border-cyan-500/60 rounded text-[10px] font-mono text-cyan-400 flex items-center gap-1 shadow">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>AI Powered</span>
                </div>
              )}

              {/* Overlay Subtitle synchronized with playhead */}
              {activeCaption && (
                <div
                  style={{ bottom: '22%' }}
                  className="absolute inset-x-2 text-center pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95"
                >
                  <span className="inline-block px-3 py-1.5 rounded bg-black/85 border border-amber-400 text-amber-300 font-bold text-sm tracking-wide shadow-2xl drop-shadow-md">
                    {activeCaption.metadata?.text || activeCaption.title}
                  </span>
                </div>
              )}

              {/* Resolution Watermark */}
              <div className="absolute bottom-2 right-2 text-[9px] font-mono text-neutral-600">
                1080×1920 30FPS
              </div>
            </div>
          </div>

          {/* Bottom Player Controls */}
          <div className="w-full flex items-center justify-between pt-3 border-t border-neutral-800/80">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentTime(Math.max(0, currentTime - 1))}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition cursor-pointer"
                title="1s Back"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 bg-white text-black hover:bg-neutral-200 rounded-full transition cursor-pointer shadow-md"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
              </button>
              <button
                onClick={() => setCurrentTime(Math.min(totalDuration, currentTime + 1))}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition cursor-pointer"
                title="1s Forward"
              >
                <SkipForward className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setCurrentTime(0);
                  setIsPlaying(false);
                }}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition cursor-pointer"
                title="Reset to 0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="font-mono text-xs text-neutral-400 flex items-center gap-1">
              <span className="text-white font-medium">{formatTimecode(currentTime)}</span>
              <span>/</span>
              <span>{formatTimecode(totalDuration)}</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CAPCUT INSPECTOR & AI PROPERTIES */}
        <div className="col-span-12 lg:col-span-3 flex flex-col min-h-0 bg-[#161619] p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>تنظیمات لایه (Inspector)</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-400">{selectedClip?.track.toUpperCase()}</span>
          </div>

          {/* Selected Clip Metadata */}
          <div className="p-3 bg-[#1d1d21] border border-neutral-700 rounded-lg space-y-2 text-xs">
            <div className="flex items-center justify-between text-neutral-400">
              <span>نام المان:</span>
              <span className="text-white font-mono truncate max-w-[140px]">{selectedClip?.title}</span>
            </div>
            <div className="flex items-center justify-between text-neutral-400 font-mono text-[11px]">
              <span>شروع و طول:</span>
              <span className="text-neutral-300">
                {selectedClip?.start.toFixed(2)}s ({selectedClip?.duration.toFixed(2)}s)
              </span>
            </div>
            <div className="flex items-center justify-between text-neutral-400 font-mono text-[11px]">
              <span>وضعیت انکودر:</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>Timerange OK</span>
              </span>
            </div>
          </div>

          {/* Transform Sliders */}
          <div className="space-y-3 text-xs">
            <span className="font-semibold text-neutral-300 block">Transform & Placement</span>

            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400 text-[11px]">
                <span>Scale:</span>
                <span className="font-mono text-white">{Math.round(scale * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400 text-[11px]">
                <span>Position Y (عمودی):</span>
                <span className="font-mono text-white">{posY.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="-1.0"
                max="1.0"
                step="0.02"
                value={posY}
                onChange={(e) => setPosY(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>

          {/* JSON Bridge Link Code Snippet */}
          <div className="space-y-1.5 pt-2">
            <span className="text-[11px] font-mono text-neutral-400 block">CapCut Draft JSON Segment:</span>
            <pre className="p-2.5 bg-black border border-neutral-800 rounded font-mono text-[10px] text-cyan-400 max-h-36 overflow-x-auto leading-relaxed select-all">
              {JSON.stringify(
                {
                  id: selectedClip?.id,
                  type: selectedClip?.track,
                  render_index: 0,
                  target_timerange: {
                    start: Math.round(selectedClip?.start * 1e6),
                    duration: Math.round(selectedClip?.duration * 1e6)
                  },
                  source_timerange: {
                    start: 0,
                    duration: Math.round(selectedClip?.duration * 1e6)
                  }
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM CAPCUT MULTI-TRACK TIMELINE */}
      <div className="h-64 flex flex-col bg-[#141417] border-t border-neutral-800 shrink-0">
        {/* Timeline Tools Bar */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#18181b] border-b border-neutral-800 text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={handleSplit}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded flex items-center gap-1.5 transition cursor-pointer text-[11px] font-medium"
              title="Split at playhead"
            >
              <Scissors className="w-3.5 h-3.5 text-cyan-400" />
              <span>Split ({platform === 'win' ? 'Ctrl+B' : 'Cmd+B'})</span>
            </button>
            <button
              onClick={handleDelete}
              className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-red-400 rounded flex items-center gap-1 transition cursor-pointer text-[11px]"
              title="Delete clip"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>

          {/* Timecode Indicator */}
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-neutral-400">Playhead:</span>
            <span className="text-cyan-400 font-semibold">{formatTimecode(currentTime)}</span>
            <span className="text-neutral-600">·</span>
            <span className="text-neutral-400">Duration: {totalDuration.toFixed(1)}s</span>
          </div>
        </div>

        {/* Multi-Track Scroll Area */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 relative select-none">
          {/* Timeline Ruler Seconds */}
          <div className="relative h-5 mb-1 border-b border-neutral-800 text-[10px] font-mono text-neutral-500">
            {Array.from({ length: 15 }).map((_, sec) => (
              <div
                key={sec}
                style={{ left: `${(sec / totalDuration) * 100}%` }}
                className="absolute top-0 bottom-0 border-l border-neutral-700 pl-1"
              >
                {sec}s
              </div>
            ))}
          </div>

          {/* Red Playhead Vertical Needle */}
          <div
            style={{ left: `${(currentTime / totalDuration) * 100}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none flex flex-col items-center"
          >
            <div className="w-3 h-3 bg-red-500 rotate-45 -mt-1.5 shadow" />
          </div>

          {/* Tracks Stack */}
          <div className="space-y-1.5">
            {/* Track 1: Text / Captions */}
            <div className="relative h-8 bg-[#1a1a1f] rounded border border-neutral-800/80 flex items-center">
              <span className="absolute left-2 text-[10px] font-mono text-amber-400 font-bold z-10 pointer-events-none">
                T1 Subtitles
              </span>
              {clips
                .filter((c) => c.track === 'text')
                .map((clip) => {
                  const left = (clip.start / totalDuration) * 100;
                  const width = (clip.duration / totalDuration) * 100;
                  const isSelected = selectedClipId === clip.id;
                  return (
                    <div
                      key={clip.id}
                      onClick={() => {
                        setSelectedClipId(clip.id);
                        setCurrentTime(clip.start);
                      }}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      className={`absolute top-1 bottom-1 ${clip.color} border rounded px-2 text-[10px] font-medium flex items-center justify-between overflow-hidden shadow-sm cursor-pointer transition-all ${
                        isSelected ? 'ring-2 ring-white z-20' : 'opacity-90 hover:opacity-100'
                      }`}
                    >
                      <span className="truncate">{clip.title}</span>
                    </div>
                  );
                })}
            </div>

            {/* Track 2: Overlays / AI B-Roll */}
            <div className="relative h-9 bg-[#1a1a1f] rounded border border-neutral-800/80 flex items-center">
              <span className="absolute left-2 text-[10px] font-mono text-purple-400 font-bold z-10 pointer-events-none">
                V2 Overlays
              </span>
              {clips
                .filter((c) => c.track === 'overlay')
                .map((clip) => {
                  const left = (clip.start / totalDuration) * 100;
                  const width = (clip.duration / totalDuration) * 100;
                  const isSelected = selectedClipId === clip.id;
                  return (
                    <div
                      key={clip.id}
                      onClick={() => {
                        setSelectedClipId(clip.id);
                        setCurrentTime(clip.start);
                      }}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      className={`absolute top-1 bottom-1 ${clip.color} border rounded px-2 text-[10px] font-medium flex items-center justify-between overflow-hidden shadow-sm cursor-pointer transition-all ${
                        isSelected ? 'ring-2 ring-white z-20' : 'opacity-90 hover:opacity-100'
                      }`}
                    >
                      <span className="truncate">{clip.title}</span>
                      <span className="text-[9px] font-mono opacity-80 shrink-0">{clip.duration.toFixed(1)}s</span>
                    </div>
                  );
                })}
            </div>

            {/* Track 3: Main Video */}
            <div className="relative h-11 bg-[#1a1a1f] rounded border border-neutral-800/80 flex items-center">
              <span className="absolute left-2 text-[10px] font-mono text-teal-400 font-bold z-10 pointer-events-none">
                V1 Main Video
              </span>
              {clips
                .filter((c) => c.track === 'main')
                .map((clip) => {
                  const left = (clip.start / totalDuration) * 100;
                  const width = (clip.duration / totalDuration) * 100;
                  const isSelected = selectedClipId === clip.id;
                  return (
                    <div
                      key={clip.id}
                      onClick={() => {
                        setSelectedClipId(clip.id);
                        setCurrentTime(clip.start);
                      }}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      className={`absolute top-1 bottom-1 ${clip.color} border rounded px-2.5 text-xs font-medium flex items-center justify-between overflow-hidden shadow-sm cursor-pointer transition-all ${
                        isSelected ? 'ring-2 ring-white z-20' : 'opacity-90 hover:opacity-100'
                      }`}
                    >
                      <span className="truncate">{clip.title}</span>
                      <span className="text-[10px] font-mono opacity-80 shrink-0 ml-1">
                        {clip.duration.toFixed(1)}s
                      </span>
                    </div>
                  );
                })}
            </div>

            {/* Track 4: Audio / Voiceover */}
            <div className="relative h-7 bg-[#1a1a1f] rounded border border-neutral-800/80 flex items-center">
              <span className="absolute left-2 text-[10px] font-mono text-emerald-400 font-bold z-10 pointer-events-none">
                A1 AI Voice
              </span>
              {clips
                .filter((c) => c.track === 'audio')
                .map((clip) => {
                  const left = (clip.start / totalDuration) * 100;
                  const width = (clip.duration / totalDuration) * 100;
                  return (
                    <div
                      key={clip.id}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      className={`absolute top-1 bottom-1 ${clip.color} border rounded px-2 text-[10px] font-mono flex items-center overflow-hidden`}
                    >
                      <span className="truncate">{clip.title}</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Interactive Playhead Scrub Range */}
          <input
            type="range"
            min="0"
            max={totalDuration}
            step="0.05"
            value={currentTime}
            onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
            className="w-full mt-2 h-2 bg-neutral-800 rounded appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>

      {/* 4. REALISTIC CAPCUT EXPORT MODAL WITH HARD RULE 6 AUTO-DISMISS */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1e] border border-neutral-700 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <span className="font-semibold text-white text-sm flex items-center gap-2">
                <Download className="w-4 h-4 text-cyan-400" />
                <span>پیش‌نمایش خروجی (هیچ فایلی ساخته نمی‌شود)</span>
              </span>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-neutral-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-neutral-300">
                <span>پروژه:</span>
                <span className="font-mono text-white">Viral_Reel_AI_01.mp4</span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>رزولوشن:</span>
                <span className="font-mono text-white">1080×1920 (9:16) H.264</span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>مسیر ذخیره:</span>
                <span className="font-mono text-cyan-400 text-[11px]">
                  مسیر نمایشی — فایلی ذخیره نمی‌شود
                </span>
              </div>
            </div>

            {/* Export Progress Bar */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-neutral-300">وضعیت انکودر:</span>
                <span className="text-cyan-400 font-bold">{exportProgress}%</span>
              </div>
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  style={{ width: `${exportProgress}%` }}
                  className="h-full bg-gradient-to-r from-cyan-400 to-teal-400 transition-all duration-200"
                />
              </div>
            </div>

            {/* Hard Rule 6 Notice */}
            {exportDone && (
              <div className="p-3 bg-neutral-900 border border-neutral-700 rounded-lg space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>شبیه‌سازی تمام شد — ویدیویی رندر نشد</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  {shareModalDismissed ? (
                    <span className="text-cyan-300 font-mono">
                      این پنل فقط پیش‌نمایش رابط است؛ به CapCut فرمانی نفرستاد و فایل خروجی نساخت.
                    </span>
                  ) : (
                    'در حال نمایش روند نمونه؛ اتصال زنده‌ای به CapCut وجود ندارد.'
                  )}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-1.5 text-xs text-neutral-300 hover:text-white bg-neutral-800 rounded cursor-pointer"
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
