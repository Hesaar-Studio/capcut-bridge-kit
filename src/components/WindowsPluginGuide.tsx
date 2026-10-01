import React, { useState } from 'react';
import { Download, Terminal, Play, Check, Copy, ExternalLink, ShieldCheck, Cpu, HardDrive, Layers, Server } from 'lucide-react';

interface WindowsPluginGuideProps {
  onDownloadWinScript: () => void;
  onDownloadInstaller: () => void;
  onDownloadPluginDaemon: () => void;
}

export const WindowsPluginGuide: React.FC<WindowsPluginGuideProps> = ({
  onDownloadWinScript,
  onDownloadInstaller,
  onDownloadPluginDaemon,
}) => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [testEndpoint, setTestEndpoint] = useState<string>('/api/v1/status');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleTestPing = async () => {
    if ((testEndpoint === '/api/v1/export' || testEndpoint === '/api/v1/split') &&
        !window.confirm('این عملیات میانبر صفحه‌کلید را به برنامه‌ی فعال می‌فرستد. پنجره‌ی CapCut را فعال کن. ادامه می‌دهی؟')) {
      return;
    }

    setIsPinging(true);
    setTestResponse(null);
    const method = testEndpoint === '/api/v1/status' || testEndpoint === '/api/v1/drafts' ? 'GET' : 'POST';
    try {
      const response = await fetch(`http://127.0.0.1:8765${testEndpoint}`, { method });
      const body = await response.text();
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        payload = { response: body };
      }
      if (!response.ok) {
        setTestResponse(JSON.stringify({ success: false, status: response.status, detail: payload }, null, 2));
        return;
      }
      setTestResponse(JSON.stringify(payload, null, 2));
    } catch (error) {
      setTestResponse(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        hint: 'مطمئن شو capcut-plugin-win.py روی همین دستگاه اجراست.'
      }, null, 2));
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Introduction in Persian & English */}
      <div className="p-6 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
          <div dir="rtl">
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>پلاگین و نصب در ویندوز (Windows Plugin & Installer)</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              راهنمای کامل نصب، راه‌اندازی سرور پلاگین پس‌زمینه (Local Plugin Daemon) و اتصال نرم‌افزارهای خارجی به کپکات دسکتاپ در ویندوز.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onDownloadInstaller}
              className="px-3 py-1.5 text-xs font-semibold text-black bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>دانلود فایل نصب یک‌کلیک (install-plugin-win.bat)</span>
            </button>
          </div>
        </div>

        {/* 3 Pillar Architectural Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <Cpu className="w-4 h-4" />
              <span>۱. آیا کپکات پلاگین رسمی دارد؟</span>
            </div>
            <p className="text-neutral-400 text-[11px] leading-relaxed">
              شرکت ByteDance استور رسمی برای پلاگین ندارد؛ اما با استفاده از این کیت، کپکات از طریق دستکاری مستقیم پروژه‌ها بر روی هارد و شبیه‌سازی کلیدهای میانبر (<code className="text-neutral-200">pyautogui</code>) به صورت کامل مانند یک پلاگین حرفه‌ای کنترل‌پذیر می‌شود.
            </p>
          </div>

          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-blue-400 font-semibold">
              <Server className="w-4 h-4" />
              <span>۲. پلاگین سرور محلی (REST API)</span>
            </div>
            <p className="text-neutral-400 text-[11px] leading-relaxed">
              فایل <code className="text-neutral-200">capcut-plugin-win.py</code> یک سرویس پس‌زمینه در آدرس <code className="text-emerald-400">http://127.0.0.1:8765</code> ایجاد می‌کند تا هر نرم‌افزاری (پریمیر، فتوشاپ، افزونه مرورگر یا اسکریپت) بتواند با ارسال درخواست HTTP به کپکات دستور دهد.
            </p>
          </div>

          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-purple-400 font-semibold">
              <HardDrive className="w-4 h-4" />
              <span>۳. نصب سراسری در ویندوز (CLI)</span>
            </div>
            <p className="text-neutral-400 text-[11px] leading-relaxed">
              اسکریپت نصب‌کننده <code className="text-neutral-200">.bat</code> به صورت اتوماتیک پکیج‌ها را نصب کرده، پوشه پلاگین را در <code className="text-neutral-200">%USERPROFILE%\.capcut-bridge</code> می‌سازد و دستور <code className="text-emerald-400">capcut-bridge</code> را به ترمینال ویندوز اضافه می‌کند.
            </p>
          </div>
        </div>
      </div>

      {/* Installation Steps & Code Boxes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Step-by-Step Installation */}
        <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>مراحل نصب و اجرا در ویندوز (Windows Setup)</span>
          </h3>

          <div className="space-y-3 text-xs">
            {/* Step 1 */}
            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between text-neutral-300 font-medium">
                <span>مرحله ۱: پیش‌نیاز (نصب پایتون)</span>
                <span className="text-[10px] text-emerald-400 font-mono">Python 3.11+</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                پایتون را از سایت رسمی (python.org) نصب کنید و حتماً تیک گزینه <strong className="text-neutral-200">"Add Python to PATH"</strong> را بزنید.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-neutral-300 font-medium">
                <span>مرحله ۲: نصب وابستگی‌ها با یک دستور در CMD</span>
                <button
                  onClick={() => handleCopy('pip install pyautogui pillow flask requests pywin32', 'pip')}
                  className="text-emerald-400 hover:underline text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedCmd === 'pip' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCmd === 'pip' ? 'کپی شد' : 'کپی دستور'}</span>
                </button>
              </div>
              <div className="p-2 bg-black border border-neutral-800 rounded font-mono text-emerald-400 text-[11px] select-all">
                pip install pyautogui pillow flask requests pywin32
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-neutral-300 font-medium">
                <span>مرحله ۳: اجرای اسکریپت یا سرور پلاگین</span>
                <button
                  onClick={() => handleCopy('python capcut-bridge-win.py ls', 'run')}
                  className="text-emerald-400 hover:underline text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedCmd === 'run' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCmd === 'run' ? 'کپی شد' : 'کپی دستور'}</span>
                </button>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="p-2 bg-black border border-neutral-800 rounded text-neutral-300 select-all">
                  python capcut-bridge-win.py ls
                </div>
                <div className="p-2 bg-black border border-neutral-800 rounded text-emerald-400 select-all">
                  python capcut-plugin-win.py
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Interactive Local Plugin REST Tester */}
        <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>تست واقعی API سرور پلاگین ویندوز (Local REST Tester)</span>
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
              Live API · Port 8765
            </span>
          </div>

          <p className="text-xs text-neutral-400 leading-relaxed">
            این پنل به daemon واقعی روی همین دستگاه وصل می‌شود. daemon باید اجرا باشد. برای split/export پنجره‌ی CapCut را فعال کن؛ میانبرها به برنامه‌ی foreground می‌روند و نتیجه‌ی نهایی اینجا قابل راستی‌آزمایی نیست:
          </p>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <select
                value={testEndpoint}
                onChange={(e) => setTestEndpoint(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              >
                <option value="/api/v1/status">GET /api/v1/status (وضعیت کپکات)</option>
                <option value="/api/v1/drafts">GET /api/v1/drafts (لیست پروژه‌ها)</option>
                <option value="/api/v1/export">POST /api/v1/export (اکسپورت با Ctrl+E)</option>
                <option value="/api/v1/split">POST /api/v1/split (برش با Ctrl+B)</option>
              </select>

              <button
                onClick={handleTestPing}
                disabled={isPinging}
                className="px-3 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isPinging ? 'در حال ارسال...' : 'ارسال درخواست'}</span>
              </button>
            </div>

            {/* Response Preview */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono text-neutral-400">Response (JSON):</span>
              <pre className="p-3 bg-black border border-neutral-800 rounded-lg font-mono text-[11px] text-emerald-400 max-h-48 overflow-x-auto leading-relaxed">
                {testResponse || '// برای مشاهده پاسخ، دکمه "ارسال درخواست" را کلیک کنید.'}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
