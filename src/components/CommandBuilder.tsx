import React, { useState } from 'react';
import { Copy, Check, Terminal, Shield, AlertCircle } from 'lucide-react';
import { CommandDefinition, LaneType, Platform } from '../types';

export const COMMANDS: CommandDefinition[] = [
  // File Lane
  {
    id: 'replay',
    name: 'replay',
    lane: 'file',
    description: 'Builds a new project draft from cuts.json. Existing projects are refused unless explicit overwrite confirmation is supplied.',
    usage: 'uv run capcut-bridge.py replay <job> [--name <draft>] [--overwrite --confirm-name <draft>]',
    example: 'uv run capcut-bridge.py replay ./cuts.json --name "Hook_Promo_V1"',
    hardRuleRef: 'Writes a staged draft and verifies JSON/readback. CapCut parsing, timeline display, and rendering are not verified.',
    supportStatus: 'JSON_WRITE',
    supportedPlatforms: ['mac', 'win'],
    supportNote: 'Creates a new draft JSON with disk readback/structure checks; never proves the CapCut editor accepted it.',
    args: [
      { name: 'job', type: 'string', label: 'Job File (cuts.json)', defaultValue: './sample-cuts.json', required: true },
      { name: 'name', type: 'string', label: 'Draft Name', defaultValue: 'Hook_Promo_V1' },
    ],
  },
  {
    id: 'add-overlay',
    name: 'add-overlay',
    lane: 'file',
    description: 'Adds an overlay segment to the local draft JSON (macOS CLI only); CapCut acceptance is not checked.',
    usage: 'uv run capcut-bridge.py add-overlay <draft> <mov> --at <s> [--layer N] [--dur <s>] [--src <s>] [--ri N] [--mute]',
    example: 'uv run capcut-bridge.py add-overlay "Hook_Promo_V1" ~/Movies/Broll/demo.mov --at 2.5 --dur 3.0 --layer 1 --mute',
    hardRuleRef: 'Changes draft JSON and stages media into project Resources; no live NLE edit/readback is performed.',
    supportStatus: 'JSON_WRITE',
    supportedPlatforms: ['mac'],
    supportNote: 'The Windows CLI does not expose this command. macOS JSON mutation is not CapCut UI verification.',
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
    description: 'Adds a text material/segment to the local draft JSON; the editor’s rendering of the text is unverified.',
    usage: 'uv run capcut-bridge.py add-text <draft> "<text>" --at <s> [--dur <s>] [--ri N]',
    example: 'uv run capcut-bridge.py add-text "Hook_Promo_V1" "STOP SCROLLING 🚨" --at 0.2 --dur 2.0',
    hardRuleRef: 'Writes draft JSON with a non-null source range; this is not proof CapCut displays or exports the caption.',
    supportStatus: 'JSON_WRITE',
    supportedPlatforms: ['mac', 'win'],
    supportNote: 'The Windows and macOS CLIs mutate project JSON. No in-editor or rendered-frame readback is implemented.',
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
    description: 'Adds text elements from a graphics plan to the local draft JSON; non-text elements are not implemented.',
    usage: 'uv run capcut-bridge.py graphics <draft> <job>',
    example: 'uv run capcut-bridge.py graphics "Hook_Promo_V1" ./sample-graphics-plan.json',
    hardRuleRef: 'JSON-only mutation on macOS. No animation/overlay import, editor acceptance, or render verification.',
    supportStatus: 'JSON_WRITE',
    supportedPlatforms: ['mac'],
    supportNote: 'Text elements only; not exposed by the Windows CLI, and not read back from CapCut.',
    args: [
      { name: 'draft', type: 'string', label: 'Draft Name', defaultValue: 'Hook_Promo_V1', required: true },
      { name: 'job', type: 'string', label: 'Graphics Plan File', defaultValue: './sample-graphics-plan.json', required: true },
    ],
  },
  {
    id: 'transform',
    name: 'transform',
    lane: 'file',
    description: 'Edits scale, position, rotation, or a volume field in the local draft JSON; it does not operate the editor.',
    usage: 'uv run capcut-bridge.py transform <draft> [--track main|text|overlay] [--index N] [--scale S] [--x X] [--y Y] [--rotate R] [--opacity O]',
    example: 'uv run capcut-bridge.py transform "Hook_Promo_V1" --track overlay --index 0 --scale 1.25 --y -0.15',
    hardRuleRef: 'JSON-only mutation. The --opacity flag writes volume, and no NLE/render readback is available.',
    supportStatus: 'JSON_WRITE',
    supportedPlatforms: ['mac'],
    supportNote: 'macOS CLI only. The opacity parameter currently maps to volume; editor interpretation is unverified.',
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
    description: 'Lists draft folders in the configured local CapCut projects directory; macOS also attempts to read JSON durations.',
    usage: 'uv run capcut-bridge.py ls',
    example: 'uv run capcut-bridge.py ls',
    hardRuleRef: 'Read-only filesystem listing; does not connect to the running editor.',
    supportStatus: 'READ_ONLY',
    supportedPlatforms: ['mac', 'win'],
    supportNote: 'Local folder read only. Windows currently lists names without timeline-duration readback.',
    args: [],
  },

  // Live Lane
  {
    id: 'seek',
    name: 'seek',
    lane: 'live',
    description: 'Unsupported: deterministic editor seek and playhead readback are not implemented.',
    usage: 'uv run capcut-bridge.py seek <seconds> [--draft <name>]',
    example: 'uv run capcut-bridge.py seek 3.45',
    hardRuleRef: 'The macOS command raises NotImplementedError; Windows has no seek command. No event is sent.',
    supportStatus: 'UNSUPPORTED',
    supportedPlatforms: [],
    supportNote: 'Not executable on either supported CLI. This UI only displays a command preview.',
    args: [
      { name: 'seconds', type: 'number', label: 'Timestamp (seconds)', defaultValue: 3.45, required: true },
      { name: 'draft', type: 'string', label: 'Draft Name (optional)', defaultValue: '' },
    ],
  },
  {
    id: 'split',
    name: 'split',
    lane: 'live',
    description: 'Sends a split shortcut to the foreground CapCut window; timed splits are unsupported and no timeline state is read back.',
    usage: 'uv run capcut-bridge.py split',
    example: 'uv run capcut-bridge.py split',
    hardRuleRef: 'A keyboard event may be sent; the resulting edit remains UNVERIFIED. No seek/split readback is implemented.',
    supportStatus: 'LIVE_UNVERIFIED',
    supportedPlatforms: ['mac', 'win'],
    supportNote: 'Foreground keypress only; no split readback. Timed split is unsupported.',
    args: [],
  },
  {
    id: 'export',
    name: 'export',
    lane: 'live',
    description: 'Sends a keyboard shortcut sequence only; export dialog state, render completion, destination, and output file are not verified.',
    usage: 'uv run capcut-bridge.py export',
    example: 'uv run capcut-bridge.py export',
    hardRuleRef: 'UNVERIFIED keyboard interaction. No export-completion or file readback is implemented; no publish action is claimed.',
    supportStatus: 'LIVE_UNVERIFIED',
    supportedPlatforms: ['mac', 'win'],
    supportNote: 'Destination arguments are unsupported; the command may send keypresses to the foreground editor but cannot confirm results.',
    args: [],
  },
  {
    id: 'play',
    name: 'play',
    lane: 'live',
    description: 'Sends Space to the foreground editor; playback state is not read back.',
    usage: 'uv run capcut-bridge.py play',
    example: 'uv run capcut-bridge.py play',
    hardRuleRef: 'Keyboard event only. Playback toggle remains UNVERIFIED.',
    supportStatus: 'LIVE_UNVERIFIED',
    supportedPlatforms: ['mac', 'win'],
    supportNote: 'No active-editor playback status or timeline readback is available.',
    args: [],
  },
  {
    id: 'shot',
    name: 'shot',
    lane: 'live',
    description: 'Captures a desktop screenshot after a foreground check; it does not verify the editor timeline.',
    usage: 'uv run capcut-bridge.py shot [out.png]',
    example: 'uv run capcut-bridge.py shot qa_review.png',
    hardRuleRef: 'macOS verifies the screenshot file; Windows reports the screenshot action without a file readback.',
    supportStatus: 'PARTIAL',
    supportedPlatforms: ['mac', 'win'],
    supportNote: 'Screenshot is not an edit receipt. macOS readback is stronger than the Windows path; overwrite behavior differs.',
    args: [
      { name: 'out', type: 'string', label: 'Output PNG File', defaultValue: 'qa_review.png' },
    ],
  },
  {
    id: 'dump',
    name: 'dump',
    lane: 'live',
    description: 'Unsupported: accessibility-tree dump and hook discovery are not implemented.',
    usage: 'uv run capcut-bridge.py dump [needle]',
    example: 'uv run capcut-bridge.py dump Button',
    hardRuleRef: 'The command raises NotImplementedError; no hooks or editor state are reported.',
    supportStatus: 'UNSUPPORTED',
    supportedPlatforms: [],
    supportNote: 'Not executable on either supported CLI. This UI only displays a command preview.',
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
  const [previewOutput, setPreviewOutput] = useState<string[] | null>(null);

  const filteredCommands = COMMANDS.filter((c) => c.lane === selectedLane);
  const currentCmd = COMMANDS.find((c) => c.id === selectedCmdId) || filteredCommands[0];

  const handleArgChange = (argName: string, val: any) => {
    setFormValues((prev) => ({ ...prev, [argName]: val }));
  };

  // Generate a copyable command preview; this UI never launches a child process.
  const quoteShellValue = (value: unknown) => {
    const text = String(value);
    if (platform === 'win') {
      // The Windows preview is specifically for PowerShell single-quoted strings.
      return `'${text.replace(/'/g, "''")}'`;
    }
    if (text.startsWith('~/')) {
      const rest = text.slice(2).replace(/'/g, "'\\''");
      return `"$HOME"/'${rest}'`;
    }
    return `'${text.replace(/'/g, "'\\''")}'`;
  };

  const generateCommandString = () => {
    if (!currentCmd) return '';
    const scriptName = platform === 'win' ? 'capcut-bridge-win.py' : 'capcut-bridge.py';
    const parts = ['uv', 'run', scriptName, currentCmd.name];

    currentCmd.args.forEach((arg) => {
      const val = formValues[arg.name];
      if (val === undefined || val === '') return;

      if (arg.type === 'boolean') {
        if (val === true) parts.push(`--${arg.name}`);
      } else if (
        arg.name === 'job' || arg.name === 'draft' || arg.name === 'mov' ||
        arg.name === 'text' || arg.name === 'seconds' || arg.name === 'out' || arg.name === 'needle'
      ) {
        if (currentCmd.id === 'seek' && arg.name === 'draft') {
          parts.push('--draft', quoteShellValue(val));
        } else {
          parts.push(quoteShellValue(val));
        }
      } else {
        parts.push(`--${arg.name}`, quoteShellValue(val));
      }
    });

    return parts.join(' ');
  };

  const commandStr = generateCommandString();
  const isSupportedOnPlatform = Boolean(currentCmd?.supportedPlatforms.includes(platform));

  const supportLabels = {
    READ_ONLY: 'READ ONLY',
    JSON_WRITE: 'JSON-ONLY WRITE',
    LIVE_UNVERIFIED: 'LIVE · UNVERIFIED',
    ARTIFACT_READBACK: 'ARTIFACT READBACK',
    PARTIAL: 'PARTIAL · PLATFORM-DEPENDENT',
    UNSUPPORTED: 'UNSUPPORTED',
  };

  const handleCopy = async () => {
    if (!isSupportedOnPlatform || !commandStr) return;
    try {
      await navigator.clipboard.writeText(commandStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleShowPreview = () => {
    setPreviewOutput([
      'PREVIEW ONLY — this UI did not launch a command or contact CapCut.',
      `Platform: ${platform === 'win' ? 'Windows / PowerShell' : 'macOS / POSIX shell'}`,
      `Command support: ${supportLabels[currentCmd.supportStatus]}`,
      `Parser available for selected platform: ${isSupportedOnPlatform ? 'yes' : 'no'}`,
      `Command: ${commandStr}`,
      `Verification boundary: ${currentCmd.supportNote}`,
      `Scope: ${currentCmd.hardRuleRef || 'No additional verification evidence recorded.'}`,
    ]);
  };
  return (
    <div className="space-y-6">
      {/* Lane Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white">Command Preview Builder</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Build or copy a CLI preview only. This panel never launches a process; JSON writes and live keyboard actions have different verification limits.
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
            File Lane (filesystem / JSON)
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
            Live Lane (Keyboard · Unverified)
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
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-emerald-400">{cmd.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
                      cmd.supportStatus === 'UNSUPPORTED'
                        ? 'text-rose-300 border-rose-900 bg-rose-950/30'
                        : cmd.supportStatus === 'LIVE_UNVERIFIED' || cmd.supportStatus === 'PARTIAL'
                        ? 'text-amber-300 border-amber-900 bg-amber-950/30'
                        : 'text-slate-300 border-slate-700 bg-slate-900'
                    }`}>
                      {supportLabels[cmd.supportStatus]}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                    {cmd.description}
                  </p>
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Parser: {cmd.supportedPlatforms.length ? cmd.supportedPlatforms.join(', ') : 'none'}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Capability and verification boundary */}
          <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg text-xs space-y-1.5 mt-4">
            <div className="flex items-center gap-1.5 text-amber-400 font-medium">
              <Shield className="w-3.5 h-3.5" />
              <span>Capability &amp; verification boundary</span>
            </div>
            <p className="text-neutral-300 leading-relaxed">{currentCmd.supportNote}</p>
            <p className="text-neutral-500 leading-relaxed">{currentCmd.hardRuleRef}</p>
            {!isSupportedOnPlatform && (
              <p className="text-rose-300 leading-relaxed">This command is not exposed by the selected platform CLI; copying is disabled.</p>
            )}
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
                No parameters are configured for this command in the preview builder. See the support boundary before running it outside this UI.
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

          {/* Command preview: it is never executed from this UI */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-mono text-neutral-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                {platform === 'win' ? 'PowerShell command preview' : 'POSIX shell command preview'}
                <span className="text-amber-300">· not executed</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShowPreview}
                  className="px-2.5 py-1 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors cursor-pointer"
                >
                  Show scope
                </button>
                <button
                  onClick={handleCopy}
                  disabled={!isSupportedOnPlatform}
                  title={!isSupportedOnPlatform ? 'This command is not available in the selected platform CLI.' : undefined}
                  className="px-2.5 py-1 text-xs font-medium text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors flex items-center gap-1 cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied preview' : 'Copy command preview'}</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-neutral-900/90 rounded-lg font-mono text-xs text-neutral-200 overflow-x-auto select-all leading-relaxed border border-neutral-800">
              {commandStr}
            </div>
            <p className="text-[11px] text-amber-200/90">
              Copying does not execute the command. Review the support status, filesystem effects, and backup policy before running it yourself.
            </p>
          </div>

          {previewOutput && (
            <div className="p-4 bg-black/90 border border-neutral-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-900">
                <span className="text-xs font-mono text-neutral-400">Command preview details · no process launched</span>
                <span className="text-xs text-amber-300 font-mono">UNEXECUTED</span>
              </div>
              <pre className="font-mono text-xs text-neutral-300 whitespace-pre-wrap overflow-x-auto max-h-56">
                {previewOutput.map((line, idx) => (
                  <div
                    key={idx}
                    className={line.startsWith('PREVIEW ONLY') || line.includes('UNVERIFIED') || line.includes('UNSUPPORTED') || line.includes('Parser available')
                      ? 'text-amber-300'
                      : 'text-neutral-400'}
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
