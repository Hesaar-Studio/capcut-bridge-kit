import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { CommandBuilder } from './components/CommandBuilder';
import { TimelineVisualizer } from './components/TimelineVisualizer';
import { CodeViewer } from './components/CodeViewer';
import { RulesValidator } from './components/RulesValidator';
import { InputContractEditor } from './components/InputContractEditor';
import { WindowsPluginGuide } from './components/WindowsPluginGuide';
import { CapCutStudio } from './components/CapCutStudio';
import { PromptLibrary } from './components/PromptLibrary';
import { EditingMastery } from './components/EditingMastery';
import { BridgeStudioPanel } from './components/BridgeStudioPanel';
import { AiHubStudio } from './components/AiHubStudio';
import {
  CAPCUT_BRIDGE_PY,
  CAPCUT_BRIDGE_WIN_PY,
  INSTALL_PLUGIN_WIN_BAT,
  CAPCUT_PLUGIN_WIN_PY,
} from './data/bridgeSource';
import { Platform } from './types';
import { EditingPrompt } from './data/editingPrompts';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [platform, setPlatform] = useState<Platform>('win');

  const handleDownloadPy = () => {
    const isWin = platform === 'win';
    const content = isWin ? CAPCUT_BRIDGE_WIN_PY : CAPCUT_BRIDGE_PY;
    const filename = isWin ? 'capcut-bridge-win.py' : 'capcut-bridge.py';

    const blob = new Blob([content], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Top Bar following Top Bar Contract */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        platform={platform}
        setPlatform={setPlatform}
        onDownloadPy={handleDownloadPy}
      />

      {/* Main Workspace Viewport */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-2 sm:p-4 lg:p-5">
        {activeTab === 'ai_hub' && (
          <AiHubStudio
            onInjectMediaToNLE={(_item) => {
              setActiveTab('studio');
            }}
          />
        )}
        {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
        {activeTab === 'bridge' && (
          <BridgeStudioPanel
            platform={platform}
            onDownloadZip={() => {
              const a = document.createElement('a');
              a.href = '/hs-art-tech-bridge.zip';
              a.download = 'hs-art-tech-bridge-v2.4.zip';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
          />
        )}
        {activeTab === 'studio' && <CapCutStudio platform={platform} />}
        {activeTab === 'prompts' && (
          <PromptLibrary 
            platform={platform} 
            onInjectPrompt={(_p) => {
              setActiveTab('studio');
            }}
          />
        )}
        {activeTab === 'mastery' && (
          <EditingMastery 
            platform={platform} 
            onNavigateToTab={(tab) => setActiveTab(tab)} 
          />
        )}
        {activeTab === 'commands' && <CommandBuilder platform={platform} />}
        {activeTab === 'timeline' && <TimelineVisualizer />}
        {activeTab === 'plugin' && (
          <WindowsPluginGuide
            onDownloadWinScript={() => handleDownloadFile(CAPCUT_BRIDGE_WIN_PY, 'capcut-bridge-win.py', 'text/x-python;charset=utf-8')}
            onDownloadInstaller={() => handleDownloadFile(INSTALL_PLUGIN_WIN_BAT, 'install-plugin-win.bat', 'application/x-bat')}
            onDownloadPluginDaemon={() => handleDownloadFile(CAPCUT_PLUGIN_WIN_PY, 'capcut-plugin-win.py', 'text/x-python;charset=utf-8')}
          />
        )}
        {activeTab === 'code' && <CodeViewer />}
        {activeTab === 'contracts' && <InputContractEditor />}
        {activeTab === 'rules' && <RulesValidator />}
      </main>

      {/* Quiet single-elevation status footer */}
      <footer className="border-t border-neutral-800 bg-neutral-950/80 px-6 py-4 text-xs text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-neutral-300 font-medium">پل ارتباطی HS.Tech (Hesa Art Tech)</span>
          <span>·</span>
          <span>CapCut · Premiere Pro · DaVinci Resolve</span>
          <span>·</span>
          <span className="font-mono text-emerald-400">hs-art-tech-bridge v2.4.0</span>
        </div>
        <div className="flex items-center gap-4 text-neutral-400">
          <span>MCP Protocol (Stdio JSON-RPC)</span>
          <span>·</span>
          <span>REST API: Port 8765</span>
        </div>
      </footer>
    </div>
  );
}
