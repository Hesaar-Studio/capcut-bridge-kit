import React from 'react';
import { Terminal, Download, FileCode, Sliders, ShieldCheck, Film, Sparkles, BookOpen, Cpu, Video } from 'lucide-react';
import { Platform } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  platform: Platform;
  setPlatform: (p: Platform) => void;
  onDownloadPy: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  platform,
  setPlatform,
  onDownloadPy,
}) => {
  const navItems = [
    { id: 'ai_hub', label: 'تولید هوش مصنوعی و ابر (AI Hub)', icon: Video },
    { id: 'bridge', label: 'پل ارتباطی HS.Tech (MCP & .EXE)', icon: Cpu },
    { id: 'studio', label: 'CapCut Studio AI', icon: Film },
    { id: 'prompts', label: 'کتابخانه پرامپت ادیت', icon: Sparkles },
    { id: 'mastery', label: 'اسکیل‌ها و راهنما', icon: BookOpen },
    { id: 'commands', label: 'Command Studio', icon: Sliders },
    { id: 'plugin', label: 'Windows Plugin', icon: Terminal },
    { id: 'code', label: 'Python & Templates', icon: FileCode },
    { id: 'contracts', label: 'EDL Contract', icon: Terminal },
    { id: 'rules', label: 'Hard Rules Audit', icon: ShieldCheck },
  ];

  return (
    <header className="flex items-center justify-between px-6 py-3.5 border-b border-neutral-800 bg-neutral-950 text-neutral-100 select-none sticky top-0 z-50">
      {/* Zone 1: Wordmark with HS.Tech brand */}
      <div className="flex items-center gap-3">
        <span className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          پل ارتباطی HS.Tech
        </span>
        <span className="text-[11px] text-neutral-400 font-mono hidden md:inline">hs-art-tech-bridge</span>
        <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-md p-0.5 text-xs font-mono">
          <button
            onClick={() => setPlatform('mac')}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              platform === 'mac' ? 'bg-neutral-800 text-white font-semibold' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            macOS
          </button>
          <button
            onClick={() => setPlatform('win')}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              platform === 'win' ? 'bg-neutral-800 text-emerald-400 font-semibold' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Windows
          </button>
        </div>
      </div>

      {/* Zone 2: 4-6 clean text navigation links */}
      <nav className="flex items-center gap-1 md:gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Zone 3: 1-2 primary actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onDownloadPy}
          className="px-3 py-1.5 text-xs font-medium text-black bg-emerald-400 rounded-md hover:bg-emerald-300 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{platform === 'win' ? 'capcut-bridge-win.py' : 'capcut-bridge.py'}</span>
        </button>
      </div>
    </header>
  );
};

