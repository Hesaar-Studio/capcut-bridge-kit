import React, { useState } from "react";
import { 
  EDITING_PROMPTS, 
  EditingPrompt 
} from "../data/editingPrompts";
import { 
  Sparkles, 
  Copy, 
  Check, 
  Terminal, 
  Sliders, 
  Lightbulb, 
  Film, 
  Volume2, 
  Type, 
  Flame, 
  Search,
  ExternalLink,
  PlusCircle,
  HelpCircle,
  Layers
} from "lucide-react";
import { Platform } from "../types";

interface PromptLibraryProps {
  platform: Platform;
  onInjectPrompt?: (prompt: EditingPrompt) => void;
}

export const PromptLibrary: React.FC<PromptLibraryProps> = ({ platform, onInjectPrompt }) => {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCmdId, setCopiedCmdId] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<EditingPrompt | null>(EDITING_PROMPTS[0]);

  const categories = [
    { id: "all", label: "همه پرامپت‌ها", icon: Sparkles },
    { id: "lighting", label: "نورپردازی و رنگ", icon: Flame },
    { id: "cuts", label: "سبک‌های کات و ریتم", icon: Film },
    { id: "hook", label: "هوک و تایپوگرافی", icon: Type },
    { id: "sound", label: "طراحی صدا و افکت", icon: Volume2 },
    { id: "b-roll", label: "بی‌رول و لایه هوش مصنوعی", icon: Layers }
  ];

  const filteredPrompts = EDITING_PROMPTS.filter((p) => {
    const matchesCat = activeCategory === "all" || p.category === activeCategory;
    const matchesSearch = 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.aiPrompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.badge.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleCopyPrompt = (prompt: EditingPrompt) => {
    navigator.clipboard.writeText(prompt.aiPrompt);
    setCopiedId(prompt.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyCommand = (prompt: EditingPrompt) => {
    const cmd = platform === "win" 
      ? prompt.capcutCommand.replace("uv run capcut-bridge.py", "python capcut-bridge-win.py")
      : prompt.capcutCommand;
    navigator.clipboard.writeText(cmd);
    setCopiedCmdId(prompt.id);
    setTimeout(() => setCopiedCmdId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-950/70 via-slate-900 to-indigo-950/70 border border-teal-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold border border-teal-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>کتابخانه پرامپت‌های تدوین حرفه‌ای و نورپردازی</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              کتابخانه جامع پرامپت و دستورات تدوین هوش مصنوعی
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              مجموعه‌ای از پرامپت‌های مهندسی‌شده برای مدل‌های ویدیویی (Kling, Runway, Midjourney) همراه با دستور دقیق 
              <span className="text-teal-400 font-mono mx-1">capcut-bridge</span> برای تزریق مستقیم به لایه‌های تایم‌لاین کپکات.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-center min-w-[110px]">
              <span className="text-2xl font-black text-teal-400 font-mono">{EDITING_PROMPTS.length}</span>
              <p className="text-[11px] text-slate-400">پرامپت تدوین</p>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-center min-w-[110px]">
              <span className="text-2xl font-black text-purple-400 font-mono">۵</span>
              <p className="text-[11px] text-slate-400">دسته‌بندی کلیدی</p>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-center min-w-[110px]">
              <span className="text-2xl font-black text-amber-400 font-mono">100%</span>
              <p className="text-[11px] text-slate-400">تزریق به کپکات</p>
            </div>
          </div>
        </div>

        {/* Search & Categories */}
        <div className="mt-6 pt-5 border-t border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {categories.map((c) => {
              const Icon = c.icon;
              const isActive = activeCategory === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-teal-500 text-black font-bold shadow-md shadow-teal-500/20"
                      : "bg-slate-800/90 text-slate-300 hover:bg-slate-700/80 hover:text-white border border-slate-700/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در پرامپت‌ها، نور، کات..."
              className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Grid of Prompts and Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Cards List (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-400">
              نمایش {filteredPrompts.length} از {EDITING_PROMPTS.length} پرامپت تدوین
            </span>
            <span className="text-[11px] text-teal-400">
              سیستم‌عامل فعال: {platform === "win" ? "Windows (Ctrl+B/E)" : "macOS (Cmd+B/E)"}
            </span>
          </div>

          <div className="space-y-3.5">
            {filteredPrompts.map((p) => {
              const isSelected = selectedPrompt?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPrompt(p)}
                  className={`cursor-pointer rounded-xl p-4.5 border transition-all text-right ${
                    isSelected
                      ? "bg-slate-800/90 border-teal-500/80 shadow-lg shadow-teal-500/5 ring-1 ring-teal-500/30"
                      : "bg-slate-900/80 border-slate-800/80 hover:border-slate-700 hover:bg-slate-850"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-teal-500/10 text-teal-400 border border-teal-500/20">
                        {p.badge}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                        {p.recommendedModel}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        p.difficulty === "پیشرفته" 
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : p.difficulty === "متوسط"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}>
                        {p.difficulty}
                      </span>
                    </div>

                    <span className="text-xs font-mono text-slate-500">
                      {p.edlSnippet.in_s}s ➔ {p.edlSnippet.out_s}s
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white mb-1.5">
                    {p.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
                    {p.description}
                  </p>

                  <div className="bg-slate-950/70 rounded-lg p-2.5 border border-slate-800 font-mono text-[11px] text-slate-300 mb-3 line-clamp-2 select-all">
                    "{p.aiPrompt}"
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyPrompt(p);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 text-xs font-medium border border-teal-500/30 transition-colors"
                    >
                      {copiedId === p.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === p.id ? "پرامپت کپی شد!" : "کپی پرامپت هوش مصنوعی"}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyCommand(p);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                    >
                      {copiedCmdId === p.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Terminal className="w-3.5 h-3.5 text-amber-400" />}
                      <span>کپی دستور پایتون</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Deep Inspector & Realtime Injector (5 cols) */}
        <div className="lg:col-span-5">
          {selectedPrompt ? (
            <div className="sticky top-20 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-5 text-right">
              {/* Header */}
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    {selectedPrompt.categoryLabel}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    تایم‌کد: {selectedPrompt.edlSnippet.in_s} ثانیه تا {selectedPrompt.edlSnippet.out_s} ثانیه
                  </span>
                </div>
                <h2 className="text-base font-bold text-white">
                  {selectedPrompt.title}
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {selectedPrompt.description}
                </p>
              </div>

              {/* English AI Generation Prompt */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-teal-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>متن پرامپت برای موتورهای هوش مصنوعی</span>
                  </span>
                  <button
                    onClick={() => handleCopyPrompt(selectedPrompt)}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedId === selectedPrompt.id ? "کپی شد" : "کپی"}
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-slate-200 leading-relaxed max-h-40 overflow-y-auto ltr text-left">
                  {selectedPrompt.aiPrompt}
                </div>
                <p className="text-[11px] text-slate-500">
                  مدل پیشنهادی: <span className="text-slate-300 font-medium">{selectedPrompt.recommendedModel}</span>
                </p>
              </div>

              {/* Companion CapCut Bridge CLI Command */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>دستور متناظر خط فرمان کپکات (Bridge CLI)</span>
                  </span>
                  <button
                    onClick={() => handleCopyCommand(selectedPrompt)}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedCmdId === selectedPrompt.id ? "کپی شد" : "کپی"}
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-amber-300 leading-relaxed ltr text-left">
                  {platform === "win"
                    ? selectedPrompt.capcutCommand.replace("uv run capcut-bridge.py", "python capcut-bridge-win.py")
                    : selectedPrompt.capcutCommand}
                </div>
              </div>

              {/* EDL Layer Specification */}
              <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">مشخصات لایه تایم‌لاین کپکات:</span>
                  <span className="font-mono text-teal-400 font-bold uppercase">{selectedPrompt.edlSnippet.type}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">شروع (In):</span>
                    <span className="text-slate-200">{selectedPrompt.edlSnippet.in_s} ثانیه</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">پایان (Out):</span>
                    <span className="text-slate-200">{selectedPrompt.edlSnippet.out_s} ثانیه</span>
                  </div>
                </div>
              </div>

              {/* Pro Editing Tips */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>تکنیک‌های تدوین حرفه‌ای این پرامپت:</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {selectedPrompt.tips.map((t, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></span>
                      <span className="leading-relaxed">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button: Inject to Studio */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    if (onInjectPrompt) {
                      onInjectPrompt(selectedPrompt);
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>تزریق این افکت و تنظیمات به تایم‌لاین CapCut Studio</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs">
              یک پرامپت را از لیست انتخاب کنید تا جزئیات و پارامترهای تدوین را مشاهده فرمایید.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
