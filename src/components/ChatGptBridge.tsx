import React, { useState } from 'react';
import { Bot, Copy, Check, Terminal, Download, ArrowRight, Play, Sparkles, BookOpen, Layers, Zap } from 'lucide-react';

export const ChatGptBridge: React.FC = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedExample, setSelectedExample] = useState(0);
  const [customPrompt, setCustomPrompt] = useState(
    'ویدیوی intro.mov را بردار، ۳ ثانیه اولش را کات بزن، متن «سلام به همگی» را روش بذار و خروجی بگیر.'
  );
  const [simulatedState, setSimulatedState] = useState<{
    functionName: string;
    arguments: Record<string, any>;
    command: string;
    log: string[];
  } | null>(null);

  const examples = [
    {
      title: 'کات زدن و درج زیرنویس و اکسپورت',
      prompt: 'ویدیوی intro.mov را بردار، ۳ ثانیه اولش را کات بزن، متن «سلام به همگی» را روش بذار و خروجی بگیر.',
      func: 'add_text_caption & export_video',
      args: { draft_name: 'Auto_Project', text: 'سلام به همگی', at: 0.0, duration: 3.0 },
      cmd: 'uv run capcut-bridge.py add-text "Auto_Project" "سلام به همگی" --at 0.0 --dur 3.0 && uv run capcut-bridge.py export',
      logs: [
        '[ChatGPT] Parsed intent: Add caption at 0.0s for 3.0s, then trigger automated export.',
        '[CapCut Bridge] Gracefully closing CapCut to edit draft JSON...',
        '[CapCut Bridge] Wiping Timelines/ cache and hardlinking media into Resources/...',
        '[CapCut Bridge] Text segment added with repaired source_timerange.',
        '[CapCut Bridge] Launching CapCut & driving Export dialog via Cmd+E...',
        '[CapCut Bridge] Cleared post-export share modal. Video exported successfully!',
      ],
    },
    {
      title: 'ساخت ویدیوی جدید از روی چند کات (Replay)',
      prompt: '۳ تا ویدیوی اول پوشه تدوین من را پشت سر هم بچین، هر کدام ۲.۵ ثانیه و نام پروژه را Reels_V1 بذار.',
      func: 'replay_draft',
      args: {
        draft_name: 'Reels_V1',
        cuts: [
          { source_path: '~/Movies/Takes/take1.mov', start: 0, duration: 2.5 },
          { source_path: '~/Movies/Takes/take2.mov', start: 0, duration: 2.5 },
          { source_path: '~/Movies/Takes/take3.mov', start: 0, duration: 2.5 },
        ],
      },
      cmd: 'uv run capcut-bridge.py replay ./cuts.json --name "Reels_V1"',
      logs: [
        '[ChatGPT] Generated cuts.json matching CapCut input contract.',
        '[CapCut Bridge] Erasing previous draft Reels_V1...',
        '[CapCut Bridge] Hardlinking 3 takes into ~/Movies sandbox.',
        '[CapCut Bridge] Created new timeline with 3 clips (Total 7.5s).',
        '[CapCut Bridge] CapCut relaunched with new timeline ready.',
      ],
    },
    {
      title: 'پرش به ثانیه ۴ و اعمال کات فیزیکی (Split)',
      prompt: 'برو روی ثانیه ۴.۲ تایم‌لاین و کلیپ رو برش بزن.',
      func: 'split_clip',
      args: { seconds: 4.2 },
      cmd: 'uv run capcut-bridge.py split 4.2',
      logs: [
        '[ChatGPT] Parsed Live Lane command: Seek to 4.2s and synthesize Cmd+B.',
        '[Live Lane] Seeking playhead to 00:00:04.200...',
        '[Live Lane] Synthesized hardware CGEvent: Cmd+B (Split).',
        '[Live Lane] Clip successfully divided at 4.2s without restart.',
      ],
    },
  ];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRunSim = (idx: number) => {
    const ex = examples[idx];
    setSimulatedState({
      functionName: ex.func,
      arguments: ex.args,
      command: ex.cmd,
      log: ex.logs,
    });
  };

  const pythonAgentCode = `import openai
import subprocess

client = openai.OpenAI(api_key="YOUR_OPENAI_API_KEY")

# Tools definition
tools = [
    {
        "type": "function",
        "function": {
            "name": "capcut_add_text",
            "description": "Add caption to CapCut timeline",
            "parameters": {
                "type": "object",
                "properties": {
                    "draft": {"type": "string"},
                    "text": {"type": "string"},
                    "at": {"type": "number"},
                    "dur": {"type": "number"}
                },
                "required": ["draft", "text", "at"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "capcut_export",
            "description": "Export the current project",
            "parameters": {"type": "object", "properties": {}}
        }
    }
]

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a professional video editor driving CapCut."},
        {"role": "user", "content": "روی ثانیه ۱ متن «تخفیف ویژه» رو بذار و بعد خروجی بگیر."}
    ],
    tools=tools
)

# Execute the tool calls via CapCut Bridge
for tool_call in response.choices[0].message.tool_calls or []:
    if tool_call.function.name == "capcut_add_text":
        args = json.loads(tool_call.function.arguments)
        subprocess.run(["uv", "run", "capcut-bridge.py", "add-text", args["draft"], args["text"], "--at", str(args["at"])])
    elif tool_call.function.name == "capcut_export":
        subprocess.run(["uv", "run", "capcut-bridge.py", "export"])
`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-emerald-400" />
            <span>اتصال مستقیم به ChatGPT (AI Video Editor)</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            با اتصال ChatGPT به سرور CapCut Bridge، چت‌جی‌پی‌تی دستورات متنی فارسی یا انگلیسی شما را مستقیماً به ویدیو و تدوین در کپکات تبدیل می‌کند.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/chatgpt-capcut-server.py"
            download="chatgpt-capcut-server.py"
            className="px-3 py-1.5 text-xs font-medium text-black bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>دانلود سرور chatgpt-capcut-server.py</span>
          </a>
        </div>
      </div>

      {/* 3 Step Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-700 flex items-center justify-center text-[11px]">
              ۱
            </span>
            <span>درخواست به زبان طبیعی</span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            در چت معمولی می‌گویید: «این ویدیو را برش بزن و زیرنویس اضافه کن و خروجی بگیر».
          </p>
        </div>

        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
            <span className="w-5 h-5 rounded-full bg-purple-950 border border-purple-700 flex items-center justify-center text-[11px]">
              ۲
            </span>
            <span>Function Calling چت‌جی‌پی‌تی</span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            هوش مصنوعی دستور شما را به توابع تدوین کپکات (`replay`, `add_text`, `export`) تبدیل می‌کند.
          </p>
        </div>

        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
            <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-700 flex items-center justify-center text-[11px]">
              ۳
            </span>
            <span>اجرای بلادرنگ روی کپکات دسکتاپ</span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            سرور لوکال، فرآیند را روی کپکات اعمال کرده و نتیجه را به چت‌جی‌پی‌تی بازمی‌گرداند.
          </p>
        </div>
      </div>

      {/* Interactive Simulator */}
      <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>شبیه‌ساز مکالمه و ادیت با ChatGPT</span>
          </span>
          <span className="text-[11px] text-neutral-400">یک نمونه را انتخاب کرده یا دکمه شبیه‌سازی را بزنید:</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => {
                setSelectedExample(i);
                setCustomPrompt(ex.prompt);
                handleRunSim(i);
              }}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
                selectedExample === i
                  ? 'bg-neutral-800 border-neutral-700 text-white'
                  : 'bg-neutral-950 border-neutral-900 text-neutral-400 hover:text-white'
              }`}
            >
              {ex.title}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-sans"
            dir="rtl"
          />
          <button
            onClick={() => handleRunSim(selectedExample)}
            className="px-4 py-2 text-xs font-medium text-black bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Play className="w-3.5 h-3.5" />
            <span>اجرای شبیه‌سازی</span>
          </button>
        </div>

        {/* Simulation Output Card */}
        {simulatedState && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Function Call JSON */}
            <div className="p-3 bg-black border border-neutral-800 rounded-lg space-y-2">
              <span className="text-[11px] font-mono text-neutral-400 block">
                ChatGPT Function Call Output:
              </span>
              <pre className="text-xs font-mono text-purple-400 overflow-x-auto leading-relaxed">
                {JSON.stringify(
                  {
                    name: simulatedState.functionName,
                    arguments: simulatedState.arguments,
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            {/* Terminal execution */}
            <div className="p-3 bg-black border border-neutral-800 rounded-lg space-y-2">
              <span className="text-[11px] font-mono text-neutral-400 block">
                CapCut Bridge Execution:
              </span>
              <div className="text-xs font-mono text-emerald-400 break-all pb-1 border-b border-neutral-900">
                $ {simulatedState.command}
              </div>
              <div className="space-y-1 text-[11px] font-mono text-neutral-400 max-h-36 overflow-y-auto">
                {simulatedState.log.map((l, i) => (
                  <div key={i} className={l.includes('successfully') ? 'text-emerald-400' : ''}>
                    {l}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Integration Code Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Method 1: Custom GPT Action OpenAPI Spec */}
        <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>روش اول: اتصال ChatGPT ابری (فعلاً غیرفعال)</span>
            </span>
            <button
              type="button"
              disabled
              className="px-2 py-1 text-xs text-neutral-500 bg-neutral-800 rounded flex items-center gap-1 cursor-not-allowed"
            >
              <span>اتصال ابری در این نسخه فعال نیست</span>
            </button>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            سرور فعلی فقط روی همین دستگاه در دسترس است و احراز هویت برای انتشار عمومی ندارد. اتصال ChatGPT ابری در این نسخه پیکربندی نشده است؛ سرور را با ngrok یا Cloudflare Tunnel عمومی نکنید.
          </p>
          <div className="p-3 bg-black border border-neutral-800 rounded-lg font-mono text-xs text-neutral-300 select-all max-h-48 overflow-y-auto">
            {`# Local development only; do not expose this unauthenticated API publicly.\nuv run chatgpt-capcut-server.py\n\n# ChatGPT cloud access is not configured in this version.`}
          </div>
        </div>

        {/* Method 2: Python Script with OpenAI API */}
        <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>روش دوم: اسکریپت پایتون خودکار (OpenAI Tools)</span>
            </span>
            <button
              onClick={() => handleCopy(pythonAgentCode, 'python_code')}
              className="px-2 py-1 text-xs text-black bg-emerald-400 hover:bg-emerald-300 rounded transition-colors flex items-center gap-1 cursor-pointer"
            >
              {copied === 'python_code' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copied === 'python_code' ? 'کپی شد!' : 'کپی کد پایتون'}</span>
            </button>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            این اسکریپت پیام‌های متنی شما را با مدل GPT-4o تحلیل کرده و توابع CapCut Bridge را اجرا می‌کند:
          </p>
          <pre className="p-3 bg-black border border-neutral-800 rounded-lg font-mono text-[11px] text-emerald-400 max-h-48 overflow-y-auto leading-relaxed select-all">
            {pythonAgentCode}
          </pre>
        </div>
      </div>
    </div>
  );
};
