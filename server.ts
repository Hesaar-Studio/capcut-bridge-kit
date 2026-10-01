import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';
import dotenv from 'dotenv';
import { createFixedWindowRateLimiter } from './server_rate_limit.ts';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const apiKey = process.env.GEMINI_API_KEY || '';

const rateLimiters = {
  generateVideo: createFixedWindowRateLimiter(2, 60 * 60 * 1000),
  videoStatus: createFixedWindowRateLimiter(60, 60 * 1000),
  videoDownload: createFixedWindowRateLimiter(5, 10 * 60 * 1000),
  transcribeAudio: createFixedWindowRateLimiter(8, 10 * 60 * 1000),
  chat: createFixedWindowRateLimiter(30, 60 * 1000),
  generateMusic: createFixedWindowRateLimiter(3, 60 * 60 * 1000),
};

function applyRateLimit(limiter: (key: string) => { allowed: boolean; retryAfterSeconds: number }) {
  return (req: Request, res: Response, next: express.NextFunction) => {
    const decision = limiter(req.ip || 'loopback');
    if (!decision.allowed) {
      res.setHeader('Retry-After', String(decision.retryAfterSeconds));
      return res.status(429).json({ error: 'AI request limit reached. Please retry later.' });
    }
    next();
  };
}

// Initialize GoogleGenAI client singleton
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

function isLoopbackHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  try {
    const hostname = new URL(`http://${hostHeader}`).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

// This API is consumed by the same-origin local UI. Reject DNS-rebinding Host
// headers and cross-origin browser writes before parsing potentially large bodies.
app.use('/api', (req: Request, res: Response, next) => {
  const hostHeader = req.get('host');
  if (!isLoopbackHost(hostHeader)) {
    return res.status(403).json({ error: 'This local API only accepts loopback hosts.' });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    const originHeader = req.get('origin');
    if (!originHeader) {
      return res.status(403).json({ error: 'A same-origin request is required.' });
    }
    try {
      const origin = new URL(originHeader);
      if (origin.protocol !== 'http:' || origin.host.toLowerCase() !== hostHeader!.toLowerCase()) {
        return res.status(403).json({ error: 'Cross-origin API requests are not allowed.' });
      }
    } catch {
      return res.status(403).json({ error: 'Invalid request origin.' });
    }
  }
  next();
});

// JSON and URL-encoded body parsing (increased limit for audio payloads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    geminiConfigured: !!apiKey,
    timestamp: new Date().toISOString()
  });
});

// 1. Veo 3 Video Generation - Step 1: Start
app.post('/api/generate-video', applyRateLimit(rateLimiters.generateVideo), async (req: Request, res: Response) => {
  try {
    const { prompt, aspectRatio, resolution } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const targetAspectRatio = (aspectRatio === '9:16' || aspectRatio === '16:9') ? aspectRatio : '16:9';
    const targetResolution = resolution === '1080p' ? '1080p' : '720p';

    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt,
      config: {
        numberOfVideos: 1,
        resolution: targetResolution,
        aspectRatio: targetAspectRatio
      }
    });

    res.json({ operationName: operation.name });
  } catch (error: any) {
    console.error('Error in /api/generate-video:', error);
    res.status(500).json({ error: error.message || 'Failed to start video generation.' });
  }
});

// 1. Veo 3 Video Generation - Step 2: Poll Status
app.post('/api/video-status', applyRateLimit(rateLimiters.videoStatus), async (req: Request, res: Response) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: 'operationName is required.' });
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });

    res.json({ 
      done: updated.done, 
      error: updated.error || null 
    });
  } catch (error: any) {
    console.error('Error in /api/video-status:', error);
    res.status(500).json({ error: error.message || 'Failed to check video status.' });
  }
});

// 1. Veo 3 Video Generation - Step 3: Download Stream
app.post('/api/video-download', applyRateLimit(rateLimiters.videoDownload), async (req: Request, res: Response) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: 'operationName is required.' });
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });

    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) {
      return res.status(404).json({ error: 'Generated video URI not found.' });
    }

    const videoRes = await fetch(uri, {
      headers: { 'x-goog-api-key': apiKey },
    });

    if (!videoRes.ok) {
      return res.status(videoRes.status).json({ error: 'Failed to fetch video stream from Google servers.' });
    }

    res.setHeader('Content-Type', 'video/mp4');
    const arrayBuffer = await videoRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error: any) {
    console.error('Error in /api/video-download:', error);
    res.status(500).json({ error: error.message || 'Failed to stream video.' });
  }
});

// 2. Audio Transcription with gemini-3.5-transcribe
app.post('/api/transcribe-audio', applyRateLimit(rateLimiters.transcribeAudio), async (req: Request, res: Response) => {
  try {
    const { base64Audio, mimeType, prompt } = req.body;
    if (!base64Audio) {
      return res.status(400).json({ error: 'Audio data is required.' });
    }

    const audioPart = {
      inlineData: {
        mimeType: mimeType || 'audio/webm',
        data: base64Audio,
      },
    };

    const instruction = prompt || 
      'Transcribe this audio precisely with timecodes and speaker indications. Accurately preserve Persian and English terms.';

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: { 
        parts: [
          audioPart, 
          { text: instruction }
        ] 
      },
    });

    res.json({ text: response.text || '' });
  } catch (error: any) {
    console.error('Error in /api/transcribe-audio:', error);
    res.status(500).json({ error: error.message || 'Audio transcription failed.' });
  }
});

// 3. Multi-Turn Gemini Chatbot
app.post('/api/chat', applyRateLimit(rateLimiters.chat), async (req: Request, res: Response) => {
  try {
    const { messages, model, systemInstruction } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required.' });
    }

    // Role-based model selection according to task requirements
    // gemini-3.1-pro-preview for complex tasks, gemini-3.5-flash for general, gemini-3.1-flash-lite for fast
    const selectedModel = ['gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'].includes(model)
      ? model
      : 'gemini-3.5-flash';

    const formattedContents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: formattedContents,
      config: {
        systemInstruction: systemInstruction || 
          'You are HS.Tech Video AI Assistant, a master video editor, colorist, and viral storytelling strategist for CapCut, Premiere Pro, and DaVinci Resolve. Support both Persian and English.'
      }
    });

    res.json({ 
      text: response.text || '',
      modelUsed: selectedModel
    });
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({ error: error.message || 'Chat generation failed.' });
  }
});

// 4. Music Generation with Lyria (lyria-3-clip-preview / lyria-3-pro-preview)
app.post('/api/generate-music', applyRateLimit(rateLimiters.generateMusic), async (req: Request, res: Response) => {
  try {
    const { prompt, type } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Music prompt is required.' });
    }

    const model = type === 'pro' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';

    const response = await ai.models.generateContentStream({
      model,
      contents: prompt,
    });

    let audioBase64 = '';
    let lyrics = '';
    let mimeType = 'audio/wav';

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!audioBase64 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioBase64 += part.inlineData.data;
        }
        if (part.text && !lyrics) {
          lyrics = part.text;
        }
      }
    }

    res.json({
      audioBase64,
      mimeType,
      lyrics,
      model
    });
  } catch (error: any) {
    console.error('Error in /api/generate-music:', error);
    res.status(500).json({ error: error.message || 'Music generation failed.' });
  }
});

// Mount Vite or Static middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`[HS.Tech Applet] Server running on http://127.0.0.1:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
