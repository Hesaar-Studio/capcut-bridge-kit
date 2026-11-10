export type CommandIntentName =
  | 'split_at_playhead'
  | 'play_pause'
  | 'export'
  | 'add_text'
  | 'inspect_timeline'
  | 'unsupported';

export type CommandIntent = {
  intent: CommandIntentName;
  projectName?: string;
  text?: string;
  at?: number;
  duration?: number;
  reason?: string;
};

export type ValidatedCommand = CommandIntent & {
  requiresConfirmation: boolean;
  title: string;
  tool?: string;
};

const SAFE_PROJECT_NAME = /^[A-Za-z0-9][A-Za-z0-9 _().-]{0,79}$/;

function unsupported(reason: string): ValidatedCommand {
  return { intent: 'unsupported', requiresConfirmation: false, reason, title: 'Unsupported request' };
}

function hasExplicitSplitPosition(text: string): boolean {
  const value = text.toLocaleLowerCase();
  return /\b(?:at|on|around)\s+(?:second\s+)?\d+(?:\.\d+)?\s*(?:s|sec|secs|second|seconds)?\b/.test(value)
    || /\b(?:at|on)\s+\d{1,2}:\d{2}(?::\d{2})?\b/.test(value)
    || /(?:در|روی|ثانیه)\s*\d+(?:\.\d+)?\s*(?:ثانیه)?/.test(value)
    || /\d{1,2}:\d{2}(?::\d{2})/.test(value);
}

export function parseLocalCommand(text: string, projectName?: string): CommandIntent {
  const value = text.trim().toLocaleLowerCase();
  if (!value) return { intent: 'unsupported', reason: 'Enter an editing request.' };

  const addTextEnglish = text.match(/(?:add|insert|put)\s+(?:a\s+)?(?:text|caption|subtitle)\s+[“"']([^“"']{1,2000})[”"']\s+(?:at|from)\s+(\d+(?:\.\d+)?)(?:\s*(?:s|sec|seconds?))?(?:\s+for\s+(\d+(?:\.\d+)?)(?:\s*(?:s|sec|seconds?))?)?/i);
  const addTextPersian = text.match(/(?:متن|زیرنویس)\s*[«"']([^»"']{1,2000})[»"']\s*(?:را\s*)?(?:در|از)\s*(?:ثانیه\s*)?(\d+(?:\.\d+)?)(?:\s*ثانیه)?/);
  const textMatch = addTextEnglish || addTextPersian;
  if (textMatch) {
    return {
      intent: 'add_text',
      projectName,
      text: textMatch[1].trim(),
      at: Number(textMatch[2]),
      duration: textMatch[3] ? Number(textMatch[3]) : 3,
    };
  }

  if (/(?:analy[sz]e|inspect|read)\s+(?:the\s+)?timeline|(?:بررسی|تحلیل|نمایش)\s*(?:وضعیت\s*)?تایم.?لاین/.test(value)) {
    return { intent: 'inspect_timeline', projectName };
  }
  if (/(?:split|cut)\s+(?:the\s+)?(?:clip|timeline)?|(?:برش|کات)\s*(?:بزن|انجام|کن)?/.test(value)) {
    if (hasExplicitSplitPosition(text)) {
      return { intent: 'split_at_playhead', reason: 'A split at a specified time is not supported. Move CapCut’s playhead to the target position, then request a split.' };
    }
    return { intent: 'split_at_playhead' };
  }
  if (/(?:play|pause|toggle playback)|(?:پخش|توقف|مکث)/.test(value)) {
    return { intent: 'play_pause' };
  }
  if (/(?:export|render|اکسپورت|خروجی\s*(?:بگیر|گرفتن)|رندر)/.test(value)) {
    return { intent: 'export' };
  }

  return { intent: 'unsupported', reason: 'This command is not in the current allowlist. Supported actions: inspect timeline, add quoted text at a time, split at the current playhead, play/pause, and export.' };
}

export function validateProviderIntent(
  providerRaw: unknown,
  deterministicRaw: unknown,
  selectedProjectName?: string,
  originalText = '',
): ValidatedCommand {
  const deterministic = validateCommandIntent(deterministicRaw, selectedProjectName, originalText);
  if (deterministic.intent === 'unsupported') return deterministic;

  const provider = validateCommandIntent(providerRaw, selectedProjectName, originalText);
  if (provider.intent !== deterministic.intent) {
    return unsupported('The AI classification disagreed with the deterministic parse of the explicit request. No action was executed.');
  }
  if (deterministic.intent === 'add_text') {
    if (provider.text !== deterministic.text || provider.at !== deterministic.at || provider.duration !== deterministic.duration) {
      return unsupported('The AI classification changed the quoted text or timing from the explicit request. No action was executed.');
    }
  }
  // Dispatch only the locally parsed and validated fields, never provider output.
  return deterministic;
}

export function validateCommandIntent(
  raw: unknown,
  selectedProjectName?: string,
  originalText = '',
): ValidatedCommand {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return unsupported('The intent classifier returned an invalid response.');
  const value = raw as Record<string, unknown>;
  const intent = value.intent as CommandIntentName;
  // The renderer's explicit selection is authoritative. Never let a model invent or
  // switch a filesystem target from the natural-language prompt.
  const projectName = selectedProjectName && SAFE_PROJECT_NAME.test(selectedProjectName) && selectedProjectName !== '.' && selectedProjectName !== '..'
    ? selectedProjectName
    : undefined;

  if (intent === 'split_at_playhead') {
    if (hasExplicitSplitPosition(originalText)) {
      return unsupported('A split at a specified time is not supported. Move CapCut’s playhead to the target position, then request a split.');
    }
    return { intent, requiresConfirmation: true, title: 'Split at current playhead', tool: 'capcut_live_split' };
  }
  if (intent === 'play_pause') {
    return { intent, requiresConfirmation: true, title: 'Toggle CapCut playback', tool: 'capcut_live_play' };
  }
  if (intent === 'export') {
    if (/\b(?:to|save\s+to)\s+[^\s]+/i.test(originalText)) {
      return unsupported('Custom export destinations are not supported by the current bridge. Use CapCut’s own export dialog to choose a path.');
    }
    return { intent, requiresConfirmation: true, title: 'Send the CapCut export shortcut', tool: 'capcut_live_export' };
  }
  if (intent === 'inspect_timeline') {
    if (!projectName) return unsupported('Select a real CapCut project before asking to inspect its timeline.');
    return { intent, projectName, requiresConfirmation: false, title: `Inspect ${projectName}`, tool: 'inspect_capcut_timeline' };
  }
  if (intent === 'add_text') {
    const text = typeof value.text === 'string' ? value.text.trim() : '';
    const at = Number(value.at);
    const duration = value.duration === undefined ? 3 : Number(value.duration);
    if (!projectName) return unsupported('Select an existing CapCut project before adding text.');
    if (!text || text.length > 2000) return unsupported('Text must contain 1–2000 characters.');
    if (!Number.isFinite(at) || at < 0 || !Number.isFinite(duration) || duration <= 0 || duration > 3600) {
      return unsupported('The text timing is invalid. Use a non-negative start and a duration greater than zero.');
    }
    return { intent, projectName, text, at, duration, requiresConfirmation: true, title: `Add text to ${projectName}`, tool: 'add_capcut_text' };
  }
  if (intent === 'unsupported') {
    const reason = typeof value.reason === 'string' && value.reason.trim()
      ? value.reason.trim().slice(0, 400)
      : 'The requested operation is not currently supported.';
    return unsupported(reason);
  }
  return unsupported('The requested operation is not in the allowlist. No command was executed.');
}
