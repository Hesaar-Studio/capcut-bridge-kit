import express, { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';
import dotenv from 'dotenv';
import { createFixedWindowRateLimiter } from './server_rate_limit.ts';
import { parseLocalCommand, validateCommandIntent, validateProviderIntent, type ValidatedCommand } from './desktop/command-parser';

type BridgeController = {
  getStatus: () => Promise<unknown> | unknown;
  listProjects: () => Promise<unknown>;
  inspectProject: (projectName: string) => Promise<unknown>;
  createProject: (projectName: string, cuts: unknown[]) => Promise<unknown>;
  addText: (projectName: string, text: string, at: number, duration: number) => Promise<unknown>;
  executeIntent: (intent: ValidatedCommand) => Promise<unknown>;
  callContract?: (operation: string, parameters: Record<string, unknown>) => Promise<unknown>;
  getLogs?: (lines: number) => Promise<unknown> | unknown;
};

type ServerOptions = {
  production?: boolean;
  staticPath?: string;
  bridge?: BridgeController | null;
  getApiKey?: () => string | Promise<string>;
  logger?: { info?: (message: string) => void; warn?: (message: string) => void; error?: (message: string) => void };
  allowPreviewHosts?: boolean;
};

const MAX_COMMAND_LENGTH = 2000;
const SAFE_PROJECT_NAME = /^[A-Za-z0-9][A-Za-z0-9 _().-]{0,79}$/;
const READ_ONLY_CONTRACT_OPERATIONS = new Set([
  'get_capabilities', 'get_capcut_surface_map', 'list_projects', 'inspect_project', 'inspect_timeline', 'inspect_media',
  'inspect_subtitles', 'analyze_gaps', 'analyze_duplicates', 'create_edit_plan',
  'validate_edit_plan', 'preview_edit_plan', 'get_execution_receipt',
]);
const rateLimiters = {
  generateVideo: createFixedWindowRateLimiter(2, 60 * 60 * 1000),
  videoStatus: createFixedWindowRateLimiter(60, 60 * 1000),
  videoDownload: createFixedWindowRateLimiter(5, 10 * 60 * 1000),
  transcribeAudio: createFixedWindowRateLimiter(8, 10 * 60 * 1000),
  chat: createFixedWindowRateLimiter(30, 60 * 1000),
  generateMusic: createFixedWindowRateLimiter(3, 60 * 60 * 1000),
  bridgeCommand: createFixedWindowRateLimiter(30, 60 * 1000),
  bridgeContract: createFixedWindowRateLimiter(60, 60 * 1000),
  projectMutation: createFixedWindowRateLimiter(12, 60 * 60 * 1000),
};

function applyRateLimit(limiter: (key: string) => { allowed: boolean; retryAfterSeconds: number }) {
  return (req: Request, res: Response, next: express.NextFunction) => {
    const decision = limiter(req.ip || 'loopback');
    if (!decision.allowed) {
      res.setHeader('Retry-After', String(decision.retryAfterSeconds));
      return res.status(429).json({ error: 'Request limit reached. Please retry later.' });
    }
    next();
  };
}

function isLoopbackHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  try {
    const hostname = new URL(`http://${hostHeader}`).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

function cleanError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || 'Unexpected error');
  return raw
    .replace(/AIza[\w-]{20,}/g, '[redacted key]')
    .replace(/Bearer\s+[\w.\-]+/gi, 'Bearer [redacted]')
    .replace(/(api[_-]?key\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
    .slice(0, 1000);
}

function isProjectName(value: unknown): value is string {
  return typeof value === 'string' && SAFE_PROJECT_NAME.test(value) && value !== '.' && value !== '..';
}

export function createApp(options: ServerOptions = {}) {
  const app = express();
  const isProduction = options.production ?? process.env.NODE_ENV === 'production';
  const bridge = options.bridge ?? null;
  const allowPreviewHosts = options.allowPreviewHosts === true;
  let aiClient: { key: string; client: GoogleGenAI } | null = null;

  app.disable('x-powered-by');

  // Local API only. Browser writes must be same-origin, preventing cross-site requests
  // and DNS-rebinding access to the user's local editing services.
  app.use('/api', (req: Request, res: Response, next) => {
    const hostHeader = req.get('host');
    if (!isLoopbackHost(hostHeader) && !allowPreviewHosts) {
      return res.status(403).json({ error: 'This local API only accepts loopback hosts.' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      const originHeader = req.get('origin');
      if (!originHeader) {
        return res.status(403).json({ error: 'A same-origin request is required.' });
      }
      try {
        const origin = new URL(originHeader);
        const sameHost = origin.host.toLowerCase() === (hostHeader || '').toLowerCase();
        const validProtocol = origin.protocol === 'http:' || (allowPreviewHosts && origin.protocol === 'https:');
        if (!sameHost || !validProtocol) {
          return res.status(403).json({ error: 'Cross-origin API requests are not allowed.' });
        }
      } catch {
        return res.status(403).json({ error: 'Invalid request origin.' });
      }
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const getApiKey = async () => {
    try {
      const value = options.getApiKey ? await options.getApiKey() : process.env.GEMINI_API_KEY || '';
      return typeof value === 'string' ? value.trim() : '';
    } catch (error) {
      options.logger?.warn?.(`AI credential lookup failed: ${cleanError(error)}`);
      return '';
    }
  };

  const getAiClient = async () => {
    const key = await getApiKey();
    if (!key) return null;
    if (!aiClient || aiClient.key !== key) {
      aiClient = {
        key,
        client: new GoogleGenAI({
          apiKey: key,
          httpOptions: { headers: { 'User-Agent': 'HS.Tech-AI-Video-Bridge' } },
        }),
      };
    }
    return aiClient.client;
  };

  app.get('/api/health', async (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: process.env.HS_TECH_APP_VERSION || process.env.npm_package_version || 'unknown',
      geminiConfigured: Boolean(await getApiKey()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/desktop/status', async (_req: Request, res: Response) => {
    if (!bridge) return res.status(503).json({ error: 'Desktop service manager is not available in this run mode.' });
    try {
      res.json(await bridge.getStatus());
    } catch (error) {
      res.status(503).json({ error: cleanError(error) });
    }
  });

  app.get('/api/desktop/logs', async (req: Request, res: Response) => {
    if (!bridge?.getLogs) return res.status(503).json({ error: 'Desktop log viewer is not available in this run mode.' });
    const requested = Number.parseInt(String(req.query.lines || '120'), 10);
    const lines = Number.isFinite(requested) ? Math.min(500, Math.max(1, requested)) : 120;
    try {
      res.json(await bridge.getLogs(lines));
    } catch (error) {
      res.status(500).json({ error: cleanError(error) });
    }
  });

  app.get('/api/bridge/projects', async (_req: Request, res: Response) => {
    if (!bridge) return res.status(503).json({ error: 'The local MCP bridge is not available in this run mode.' });
    try {
      res.json(await bridge.listProjects());
    } catch (error) {
      res.status(503).json({ error: cleanError(error) });
    }
  });

  app.get('/api/bridge/projects/:projectName', async (req: Request, res: Response) => {
    if (!isProjectName(req.params.projectName)) return res.status(400).json({ error: 'Invalid project name.' });
    if (!bridge) return res.status(503).json({ error: 'The local MCP bridge is not available in this run mode.' });
    try {
      res.json(await bridge.inspectProject(req.params.projectName));
    } catch (error) {
      res.status(404).json({ error: cleanError(error) });
    }
  });

  app.post('/api/bridge/contract', applyRateLimit(rateLimiters.bridgeContract), async (req: Request, res: Response) => {
    const { operation, parameters } = req.body || {};
    if (typeof operation !== 'string' || !READ_ONLY_CONTRACT_OPERATIONS.has(operation)) {
      return res.status(400).json({ error: 'Contract operation is not in the read-only allowlist.' });
    }
    if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters) || 'projects_dir' in parameters) {
      return res.status(400).json({ error: 'parameters must be an object; arbitrary filesystem roots are not accepted.' });
    }
    try {
      if (JSON.stringify(parameters).length > 500_000) return res.status(413).json({ error: 'Contract parameters exceed the size limit.' });
    } catch {
      return res.status(400).json({ error: 'Contract parameters must be JSON-serializable.' });
    }
    if ('project_name' in parameters && !isProjectName(parameters.project_name)) {
      return res.status(400).json({ error: 'Invalid project name.' });
    }
    if (!bridge?.callContract) return res.status(503).json({ error: 'Provider-neutral contract tools are not available in this run mode.' });
    try {
      res.json(await bridge.callContract(operation, parameters as Record<string, unknown>));
    } catch (error) {
      res.status(422).json({ error: cleanError(error) });
    }
  });

  app.post('/api/bridge/projects', applyRateLimit(rateLimiters.projectMutation), async (req: Request, res: Response) => {
    const { projectName, cuts } = req.body || {};
    if (!isProjectName(projectName)) return res.status(400).json({ error: 'Project name must be 1–80 safe characters.' });
    if (!Array.isArray(cuts) || cuts.length < 1 || cuts.length > 500) {
      return res.status(400).json({ error: 'Provide between 1 and 500 media cuts.' });
    }
    if (!cuts.every((cut) => cut && typeof cut.source_path === 'string' && cut.source_path.length <= 2048 && Number.isFinite(cut.start) && cut.start >= 0 && Number.isFinite(cut.duration) && cut.duration > 0)) {
      return res.status(400).json({ error: 'Each cut needs a local media path, start time ≥ 0, and duration > 0.' });
    }
    if (!bridge) return res.status(503).json({ error: 'The local MCP bridge is not available in this run mode.' });
    try {
      res.json(await bridge.createProject(projectName, cuts));
    } catch (error) {
      res.status(500).json({ error: cleanError(error) });
    }
  });

  app.post('/api/bridge/add-text', applyRateLimit(rateLimiters.projectMutation), async (req: Request, res: Response) => {
    const { projectName, text, at, duration } = req.body || {};
    if (!isProjectName(projectName)) return res.status(400).json({ error: 'A valid project name is required.' });
    if (typeof text !== 'string' || !text.trim() || text.length > 2000) return res.status(400).json({ error: 'Text must contain 1–2000 characters.' });
    const start = Number(at);
    const length = duration === undefined ? 3 : Number(duration);
    if (!Number.isFinite(start) || start < 0 || !Number.isFinite(length) || length <= 0 || length > 3600) {
      return res.status(400).json({ error: 'Timeline start and duration must be valid positive seconds.' });
    }
    if (!bridge) return res.status(503).json({ error: 'The local MCP bridge is not available in this run mode.' });
    try {
      res.json(await bridge.addText(projectName, text.trim(), start, length));
    } catch (error) {
      res.status(500).json({ error: cleanError(error) });
    }
  });

  app.post('/api/bridge/command', applyRateLimit(rateLimiters.bridgeCommand), async (req: Request, res: Response) => {
    const { text, projectName, confirmed } = req.body || {};
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_COMMAND_LENGTH) {
      return res.status(400).json({ error: `Command must contain 1–${MAX_COMMAND_LENGTH} characters.` });
    }
    if (projectName !== undefined && !isProjectName(projectName)) return res.status(400).json({ error: 'Invalid project name.' });
    if (!bridge) return res.status(503).json({ error: 'The local MCP bridge is not available in this run mode.' });

    const deterministicIntent = parseLocalCommand(text.trim(), projectName);
    let providerIntent: unknown;
    let interpretedBy: 'gemini' | 'allowlist-parser' = 'allowlist-parser';
    const ai = await getAiClient();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: [{ role: 'user', parts: [{ text: text.trim() }] }],
          config: {
            responseMimeType: 'application/json',
            systemInstruction: [
              'Classify the user request into exactly one safe CapCut Bridge intent and return one JSON object only.',
              'Allowed intent values: split_at_playhead, play_pause, export, add_text, inspect_timeline, unsupported.',
              'Allowed JSON keys: intent, text, at, duration, reason. Never include paths, shell commands, credentials, or a project name.',
              'Use add_text only when quoted text and a numeric timeline start are explicit. Duration defaults to 3 seconds.',
              'A split is only at the current playhead; requests for a timestamped split are unsupported.',
              'Unsupported examples include importing media, arbitrary commands, file access, project overwrite, or export to a custom path.',
              'Do not claim that any editing operation has happened. This is classification only.',
            ].join(' '),
          },
        });
        const jsonText = (response.text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        providerIntent = JSON.parse(jsonText);
        interpretedBy = 'gemini';
      } catch (error) {
        options.logger?.warn?.(`AI intent interpretation failed; using the deterministic parser: ${cleanError(error)}`);
      }
    }

    const intent = interpretedBy === 'gemini'
      ? validateProviderIntent(providerIntent, deterministicIntent, projectName, text.trim())
      : validateCommandIntent(deterministicIntent, projectName, text.trim());
    if (intent.intent === 'unsupported') {
      return res.status(422).json({ status: 'unsupported', interpretedBy, intent, message: intent.reason });
    }

    if (intent.intent === 'inspect_timeline') {
      try {
        const result = await bridge.inspectProject(intent.projectName!);
        return res.json({ status: 'readback_complete', interpretedBy, intent, result });
      } catch (error) {
        return res.status(404).json({ status: 'failed', interpretedBy, intent, error: cleanError(error) });
      }
    }

    if (intent.requiresConfirmation && confirmed !== true) {
      return res.json({ status: 'planned', interpretedBy, intent, message: 'Review this action, then explicitly confirm to execute it.' });
    }

    try {
      const result = await bridge.executeIntent(intent);
      const verified = Boolean((result as { verified?: boolean } | null)?.verified);
      return res.json({
        status: verified ? 'draft_readback_verified' : 'sent_unverified',
        interpretedBy,
        intent,
        verified,
        verificationScope: verified ? 'on_disk_draft_readback_only' : 'keyboard_events_only',
        result,
        message: verified
          ? 'The on-disk draft JSON was read back and matched the requested change. CapCut acceptance and rendering remain unverified.'
          : 'Keyboard events were sent; no editor-side timeline state or export output was verified.',
      });
    } catch (error) {
      options.logger?.error?.(`Bridge command failed (${intent.intent}): ${cleanError(error)}`);
      return res.status(500).json({ status: 'failed', interpretedBy, intent, error: cleanError(error) });
    }
  });

  // AI calls run only on the local server. Keys are read from the main-process secure
  // store in desktop builds and are never returned to the renderer or logged.
  app.post('/api/generate-video', applyRateLimit(rateLimiters.generateVideo), async (req: Request, res: Response) => {
    try {
      const { prompt, aspectRatio, resolution } = req.body || {};
      if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'Prompt is required.' });
      const ai = await getAiClient();
      if (!ai) return res.status(503).json({ error: 'Configure a Gemini API key in Settings to use AI generation.' });
      const targetAspectRatio = aspectRatio === '9:16' || aspectRatio === '16:9' ? aspectRatio : '16:9';
      const targetResolution = resolution === '1080p' ? '1080p' : '720p';
      const operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt.trim(),
        config: { numberOfVideos: 1, resolution: targetResolution, aspectRatio: targetAspectRatio },
      });
      res.json({ operationName: operation.name });
    } catch (error) {
      options.logger?.error?.(`Video generation request failed: ${cleanError(error)}`);
      res.status(500).json({ error: cleanError(error) || 'Failed to start video generation.' });
    }
  });

  app.post('/api/video-status', applyRateLimit(rateLimiters.videoStatus), async (req: Request, res: Response) => {
    try {
      const { operationName } = req.body || {};
      if (typeof operationName !== 'string' || !operationName.trim()) return res.status(400).json({ error: 'operationName is required.' });
      const ai = await getAiClient();
      if (!ai) return res.status(503).json({ error: 'Configure a Gemini API key in Settings.' });
      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });
      res.json({ done: updated.done, error: updated.error || null });
    } catch (error) {
      options.logger?.error?.(`Video status request failed: ${cleanError(error)}`);
      res.status(500).json({ error: cleanError(error) || 'Failed to check video status.' });
    }
  });

  app.post('/api/video-download', applyRateLimit(rateLimiters.videoDownload), async (req: Request, res: Response) => {
    try {
      const { operationName } = req.body || {};
      if (typeof operationName !== 'string' || !operationName.trim()) return res.status(400).json({ error: 'operationName is required.' });
      const ai = await getAiClient();
      const key = await getApiKey();
      if (!ai || !key) return res.status(503).json({ error: 'Configure a Gemini API key in Settings.' });
      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });
      const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
      if (!uri) return res.status(404).json({ error: 'Generated video URI not found.' });
      const videoRes = await fetch(uri, { headers: { 'x-goog-api-key': key } });
      if (!videoRes.ok) return res.status(videoRes.status).json({ error: 'Failed to fetch video stream from Google servers.' });
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Cache-Control', 'no-store');
      res.send(Buffer.from(await videoRes.arrayBuffer()));
    } catch (error) {
      options.logger?.error?.(`Video download request failed: ${cleanError(error)}`);
      res.status(500).json({ error: cleanError(error) || 'Failed to stream video.' });
    }
  });

  app.post('/api/transcribe-audio', applyRateLimit(rateLimiters.transcribeAudio), async (req: Request, res: Response) => {
    try {
      const { base64Audio, mimeType, prompt } = req.body || {};
      if (typeof base64Audio !== 'string' || !base64Audio) return res.status(400).json({ error: 'Audio data is required.' });
      const ai = await getAiClient();
      if (!ai) return res.status(503).json({ error: 'Configure a Gemini API key in Settings.' });
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            { inlineData: { mimeType: typeof mimeType === 'string' ? mimeType : 'audio/webm', data: base64Audio } },
            { text: typeof prompt === 'string' && prompt ? prompt : 'Transcribe precisely with timecodes and speaker indications. Preserve Persian and English terms.' },
          ],
        },
      });
      res.json({ text: response.text || '' });
    } catch (error) {
      options.logger?.error?.(`Audio transcription request failed: ${cleanError(error)}`);
      res.status(500).json({ error: cleanError(error) || 'Audio transcription failed.' });
    }
  });

  app.post('/api/chat', applyRateLimit(rateLimiters.chat), async (req: Request, res: Response) => {
    try {
      const { messages, model, systemInstruction } = req.body || {};
      if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) return res.status(400).json({ error: 'A messages array is required.' });
      if (!messages.every((message) => message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string' && message.content.length <= 12000)) {
        return res.status(400).json({ error: 'Each message must have a supported role and bounded text content.' });
      }
      const ai = await getAiClient();
      if (!ai) return res.status(503).json({ error: 'Configure a Gemini API key in Settings.' });
      const selectedModel = ['gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'].includes(model)
        ? model
        : 'gemini-3.5-flash';
      const formattedContents = messages.map((message: { role: string; content: string }) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      }));
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: formattedContents,
        config: {
          systemInstruction: typeof systemInstruction === 'string' && systemInstruction.length <= 4000
            ? systemInstruction
            : 'You are HS.Tech Video AI Assistant, a professional video editing and storytelling assistant. Support Persian and English.',
        },
      });
      res.json({ text: response.text || '', modelUsed: selectedModel });
    } catch (error) {
      options.logger?.error?.(`AI chat request failed: ${cleanError(error)}`);
      res.status(500).json({ error: cleanError(error) || 'Chat generation failed.' });
    }
  });

  app.post('/api/generate-music', applyRateLimit(rateLimiters.generateMusic), async (req: Request, res: Response) => {
    try {
      const { prompt, type } = req.body || {};
      if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'Music prompt is required.' });
      const ai = await getAiClient();
      if (!ai) return res.status(503).json({ error: 'Configure a Gemini API key in Settings.' });
      const model = type === 'pro' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';
      const response = await ai.models.generateContentStream({ model, contents: prompt.trim() });
      let audioBase64 = '';
      let lyrics = '';
      let mimeType = 'audio/wav';
      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (!audioBase64 && part.inlineData.mimeType) mimeType = part.inlineData.mimeType;
            audioBase64 += part.inlineData.data;
          }
          if (part.text && !lyrics) lyrics = part.text;
        }
      }
      res.json({ audioBase64, mimeType, lyrics, model });
    } catch (error) {
      options.logger?.error?.(`Music generation request failed: ${cleanError(error)}`);
      res.status(500).json({ error: cleanError(error) || 'Music generation failed.' });
    }
  });

  if (isProduction) {
    const distPath = path.resolve(options.staticPath || path.join(process.cwd(), 'dist'));
    if (!fs.existsSync(path.join(distPath, 'index.html'))) {
      throw new Error(`Production UI build is missing: ${path.join(distPath, 'index.html')}`);
    }
    app.use(express.static(distPath, { index: false, fallthrough: true, dotfiles: 'deny' }));
    app.get(/^\/(?!api(?:\/|$)).*/, (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    app.get('/api/*', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  }

  return app;
}

async function startStandaloneServer() {
  if (process.env.NODE_ENV !== 'production' && !process.env.GEMINI_API_KEY) {
    // .env is a developer convenience only. Packaged builds use safeStorage and do not load .env.
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  }
  const production = process.env.NODE_ENV === 'production';
  if (production) throw new Error('Use the Electron desktop entry point for production.');
  const app = createApp({
    production: false,
    allowPreviewHosts: process.env.HS_TECH_ALLOW_PREVIEW_HOSTS === 'true',
  });
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true, host: '127.0.0.1' },
    appType: 'spa',
  });
  app.use(vite.middlewares);
  const port = Number.parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '127.0.0.1';
  const server = app.listen(port, host, () => {
    console.log(`[HS.Tech Applet] Development server listening on http://${host}:${port}`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (process.argv[1] && /(?:^|[/\\])server\.ts$/.test(process.argv[1])) {
  startStandaloneServer().catch((error) => {
    console.error(`Failed to start development server: ${cleanError(error)}`);
    process.exitCode = 1;
  });
}
