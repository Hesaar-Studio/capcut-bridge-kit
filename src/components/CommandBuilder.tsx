import React, { useState } from 'react';
import { Copy, Check, Play, Terminal, Shield, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { CommandDefinition, LaneType, Platform } from '../types';

export const COMMANDS: CommandDefinition[] = [
  // File Lane
  {
    id: 'replay',
    name: 'replay',
    lane: 'file',
    description: 'Rebuilds a draft from scratch using cuts.json (one clip per cut). Wipes previous draft.',
    usage: 'uv run capcut-bridge.py replay <job> [--name <draft>]',
    example: 'uv run capcut-bridge.py replay ./cuts.json --name "Hook_Promo_V1"',
    hardRuleRef: 'Quits CapCut, erases Timelines/ cache, hardlinks footage to Resources/, rebuilds from scratch.',
    args: [
      { name: 'job', type: 'string', label: 'Job File (cuts.json)', defaultValue: './sample-cuts.json', required: true },
      { name: 'name', type: 'string', label: 'Draft Name', defaultValue: 'Hook_Promo_V1' },
    ],
  },
  {
    id: 'add-overlay',
    name: 'add-overlay',
    lane: 'file',
    description: 'Inserts B-roll, green screen or animation overlay on top of existing project.',
    usage: 'uv run capcut-bridge.py add-overlay <draft> <mov> --at <s> [--layer N] [--dur <s>] [--src <s>] [--ri N] [--mute] [--force]',
    example: 'uv run capcut-bridge.py add-overlay "Hook_Promo_V1" ~/Movies/Broll/demo.mov --at 2.5 --dur 3.0 --layer 1 --mute',
    hardRuleRef: 'Additive command. Preserves existing hand-edits. Hardlinks media to ~/Movies sandbox.',
    args: [
      { name: 'draft', type: 'string', label: 'Draft Name', defaultValue: 'Hook_Promo_V1', required: true },
      { name: 'mov', type: 'string', label: 'Video Path (~/Movies/...)', defaultValue: '~/Movies/Broll/demo.mov', required: true },
      { name: 'at', type: 'number', label: 'Timeline Start (s)', defaultValue: 2.5, required: true },
      { name: 'dur', type: 'number', label: 'Duration (s)', defaultValue: 3.0 },
      { name: 'layer', type: 'number', label: 'Track Layer (N)', defaultValue: 1 },
      { name: 'mute', type: 'boolean', label: 'Mute Audio', defaultValue: true },
    ],
  },
  {
    id: 'add-text',
    name: 'add-text',
    lane: 'file',
    description: 'Appends styled caption or hook text segment with repaired timerange.',
    usage: 'uv run capcut-bridge.py add-text <draft> "<text>" --at <s> [--dur <s>] [--ri N] [--force]',
    example: 'uv run capcut-bridge.py add-text "Hook_Promo_V1" "STOP SCROLLING 🚨" --at 0.2 --dur 2.0',
    hardRuleRef: 'Auto-repairs source_timerange to prevent encoder hang during export.',
    args: [
      { name: 'draft', type: 'string', label: 'Draft Name', defaultValue: 'Hook_Promo_V1', required: true },
      { name: 'text', type: 'string', label: 'Caption Text', defaultValue: 'STOP SCROLLING 🚨', required: true },
      { name: 'at', type: 'number', label: 'Timeline Start (s)', defaultValue: 0.2, required: true },
      { name: 'dur', type: 'number', label: 'Duration (s)', defaultValue: 2.0 },
    ],
  },
  {
    id: 'graphics',
    name: 'graphics',
    lane: 'file',
    description: 'Places a job’s entire multi-element graphics plan (captions, stickers, overlays).',
    usage: 'uv run capcut-bridge.py graphics <draft> <job>',
    example: 'uv run capcut-bridge.py graphics "Hook_Promo_V1" ./sample-graphics-plan.json',
    hardRuleRef: 'Batch validates all text materials & anim refs. Wipes Timelines/ cache cleanly.',
    args: [
      { name: 'draft', type: 'string', label: 'Draft Name', defaultValue: 'Hook_Promo_V1', required: true },
      { name: 'job', type: 'string', label: 'Graphics Plan File', defaultValue: './sample-graphics-plan.json', required: true },
    ],
  },
  {
    id: 'transform',
    name: 'transform',
    lane: 'file',
    description: 'Adjusts scale, translation coordinates, rotation or opacity of a segment.',
    usage: 'uv run capcut-bridge.py transform <draft> [--track main|text|overlay] [--index N] [--scale S] [--x X] [--y Y] [--rotate R]',
    example: 'uv run capcut-bridge.py transform "Hook_Promo_V1" --track overlay --index 0 --scale 1.25 --y -0.15',
    hardRuleRef: 'Direct JSON matrix update without touching unselected tracks.',
    args: [
      { name: 'draft', type: 'string', label: 'Draft Name', defaultValue: 'Hook_Promo_V1', required: true },
      { name: 'track', type: 'select', label: 'Target Track', defaultValue: 'overlay', options: ['main', 'text', 'overlay'] },
      { name: 'index', type: 'number', label: 'Segment Index', defaultValue: 0 },
      { name: 'scale', type: 'number', label: 'Scale Factor', defaultValue: 1.25 },
      { name: 'x', type: 'number', label: 'Offset X (-1.0 to 1.0)', defaultValue: 0.0 },
      { name: 'y', type: 'number', label: 'Offset Y (-1.0 to 1.0)', defaultValue: -0.15 },
    ],
  },
  {
    id: 'ls',
    name: 'ls',
    lane: 'file',
    description: 'Lists all recognized drafts in CapCut projects folder with timeline durations.',
    usage: 'uv run capcut-bridge.py ls',
    example: 'uv run capcut-bridge.py ls',
    hardRuleRef: 'Scans ~/Movies/CapCut/User Data/Projects/com.lveditor.draft/ without relaunching.',
    args: [],
  },

  // Live Lane
  {
    id: 'seek',
    name: 'seek',
    lane: 'live',
    description: 'Performs frame-exact closed-loop playhead positioning in active editor.',
    usage: 'uv run capcut-bridge.py seek <seconds> [--draft <name>]',
    example: 'uv run capcut-bridge.py seek 3.45',
    hardRuleRef: 'Direct accessibility tree coordinate lookup without closing CapCut.',
    args: [
      { name: 'seconds', type: 'number', label: 'Timestamp (seconds)', defaultValue: 3.45, required: true },
      { name: 'draft', type: 'string', label: 'Draft Name (optional)', defaultValue: '' },
    ],
  },
  {
    id: 'split',
    name: 'split',
    lane: 'live',
    description: 'Splits clip at current playhead or seeks to seconds and cuts (Cmd+B).',
    usage: 'uv run capcut-bridge.py split [seconds]',
    example: 'uv run capcut-bridge.py split 4.2',
    hardRuleRef: 'Synthesizes hardware key events via Quartz CGEvents.',
    args: [
      { name: 'seconds', type: 'number', label: 'Cut At (seconds, optional)', defaultValue: 4.2 },
    ],
  },
  {
    id: 'export',
    name: 'export',
    lane: 'live',
    description: 'Drives CapCut export modal, waits for encode, and auto-dismisses TikTok share modal.',
    usage: 'uv run capcut-bridge.py export [--to <dir>] [--timeout <s>]',
    example: 'uv run capcut-bridge.py export --to ~/Movies/Exports --timeout 90',
    hardRuleRef: 'Hard Rule 6: Automatically dismisses modal share screen to prevent app lockup or accidental publishing.',
    args: [
      { name: 'to', type: 'string', label: 'Output Directory', defaultValue: '~/Movies/Exports' },
      { name: 'timeout', type: 'number', label: 'Timeout (seconds)', defaultValue: 60 },
    ],
  },
  {
    id: 'play',
    name: 'play',
    lane: 'live',
    description: 'Toggles preview playback in CapCut monitor using Space or PlayerPlayBtn test hook.',
    usage: 'uv run capcut-bridge.py play',
    example: 'uv run capcut-bridge.py play',
    hardRuleRef: 'Uses test hook PlayerPlayBtn via Accessibility tree.',
    args: [],
  },
  {
    id: 'shot',
    name: 'shot',
    lane: 'live',
    description: 'Captures CapCut editor window snapshot for automated QA and visual verification.',
    usage: 'uv run capcut-bridge.py shot [out.png]',
    example: 'uv run capcut-bridge.py shot qa_review.png',
    hardRuleRef: 'Invokes macOS screencapture against CapCut window ID.',
    args: [
      { name: 'out', type: 'string', label: 'Output PNG File', defaultValue: 'qa_review.png' },
    ],
  },
  {
    id: 'dump',
    name: 'dump',
    lane: 'live',
    description: 'Dumps all ByteDance internal automation hooks (PlayerPlayBtn, MTLSVideoP, etc.).',
    usage: 'uv run capcut-bridge.py dump [needle]',
    example: 'uv run capcut-bridge.py dump Button',
    hardRuleRef: 'Discovers new or updated test hook IDs across CapCut desktop versions.',
    args: [
      { name: 'needle', type: 'string', label: 'Filter Needle', defaultValue: 'Btn' },
    ],
  },
];

interface CommandBuilderProps {
  platform?: Platform;
}

export const CommandBuilder: React.FC<CommandBuilderProps> = ({ platform = 'mac' }) => {
  const [selectedLane, setSelectedLane] = useState<LaneType>('file');
  const [selectedCmdId, setSelectedCmdId] = useState<string>('replay');
  const [formValues, setFormValues] = useState<Record<string, any>>({
    job: './sample-cuts.json',
    name: 'Hook_Promo_V1',
    draft: 'Hook_Promo_V1',
    mov: platform === 'win' ? 'C:\\Users\\User\\Videos\\demo.mov' : '~/Movies/Broll/demo.mov',
    at: 2.5,
    dur: 3.0,
    layer: 1,
    mute: true,
    text: 'STOP SCROLLING 🚨',
    track: 'overlay',
    index: 0,
    scale: 1.25,
    x: 0.0,
    y: -0.15,
    seconds: 3.45,
    to: platform === 'win' ? 'C:\\Users\\User\\Videos\\Exports' : '~/Movies/Exports',
    timeout: 60,
    out: platform === 'win' ? 'capcut_win_qa.png' : 'qa_review.png',
    needle: 'Btn',
  });

  const [copied, setCopied] = useState(false);
  const [simOutput, setSimOutput] = useState<string[] | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const filteredCommands = COMMANDS.filter((c) => c.lane === selectedLane);
  const currentCmd = COMMANDS.find((c) => c.id === selectedCmdId) || filteredCommands[0];

  const handleArgChange = (argName: string, val: any) => {
    setFormValues((prev) => ({ ...prev, [argName]: val }));
  };

  // Generate the CLI string
  const generateCommandString = () => {
    if (!currentCmd) return '';
    const scriptName = platform === 'win' ? 'capcut-bridge-win.py' : 'capcut-bridge.py';
    let parts = ['uv', 'run', scriptName, currentCmd.name];

    currentCmd.args.forEach((arg) => {
      const val = formValues[arg.name];
      if (val === undefined || val === '') return;

      if (arg.type === 'boolean') {
        if (val === true) {
          parts.push(`--${arg.name}`);
        }
      } else if (arg.name === 'job' || arg.name === 'draft' || arg.name === 'mov' || arg.name === 'text' || arg.name === 'seconds') {
        // Positional args
        if (arg.name === 'text') {
          parts.push(`"${val}"`);
        } else {
          parts.push(`${val}`);
        }
      } else {
        // Flag args
        parts.push(`--${arg.name}`);
        parts.push(typeof val === 'string' && val.includes(' ') ? `"${val}"` : `${val}`);
      }
    });

    return parts.join(' ');
  };

  const commandStr = generateCommandString();

  const handleCopy = () => {
    navigator.clipboard.writeText(commandStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateRun = () => {
    setIsSimulating(true);
    setSimOutput(null);

    const logs: string[] = [];

    if (currentCmd.lane === 'file') {
      logs.push(`$ ${commandStr}`);
      if (platform === 'win') {
        logs.push('[CapCut Bridge Win] Querying Windows process table (tasklist)...');
        logs.push('[CapCut Bridge Win] CapCut.exe found running. Gracefully closing via taskkill /IM CapCut.exe...');
        logs.push('[CapCut Bridge Win] Process terminated cleanly. Registry state saved.');
        logs.push(`[CapCut Bridge Win] Inspecting %LOCALAPPDATA%\\CapCut\\User Data\\Projects\\com.lveditor.draft\\${formValues.draft || formValues.name || 'Draft'}`);
        logs.push('[CapCut Bridge Win] [Hard Rule 3] Deleting native Timelines/ folder to trigger draft re-read on launch...');
        if (currentCmd.id === 'replay' || currentCmd.id === 'add-overlay') {
          logs.push('[CapCut Bridge Win] Linking media files into Resources/ directory...');
        }
        if (currentCmd.id === 'add-text' || currentCmd.id === 'graphics') {
          logs.push('[CapCut Bridge Win] [Hard Rule 5] Repaired null source_timeranges to prevent video encoder deadlock.');
        }
        logs.push('[CapCut Bridge Win] Writing sanitized draft_content.json...');
        logs.push('[CapCut Bridge Win] Launching C:\\Program Files\\CapCut\\CapCut.exe via subprocess.Popen()...');
        logs.push('[CapCut Bridge Win] Success! Draft reloaded in Windows CapCut.');
      } else {
        logs.push('[CapCut Bridge] Checking CapCut process status...');
        logs.push('[CapCut Bridge] Process active (PID: 48921). Gracefully quitting CapCut via AppleScript...');
        logs.push('[CapCut Bridge] CapCut closed cleanly. Registry saved.');
        logs.push(`[CapCut Bridge] Inspecting draft folder ~/Movies/CapCut/User Data/Projects/com.lveditor.draft/${formValues.draft || formValues.name || 'Draft'}`);
        logs.push('[CapCut Bridge] [Hard Rule 3] Wiping native Timelines/ cache to force JSON reload on next open...');
        if (currentCmd.id === 'replay' || currentCmd.id === 'add-overlay') {
          logs.push('[CapCut Bridge] [Hard Rule 2] Checking source media sandbox path...');
          logs.push('[CapCut Bridge] Hardlinking media into draft Resources/ (avoiding red broken clip error).');
        }
        if (currentCmd.id === 'add-text' || currentCmd.id === 'graphics') {
          logs.push('[CapCut Bridge] [Hard Rule 5] Auditing text segments: repaired 1 null source_timeranges to prevent encoder crash.');
        }
        logs.push('[CapCut Bridge] Writing modified draft_content.json to disk...');
        logs.push('[CapCut Bridge] [Hard Rule 1] Relaunching CapCut desktop...');
        logs.push('[CapCut Bridge] Success! Draft updated and loaded in CapCut.');
      }
    } else {
      logs.push(`$ ${commandStr}`);
      if (platform === 'win') {
        logs.push('[Live Lane Win] Initializing pyautogui automation driver...');
        if (currentCmd.id === 'seek') {
          logs.push(`[Live Lane Win] pyautogui: Focusing timeline and moving playhead to ${formValues.seconds || 3.45}s...`);
          logs.push('[Live Lane Win] Playhead positioned.');
        } else if (currentCmd.id === 'split') {
          logs.push('[Live Lane Win] pyautogui.hotkey("ctrl", "b") -> Sent Split Cut command to active CapCut window.');
          logs.push('[Live Lane Win] Split cut applied at playhead.');
        } else if (currentCmd.id === 'export') {
          logs.push('[Live Lane Win] pyautogui.hotkey("ctrl", "e") -> Opened Export dialog.');
          logs.push('[Live Lane Win] Waiting 1.2s for window focus...');
          logs.push('[Live Lane Win] pyautogui.press("enter") -> Confirming export...');
          logs.push('[Live Lane Win] Encoding in progress (1080x1920, 30fps)...');
          logs.push('[Live Lane Win] pyautogui.press("esc") -> Dismissing post-export share modal.');
          logs.push(`[Live Lane Win] Export finished successfully! Saved to ${formValues.to}\\video.mp4`);
        } else if (currentCmd.id === 'play') {
          logs.push('[Live Lane Win] pyautogui.press("space") -> Toggled Play/Pause in preview player.');
        } else if (currentCmd.id === 'shot') {
          logs.push('[Live Lane Win] pyautogui.screenshot() -> Saved preview snapshot for QA verification.');
        } else {
          logs.push('[Live Lane Win] Action executed successfully via pyautogui.');
        }
      } else {
        logs.push('[Live Lane] Connecting to macOS Accessibility Server via AXUIElement...');
        logs.push('[Live Lane] Located CapCut instance (PID: 48921, Bundle: com.lemon.lvpro)');
        if (currentCmd.id === 'seek') {
          logs.push(`[Live Lane] Seeking playhead to ${formValues.seconds || 3.45}s...`);
          logs.push('[Live Lane] Playhead aligned at timecode 00:00:03.450.');
        } else if (currentCmd.id === 'split') {
          logs.push('[Live Lane] Synthesizing hardware CGEvent: Cmd + B (Split Cut)...');
          logs.push('[Live Lane] Cut applied at current playhead.');
        } else if (currentCmd.id === 'export') {
          logs.push('[Live Lane] Synthesizing Cmd + E to trigger Export dialog...');
          logs.push('[Live Lane] Confirming export preset: 1080x1920, H.264, 30fps...');
          logs.push('[Live Lane] Encoding video (progress: 100%)...');
          logs.push('[Live Lane] [Hard Rule 6] Detected modal "Share to TikTok/YouTube" dialog.');
          logs.push('[Live Lane] Synthesizing Escape key to dismiss share modal without publishing.');
          logs.push('[SIMULATION] No export was run and no output file was verified.');
        } else if (currentCmd.id === 'dump') {
          logs.push('[Live Lane] Scanning accessibility tree for ByteDance test hooks...');
          logs.push(' • [Hook Found] ID: PlayerPlayBtn         Role: AXButton');
          logs.push(' • [Hook Found] ID: PlayerTimeLabel       Role: AXStaticText');
          logs.push(' • [Hook Found] ID: ExportBtn             Role: AXButton');
          logs.push(' • [Hook Found] ID: MTLSVideoP:MainTrack  Role: AXUnknown (QML Component)');
          logs.push(' • [Hook Found] ID: SplitButton           Role: AXButton');
        } else {
          logs.push('[Live Lane] Executed hardware action successfully.');
        }
      }
    }

    setTimeout(() => {
      setSimOutput(logs);
      setIsSimulating(false);
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* Lane Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white">Interactive Command Studio</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Build and test commands for both File Lane (JSON direct manipulation) and Live Lane (macOS Accessibility automation).
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-lg self-start sm:self-auto">
          <button
            onClick={() => {
              setSelectedLane('file');
              const firstFile = COMMANDS.find((c) => c.lane === 'file');
              if (firstFile) setSelectedCmdId(firstFile.id);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              selectedLane === 'file'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            File Lane (Structural Builds)
          </button>
          <button
            onClick={() => {
              setSelectedLane('live');
              const firstLive = COMMANDS.find((c) => c.lane === 'live');
              if (firstLive) setSelectedCmdId(firstLive.id);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              selectedLane === 'live'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Live Lane (Real-Time Control)
          </button>
        </div>
      </div>

      {/* Main Grid: Command Selector & Param Config */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Command List */}
        <div className="lg:col-span-4 space-y-2">
          <span className="text-xs font-medium text-neutral-400 tracking-wider">
            {selectedLane === 'file' ? 'FILE LANE COMMANDS' : 'LIVE LANE COMMANDS'}
          </span>
          <div className="space-y-1.5 mt-2">
            {filteredCommands.map((cmd) => {
              const isSelected = cmd.id === currentCmd.id;
              return (
                <button
                  key={cmd.id}
                  onClick={() => setSelectedCmdId(cmd.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-neutral-900 border-neutral-700 text-white shadow-sm'
                      : 'bg-neutral-950 border-neutral-900 text-neutral-400 hover:bg-neutral-900/60 hover:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-emerald-400">{cmd.name}</span>
                    <span className="text-xs text-neutral-400 font-mono">
                      {cmd.lane === 'file' ? 'JSON' : 'AX/Quartz'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                    {cmd.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Hard Rule Notice */}
          <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg text-xs space-y-1.5 mt-4">
            <div className="flex items-center gap-1.5 text-amber-400 font-medium">
              <Shield className="w-3.5 h-3.5" />
              <span>Hard Rule Protection</span>
            </div>
            <p className="text-neutral-300 leading-relaxed">
              {currentCmd.hardRuleRef}
            </p>
          </div>
        </div>

        {/* Right Column: Argument Form & Generated Output */}
        <div className="lg:col-span-8 space-y-5">
          {/* Argument Form Card */}
          <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Configure: <code className="font-mono text-emerald-400">{currentCmd.name}</code></span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">{currentCmd.usage}</p>
              </div>
            </div>

            {currentCmd.args.length === 0 ? (
              <p className="text-xs text-neutral-400 py-3">
                This command takes no required parameters. It operates directly against active CapCut instances or global project directories.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentCmd.args.map((arg) => (
                  <div key={arg.name} className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300 flex items-center justify-between">
                      <span>{arg.label}</span>
                      {arg.required && <span className="text-amber-400 text-xs">required</span>}
                    </label>

                    {arg.type === 'select' ? (
                      <select
                        value={formValues[arg.name] ?? arg.defaultValue}
                        onChange={(e) => handleArgChange(arg.name, e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      >
                        {arg.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : arg.type === 'boolean' ? (
                      <div className="flex items-center gap-2 pt-1.5">
                        <input
                          type="checkbox"
                          id={arg.name}
                          checked={formValues[arg.name] ?? arg.defaultValue ?? false}
                          onChange={(e) => handleArgChange(arg.name, e.target.checked)}
                          className="rounded border-neutral-700 bg-neutral-950 text-emerald-500 focus:ring-emerald-500"
                        />
                        <label htmlFor={arg.name} className="text-xs text-neutral-400 cursor-pointer">
                          Enable flag (--{arg.name})
                        </label>
                      </div>
                    ) : (
                      <input
                        type={arg.type === 'number' ? 'number' : 'text'}
                        step={arg.type === 'number' ? 'any' : undefined}
                        value={formValues[arg.name] ?? arg.defaultValue ?? ''}
                        onChange={(e) =>
                          handleArgChange(
                            arg.name,
                            arg.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                          )
                        }
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generated Command Box */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-neutral-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Executable Shell Command
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSimulateRun}
                  disabled={isSimulating}
                  className="px-2.5 py-1 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-3 h-3 text-emerald-400" />
                  <span>Simulate Run</span>
                </button>
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 text-xs font-medium text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied!' : 'Copy Command'}</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-neutral-900/90 rounded-lg font-mono text-xs text-emerald-400 overflow-x-auto select-all leading-relaxed border border-neutral-800">
              {commandStr}
            </div>
          </div>

          {/* Terminal Simulator Output */}
          {simOutput && (
            <div className="p-4 bg-black/90 border border-neutral-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-900">
                <span className="text-xs font-mono text-neutral-400">Terminal stdout simulator</span>
                <span className="text-xs text-emerald-500 font-mono">Exit Code 0</span>
              </div>
              <pre className="font-mono text-xs text-neutral-300 space-y-1 overflow-x-auto max-h-56">
                {simOutput.map((line, idx) => (
                  <div
                    key={idx}
                    className={
                      line.startsWith('$')
                        ? 'text-white font-semibold'
                        : line.includes('Hard Rule')
                        ? 'text-amber-400'
                        : line.includes('Success') || line.includes('Verified')
                        ? 'text-emerald-400'
                        : 'text-neutral-400'
                    }
                  >
                    {line}
                  </div>
                ))}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
