import React, { useState } from 'react';
import {
  Cpu,
  Layers,
  Sparkles,
  Download,
  Copy,
  Check,
  CheckCircle2,
  Terminal,
  Activity,
  Sliders,
  Sun,
  Eye,
  RefreshCw,
  FolderArchive,
  ExternalLink,
  ShieldCheck,
  Film,
  Globe
} from 'lucide-react';
import { Platform } from '../types';
import { getBridgeStatus } from '../services/bridgeApi';

interface BridgeStudioPanelProps {
  platform: Platform;
  onDownloadZip?: () => void;
}

type NLETarget = 'capcut' | 'premiere' | 'davinci';
type Language = 'fa' | 'en';

export const BridgeStudioPanel: React.FC<BridgeStudioPanelProps> = ({ platform, onDownloadZip }) => {
  const [lang, setLang] = useState<Language>('fa');
  const [activeNLE, setActiveNLE] = useState<NLETarget>('capcut');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 4K Viewport & Color Grading state
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [zoom100, setZoom100] = useState<boolean>(false);
  const [splitWipe, setSplitWipe] = useState<number>(50); // 0 to 100%
  const [contrast, setContrast] = useState<number>(1.12);
  const [saturation, setSaturation] = useState<number>(1.08);
  const [temperature, setTemperature] = useState<number>(5600); // Kelvin
  const [highlights, setHighlights] = useState<number>(-18);
  const [shadows, setShadows] = useState<number>(10);

  // Panel actions: backend status is queried for real; unsupported NLE sync is never simulated.
  const [panelOutput, setPanelOutput] = useState<string>(
    lang === 'fa'
      ? 'وضعیت هنوز از backend خوانده نشده است؛ برای دریافت وضعیت واقعی، «بررسی وضعیت backend» را بزنید.'
      : 'Backend status has not been queried. Use “Check backend status” for a live read.'
  );
  const [isRunningPanelAction, setIsRunningPanelAction] = useState<boolean>(false);

  const t = {
    fa: {
      brandTitle: 'پل ارتباطی HS.Tech (Hesa Art Tech)',
      brandSubtitle: 'این پنل پیش‌نمایش رابط و نمونه‌فایل‌هاست؛ اتصال زنده و اجرای تدوین در آن پیاده‌سازی نشده است.',
      badgeRepo: 'ریپازیتوری: hs-art-tech-bridge',
      badgeVersion: 'اتصال NLE: تأییدنشده',
      nleCapcut: 'CapCut · نمونه رابط',
      nlePremiere: 'Premiere Pro · آداپتر تأییدنشده',
      nleDavinci: 'DaVinci Resolve · آداپتر تأییدنشده',
      tabCinema4K: 'پیش‌نمایش و ابزارهای محلی',
      tabMcpDaemon: 'وضعیت backend و نمونه تنظیمات MCP',
      tabDownloadDeploy: 'آرشیو منبع · نصب تأییدنشده',
      viewportTitle: 'پیش‌نمایش ۴K ساختگی · بدون ویدیوی ورودی',
      viewportSub: 'این سطح نمایشی فایل رسانه باز نمی‌کند و خروجی NLE را رندر نمی‌کند.',
      splitNotice: 'کنترل تعاملی روی تصویر نمونه؛ نه مقایسهٔ ویدیوی واقعی',
      zoomToggle: 'بزرگ‌نمایی نمایشی',
      aspect169: 'افقی ۱۶:۹',
      aspect916: 'عمودی ۹:۱۶',
      sliderContrast: 'کنتراست نمونه:',
      sliderSat: 'اشباع نمایشی (در فایل LUT اعمال نمی‌شود):',
      sliderTemp: 'دمای رنگ (نمایشی):',
      sliderHighlights: 'هایلایت‌ها (نمایشی):',
      sliderShadows: 'سایه‌ها (نمایشی):',
      btnDownloadLut: 'ساخت و دانلود LUT محلی (فقط کنتراست اعمال می‌شود)',
      btnDownloadFcpxml: 'دانلود نمونهٔ FCPXML · سازگاری بررسی‌نشده',
      btnDownloadCapcutJson: 'دانلود JSON نمونه · پروژهٔ CapCut تأییدشده نیست',
      mcpRunnerTitle: 'وضعیت واقعی backend و عملیات محلی',
      btnRunHealth: 'بررسی وضعیت backend',
      btnRunSync: 'همگام‌سازی NLE · پشتیبانی‌نشده',
      btnRunLut: 'ساخت LUT نمونه و دانلود',
      claudeConfigTitle: 'نمونه تنظیمات Claude Desktop؛ مسیر را اصلاح و بررسی کنید:',
      cursorConfigTitle: 'نمونه تنظیمات Cursor و VSCode؛ مسیر را اصلاح و بررسی کنید:',
      btnCopy: 'کپی',
      copied: 'کپی شد!',
      downloadZipTitle: 'بستهٔ سورس فعلی پروژه',
      downloadZipDesc: 'این ZIP فقط snapshot سورس است؛ Setup.exe و runtime بسته‌بندی‌شده ندارد. ساخت و نصب Windows در این محیط آزموده نشده است.',
      btnDownloadZip: 'دانلود سورس (بدون Setup.exe)'
    },
    en: {
      brandTitle: 'HS.Tech Video Bridge (Hesa Art Tech)',
      brandSubtitle: 'This panel contains UI previews and sample files; live NLE connection and editing are not implemented here.',
      badgeRepo: 'Repository: hs-art-tech-bridge',
      badgeVersion: 'NLE connection: unverified',
      nleCapcut: 'CapCut · UI sample',
      nlePremiere: 'Premiere Pro · adapter unverified',
      nleDavinci: 'DaVinci Resolve · adapter unverified',
      tabCinema4K: 'Preview & local utilities',
      tabMcpDaemon: 'Backend status & sample MCP config',
      tabDownloadDeploy: 'Source archive · installation unverified',
      viewportTitle: 'Simulated 4K preview · no source video',
      viewportSub: 'This demo surface does not open media or render an NLE output.',
      splitNotice: 'Interactive control over a placeholder image, not real before/after footage',
      zoomToggle: 'Demo zoom',
      aspect169: '16:9 landscape',
      aspect916: '9:16 portrait',
      sliderContrast: 'Demo contrast:',
      sliderSat: 'Demo saturation (not applied to the LUT file):',
      sliderTemp: 'Color temperature (display only):',
      sliderHighlights: 'Highlights (display only):',
      sliderShadows: 'Shadows (display only):',
      btnDownloadLut: 'Generate/download local LUT (contrast only is applied)',
      btnDownloadFcpxml: 'Download sample FCPXML · compatibility unverified',
      btnDownloadCapcutJson: 'Download sample JSON · not a verified CapCut project',
      mcpRunnerTitle: 'Live backend status & local utilities',
      btnRunHealth: 'Check backend status',
      btnRunSync: 'NLE sync · unsupported',
      btnRunLut: 'Generate/download sample LUT',
      claudeConfigTitle: 'Claude Desktop config example; review and replace paths:',
      cursorConfigTitle: 'Cursor and VSCode config example; review and replace paths:',
      btnCopy: 'Copy',
      copied: 'Copied!',
      downloadZipTitle: 'Current project source snapshot',
      downloadZipDesc: 'This ZIP contains source only; it has no Setup.exe or bundled runtime. Windows packaging and installation have not been tested here.',
      btnDownloadZip: 'Download source (no Setup.exe)'
    }
  }[lang];

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerateAndDownloadLUT = () => {
    const size = 33;
    const lines = [
      `# HS.Tech Color Grade LUT (Hesa Art Tech)`,
      `# Local sample only; not applied to an NLE`,
      `# Contrast applied: ${contrast}; saturation control not applied (${saturation})`,
      `LUT_3D_SIZE ${size}`,
      `DOMAIN_MIN 0.0 0.0 0.0`,
      `DOMAIN_MAX 1.0 1.0 1.0`
    ];

    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          let rf = r / (size - 1);
          let gf = g / (size - 1);
          let bf = b / (size - 1);

          rf = Math.max(0, Math.min(1, 0.5 + (rf - 0.5) * contrast));
          gf = Math.max(0, Math.min(1, 0.5 + (gf - 0.5) * contrast));
          bf = Math.max(0, Math.min(1, 0.5 + (bf - 0.5) * contrast));

          lines.push(`${rf.toFixed(6)} ${gf.toFixed(6)} ${bf.toFixed(6)}`);
        }
      }
    }

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'HS_Tech_Sample_Grade_33x33.cube';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadFCPXML = () => {
    const fcpxml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
    <resources>
        <format id="r1" name="FFVideoFormat1080p30" frameDuration="1/30s" width="1920" height="1080"/>
    </resources>
    <library>
        <event name="HS.Tech Sample Project">
            <project name="HS_Tech_Master_Sequence">
                <sequence format="r1" duration="45s">
                    <spine>
                        <clip name="HS_Tech_Intro_Hook" duration="3.20s" start="0.00s" />
                        <clip name="HS_Tech_Broll_Highlight" duration="5.40s" start="3.20s" />
                        <clip name="HS_Tech_Keynote_Speech" duration="12.00s" start="8.60s" />
                    </spine>
                </sequence>
            </project>
        </event>
    </library>
</fcpxml>`;
    const blob = new Blob([fcpxml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'HS_Tech_Sample_Timeline.fcpxml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCapcutDraft = () => {
    const draftJson = {
      canvas_config: { width: 1080, height: 1920, ratio: '9:16' },
      materials: {
        videos: [
          { id: 'v1', material_name: 'SAMPLE_MEDIA_NOT_INCLUDED.mp4', path: 'Resources/SAMPLE_MEDIA_NOT_INCLUDED.mp4', duration: 30000000 }
        ],
        texts: [
          {
            id: 't1',
            content: 'پل ارتباطی HS.Tech (هسا آرت تک)',
            font_title: 'Vazirmatn Black',
            font_size: 42.0,
            text_color: '#FFE600'
          }
        ]
      },
      tracks: [
        {
          id: 'track_video_1',
          type: 'video',
          segments: [
            {
              id: 'seg_v1',
              material_id: 'v1',
              target_timerange: { start: 0, duration: 30000000 },
              source_timerange: { start: 0, duration: 30000000 }
            }
          ]
        },
        {
          id: 'track_text_1',
          type: 'text',
          segments: [
            {
              id: 'seg_t1',
              material_id: 't1',
              target_timerange: { start: 500000, duration: 2500000 },
              source_timerange: { start: 0, duration: 2500000 }
            }
          ]
        }
      ]
    };
    const blob = new Blob([JSON.stringify(draftJson, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hs-tech-capcut-sample-draft.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const runPanelAction = async (action: 'health' | 'sync' | 'lut') => {
    setIsRunningPanelAction(true);

    try {
      if (action === 'health') {
        const status = await getBridgeStatus();
        setPanelOutput(JSON.stringify({
          source: 'backend',
          version: status.version,
          platform: status.platform,
          bridge: status.bridge?.status ?? 'unknown',
          api: status.api?.status ?? 'unknown',
          editor: {
            status: status.editor?.status ?? 'unknown',
            running: status.editor?.running ?? null,
            foreground: status.editor?.foreground ?? null
          },
          mcp: { status: status.mcp?.status ?? 'unknown', tools: status.mcp?.tools ?? [] },
          ai: status.ai?.status ?? 'unknown',
          automation: status.automation?.status ?? 'unknown',
          capabilities: status.capabilities,
          plugin: {
            status: status.plugin?.status ?? 'unknown',
            managed: status.plugin?.managed ?? false,
            port: status.plugin?.port ?? null,
            projectsPathExists: status.plugin?.projectsPathExists ?? null
          }
        }, null, 2));
        return;
      }

      if (action === 'sync') {
        setPanelOutput(JSON.stringify({
          status: 'UNSUPPORTED',
          action: 'nle_timeline_sync',
          target: activeNLE,
          request_sent: false,
          reason: 'This panel has no verified timeline-sync adapter.'
        }, null, 2));
        return;
      }

      handleGenerateAndDownloadLUT();
      setPanelOutput(JSON.stringify({
        status: 'DOWNLOAD_REQUESTED',
        source: 'local browser utility',
        file: 'HS_Tech_Sample_Grade_33x33.cube',
        dimensions: '33x33x33',
        parameters_applied: ['contrast'],
        parameters_not_applied: ['saturation', 'temperature', 'highlights', 'shadows'],
        nle_applied: false,
        file_saved_or_opened: 'not verified'
      }, null, 2));
    } catch {
      setPanelOutput(JSON.stringify({
        status: 'UNAVAILABLE',
        source: 'backend',
        message: 'The backend status request failed; detailed errors are intentionally omitted from this UI.',
        editing_claimed: false
      }, null, 2));
    } finally {
      setIsRunningPanelAction(false);
    }
  };

  const claudeConfigSnippet = `{
  "mcpServers": {
    "hs-art-tech-bridge": {
      "command": "python",
      "args": [
        "${platform === 'win' ? 'C:\\\\HS_Tech_Bridge\\\\bridge_server.py' : '/usr/local/bin/bridge_server.py'}",
        "--mcp"
      ],
      "env": {
        "PYTHONIOENCODING": "utf-8"
      }
    }
  }
}`;

  const cursorConfigSnippet = `{
  "mcpServers": {
    "hs-art-tech-bridge": {
      "command": "python",
      "args": [
        "\${workspaceFolder}/bridge_system/bridge_server.py",
        "--mcp"
      ]
    }
  }
}`;

  return (
    <div className={`space-y-6 ${lang === 'fa' ? 'text-right' : 'text-left'}`}>
      {/* Top Brand Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 md:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>{t.badgeVersion}</span>
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700">
                {t.badgeRepo}
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span>{t.brandTitle}</span>
            </h1>
            <p className="text-slate-300 text-xs md:text-sm max-w-2xl leading-relaxed">{t.brandSubtitle}</p>
          </div>

          {/* Controls: Language switcher & Primary Zip Download */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Language Switcher */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-xl p-1 text-xs font-medium">
              <button
                onClick={() => setLang('fa')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  lang === 'fa' ? 'bg-indigo-600 text-white font-bold shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🇮🇷</span>
                <span>فارسی</span>
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  lang === 'en' ? 'bg-indigo-600 text-white font-bold shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🇬🇧</span>
                <span>English</span>
              </button>
            </div>

            {/* Direct Package Zip Download */}
            <button
              onClick={() => {
                if (onDownloadZip) {
                  onDownloadZip();
                } else {
                  const a = document.createElement('a');
                  a.href = '/hs-art-tech-bridge.zip';
                  a.download = 'HS-Tech-CapCut-Bridge-Source.zip';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{t.btnDownloadZip}</span>
            </button>
          </div>
        </div>

        {/* NLE Target Selector Tabs */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 ml-2 font-medium">
            {lang === 'fa' ? 'نرم‌افزار تدوین هدف (NLE Target):' : 'Active NLE:'}
          </span>
          <button
            onClick={() => setActiveNLE('capcut')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeNLE === 'capcut'
                ? 'bg-teal-500 text-black font-bold shadow-md shadow-teal-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>{t.nleCapcut}</span>
          </button>

          <button
            onClick={() => setActiveNLE('premiere')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeNLE === 'premiere'
                ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.nlePremiere}</span>
          </button>

          <button
            onClick={() => setActiveNLE('davinci')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeNLE === 'davinci'
                ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>{t.nleDavinci}</span>
          </button>
        </div>
      </div>

      {/* Grid: 4K Master Cinema & Color Grading Viewport + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left/Main Column: 4K Cinema Viewport (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-teal-400" />
                  <span>{t.viewportTitle}</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">{t.viewportSub}</p>
              </div>

              {/* Viewport Toggles: Aspect Ratio & 100% Zoom */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAspectRatio(aspectRatio === '16:9' ? '9:16' : '16:9')}
                  className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white text-xs border border-slate-700 transition-colors"
                >
                  {aspectRatio === '16:9' ? t.aspect169 : t.aspect916}
                </button>
                <button
                  onClick={() => setZoom100(!zoom100)}
                  className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                    zoom100
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {t.zoomToggle}
                </button>
              </div>
            </div>

            {/* Simulated 4K Player Surface with Split-Wipe */}
            <div
              className={`relative bg-neutral-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center transition-all ${
                aspectRatio === '16:9' ? 'aspect-video w-full' : 'w-72 h-[480px] mx-auto'
              } ${zoom100 ? 'scale-105' : ''}`}
            >
              {/* Left / Graded side */}
              <div
                className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-indigo-950 to-neutral-900 flex flex-col items-center justify-center p-6 text-center"
                style={{
                  filter: `contrast(${contrast}) saturate(${saturation})`
                }}
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-400/20 to-indigo-500/20 border border-teal-400/40 flex items-center justify-center mb-3">
                  <Film className="w-8 h-8 text-teal-300" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">HS.Tech Cinema Master (4K UHD)</h3>
                <span className="text-[11px] text-teal-400 font-mono">
                  Rec.709 · {temperature}K · S-Curve {contrast}x
                </span>

                {/* Subtitle simulation with Persian RTL font */}
                <div className="mt-8 bg-black/80 backdrop-blur-md px-4 py-1.5 rounded-lg border border-yellow-500/50 shadow-xl max-w-sm">
                  <p className="text-yellow-400 text-xs font-bold leading-relaxed">
                    «پل ارتباطی HS.Tech: جریان کار پیوسته بین هوش مصنوعی و تدوین»
                  </p>
                </div>
              </div>

              {/* Split Screen Divider line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 shadow-[0_0_10px_#FFE600] z-20 pointer-events-none"
                style={{ left: `${splitWipe}%` }}
              >
                <span className="absolute top-2 -left-6 bg-black/90 text-yellow-400 text-[10px] font-mono px-1.5 py-0.5 rounded border border-yellow-400/50">
                  {splitWipe}%
                </span>
              </div>

              {/* Title / Action Safe Guides Overlay */}
              <div className="absolute inset-4 border border-dashed border-white/15 rounded pointer-events-none">
                <span className="absolute top-1 left-1 text-[9px] text-white/30 font-mono">Action Safe 93%</span>
              </div>
              <div className="absolute inset-8 border border-dashed border-yellow-400/20 rounded pointer-events-none">
                <span className="absolute top-1 left-1 text-[9px] text-yellow-400/40 font-mono">Title Safe 90%</span>
              </div>
            </div>

            {/* Split Screen Wipe Slider */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>{t.splitNotice}</span>
                <span className="text-teal-400 font-bold">{splitWipe}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={splitWipe}
                onChange={(e) => setSplitWipe(Number(e.target.value))}
                className="w-full accent-teal-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Color Grading Sliders & Direct NLE Exports (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>
                  {lang === 'fa' ? 'تنظیمات اتالوناژ و اصلاح رنگ استودیویی' : 'Studio Color Grading Parameters'}
                </span>
              </h3>
              <span className="text-[11px] text-indigo-400 font-mono font-bold uppercase">{activeNLE}</span>
            </div>

            {/* Sliders */}
            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>{t.sliderContrast}</span>
                  <span className="font-mono text-teal-400">{contrast.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.5"
                  step="0.01"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>{t.sliderSat}</span>
                  <span className="font-mono text-purple-400">{saturation.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.8"
                  step="0.01"
                  value={saturation}
                  onChange={(e) => setSaturation(Number(e.target.value))}
                  className="w-full accent-purple-400 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>{t.sliderTemp}</span>
                  <span className="font-mono text-amber-400">{temperature} K</span>
                </div>
                <input
                  type="range"
                  min="3200"
                  max="7500"
                  step="50"
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>{t.sliderHighlights}</span>
                  <span className="font-mono text-rose-400">{highlights}</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="30"
                  step="1"
                  value={highlights}
                  onChange={(e) => setHighlights(Number(e.target.value))}
                  className="w-full accent-rose-400 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>{t.sliderShadows}</span>
                  <span className="font-mono text-emerald-400">+{shadows}</span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="40"
                  step="1"
                  value={shadows}
                  onChange={(e) => setShadows(Number(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>
            </div>

            {/* Direct Export Buttons */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <button
                onClick={handleGenerateAndDownloadLUT}
                className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{t.btnDownloadLut}</span>
              </button>

              {activeNLE === 'premiere' && (
                <button
                  onClick={handleDownloadFCPXML}
                  className="w-full py-2 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.btnDownloadFcpxml}</span>
                </button>
              )}

              {activeNLE === 'capcut' && (
                <button
                  onClick={handleDownloadCapcutDraft}
                  className="w-full py-2 px-3 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.btnDownloadCapcutJson}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Backend status/local utility panel and sample assistant configurations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Live backend status query and local utility actions (6 cols) */}
        <div className="lg:col-span-6 space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span>{t.mcpRunnerTitle}</span>
              </h3>
              <span className="text-[11px] text-amber-300 font-mono">{lang === 'fa' ? 'نتیجهٔ بررسی در پایین نمایش داده می‌شود' : 'Query result is shown below'}</span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => runPanelAction('health')}
                disabled={isRunningPanelAction}
                className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.btnRunHealth}</span>
              </button>

              <button
                onClick={() => runPanelAction('sync')}
                disabled={isRunningPanelAction}
                className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isRunningPanelAction ? 'animate-spin' : ''}`} />
                <span>{t.btnRunSync}</span>
              </button>

              <button
                onClick={() => runPanelAction('lut')}
                disabled={isRunningPanelAction}
                className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.btnRunLut}</span>
              </button>
            </div>

            {/* Output Console Log */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 min-h-[140px] max-h-[180px] overflow-y-auto ltr text-left leading-relaxed">
              <div className="text-slate-500 mb-1">// {lang === 'fa' ? 'نتیجهٔ backend / عملیات محلی؛ نه لاگ MCP' : 'Backend result / local action; not an MCP log'}</div>
              <pre className="whitespace-pre-wrap">{panelOutput}</pre>
            </div>
          </div>
        </div>

        {/* Right: Copyable AI Configs (Claude Desktop & Cursor) (6 cols) */}
        <div className="lg:col-span-6 space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                <span>
                  {lang === 'fa'
                    ? 'پیکربندی هوش مصنوعی (Claude Desktop & Cursor MCP)'
                    : 'AI Assistant MCP Configurations'}
                </span>
              </h3>
              <span className="text-[11px] text-slate-400">JSON-RPC</span>
            </div>

            {/* Claude Config */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">{t.claudeConfigTitle}</span>
                <button
                  onClick={() => handleCopyText(claudeConfigSnippet, 'claude')}
                  className="text-xs text-indigo-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'claude' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'claude' ? t.copied : t.btnCopy}</span>
                </button>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 ltr text-left max-h-24 overflow-y-auto">
                <pre>{claudeConfigSnippet}</pre>
              </div>
            </div>

            {/* Cursor Config */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">{t.cursorConfigTitle}</span>
                <button
                  onClick={() => handleCopyText(cursorConfigSnippet, 'cursor')}
                  className="text-xs text-indigo-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'cursor' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'cursor' ? t.copied : t.btnCopy}</span>
                </button>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 ltr text-left max-h-24 overflow-y-auto">
                <pre>{cursorConfigSnippet}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
