import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Mic,
  MicOff,
  MessageSquare,
  Music,
  Database,
  LogIn,
  LogOut,
  Sparkles,
  Play,
  Pause,
  Download,
  Copy,
  Check,
  Send,
  RefreshCw,
  Layers,
  Clock,
  User as UserIcon,
  ChevronRight,
  Flame,
  AlertCircle,
  FolderHeart
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  signInWithGoogle,
  signOutUser,
  subscribeToAuth,
  saveUserCreation,
  fetchUserCreations,
  UserCreationItem
} from '../services/firebase';

interface AiHubStudioProps {
  onInjectMediaToNLE?: (item: { type: string; url?: string; text?: string; title: string }) => void;
}

export const AiHubStudio: React.FC<AiHubStudioProps> = ({ onInjectMediaToNLE }) => {
  const [activeSubTab, setActiveSubTab] = useState<'video' | 'transcribe' | 'chat' | 'music' | 'saved'>('video');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [savedCreations, setSavedCreations] = useState<UserCreationItem[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 1. Veo 3 Video State
  const [videoPrompt, setVideoPrompt] = useState<string>(
    'Cinematic hyper-realistic drone flythrough of a futuristic cyberpunk neon metropolis at night, 4k 60fps'
  );
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoResolution, setVideoResolution] = useState<'720p' | '1080p'>('720p');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<boolean>(false);
  const [videoStatusMessage, setVideoStatusMessage] = useState<string>('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

  // 2. Audio Transcription State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [transcriptionResult, setTranscriptionResult] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  // 3. Gemini Chatbot State
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content:
        'سلام! من دستیار هوش مصنوعی HS.Tech هستم. آماده‌ام تا به شما در ایده‌پردازی هوک‌های وایرال، اصلاح رنگ، سناریونویسی و ساختارهای ویدیویی برای کپکات، پرمیر و داوینچی کمک کنم.'
    }
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatModel, setChatModel] = useState<'gemini-3.1-pro-preview' | 'gemini-3.5-flash' | 'gemini-3.1-flash-lite'>(
    'gemini-3.5-flash'
  );
  const [chatRole, setChatRole] = useState<string>(
    'Senior Video Editor & Viral Storytelling Strategist'
  );
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  // 4. Lyria Music State
  const [musicPrompt, setMusicPrompt] = useState<string>(
    'Epic cinematic trailer beat with heavy sub-bass drops, energetic percussion, and modern synth lines for an action video reel'
  );
  const [musicType, setMusicType] = useState<'clip' | 'pro'>('clip');
  const [isGeneratingMusic, setIsGeneratingMusic] = useState<boolean>(false);
  const [generatedMusicUrl, setGeneratedMusicUrl] = useState<string | null>(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState<boolean>(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Subscribe to Firebase Auth
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
      if (user) {
        loadUserCreations(user.uid);
      } else {
        setSavedCreations([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadUserCreations = async (uid: string) => {
    const list = await fetchUserCreations(uid);
    setSavedCreations(list);
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // --- 1. Veo 3 Video Handler ---
  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim()) return;
    setIsGeneratingVideo(true);
    setGeneratedVideoUrl(null);
    setVideoStatusMessage('در حال اتصال به مدل veo-3.1-fast-generate-preview...');

    try {
      // Step 1: Start operation
      const startRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt,
          aspectRatio: videoAspectRatio,
          resolution: videoResolution
        })
      });

      if (!startRes.ok) {
        const err = await startRes.json();
        throw new Error(err.error || 'Failed to start video generation');
      }

      const { operationName } = await startRes.json();
      setVideoStatusMessage('ویدیو در صف پردازش گوگل قرار گرفت. در حال رندر فریم‌ها...');

      // Step 2: Poll operation
      let isDone = false;
      let attempts = 0;
      while (!isDone && attempts < 40) {
        attempts++;
        await new Promise((r) => setTimeout(r, 6000));
        setVideoStatusMessage(`در حال رندر هوش مصنوعی فریم‌ها... (تلاش ${attempts} / ۴۰)`);

        const pollRes = await fetch('/api/video-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationName })
        });

        if (pollRes.ok) {
          const pollData = await pollRes.json();
          if (pollData.done) {
            isDone = true;
            if (pollData.error) {
              throw new Error(pollData.error.message || 'Video generation error from model.');
            }
          }
        }
      }

      if (!isDone) {
        throw new Error('زمان انتظار تولید ویدیو به پایان رسید. لطفاً مجدداً امتحان نمایید.');
      }

      // Step 3: Download video
      setVideoStatusMessage('رندر به پایان رسید. در حال بارگیری ویدیوی تولیدی...');
      const downloadRes = await fetch('/api/video-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationName })
      });

      if (!downloadRes.ok) {
        throw new Error('دریافت فایل ویدیوی رندرشده ناموفق بود.');
      }

      const blob = await downloadRes.blob();
      const videoBlobUrl = URL.createObjectURL(blob);
      setGeneratedVideoUrl(videoBlobUrl);
      setVideoStatusMessage('ویدیوی Veo 3 با موفقیت رندر شد!');

      // Save to Firestore if user logged in
      if (currentUser) {
        await saveUserCreation(currentUser.uid, {
          type: 'video',
          title: `Veo 3 (${videoAspectRatio})`,
          prompt: videoPrompt,
          model: 'veo-3.1-fast-generate-preview',
          metadata: { aspectRatio: videoAspectRatio, resolution: videoResolution }
        });
        loadUserCreations(currentUser.uid);
      }
    } catch (err: any) {
      console.error(err);
      setVideoStatusMessage(`خطا: ${err.message || 'مشکلی رخ داد.'}`);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // --- 2. Audio Transcription Handler ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleTranscribeBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert('دسترسی به میکروفون امکان‌پذیر نشد. لطفاً مجوز میکروفون در مرورگر را فعال کنید.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  const handleTranscribeBlob = async (blob: Blob) => {
    setIsTranscribing(true);
    setTranscriptionResult('در حال ارسال فایل صوتی به مدل gemini-3.5-transcribe...');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const res = await fetch('/api/transcribe-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Audio: base64Data,
            mimeType: 'audio/webm'
          })
        });

        if (!res.ok) {
          throw new Error('رونویسی صدا با خطا مواجه شد.');
        }

        const data = await res.json();
        const text = data.text || 'هیچ کلامی شناسایی نشد.';
        setTranscriptionResult(text);

        if (currentUser) {
          await saveUserCreation(currentUser.uid, {
            type: 'transcription',
            title: 'رونویسی صوتی میکروفون',
            prompt: 'Microphone Audio Input',
            model: 'gemini-3.5-transcribe',
            textContent: text
          });
          loadUserCreations(currentUser.uid);
        }
      };
    } catch (err: any) {
      setTranscriptionResult(`خطا در رونویسی: ${err.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // --- 3. Gemini Chatbot Handler ---
  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput.trim();
    const newHistory = [...chatMessages, { role: 'user' as const, content: userMsg }];
    setChatMessages(newHistory);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory,
          model: chatModel,
          systemInstruction: `Role: ${chatRole}. Provide expert video editing, color grading, and viral hook advice for CapCut, Premiere, and DaVinci. Use Persian or English according to user input.`
        })
      });

      if (!res.ok) {
        throw new Error('پاسخ از چت‌بات دریافت نشد.');
      }

      const data = await res.json();
      setChatMessages([...newHistory, { role: 'assistant', content: data.text }]);
    } catch (err: any) {
      setChatMessages([
        ...newHistory,
        { role: 'assistant', content: `متاسفانه مشکلی رخ داد: ${err.message}` }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // --- 4. Lyria Music Handler ---
  const handleGenerateMusic = async () => {
    if (!musicPrompt.trim() || isGeneratingMusic) return;
    setIsGeneratingMusic(true);
    setGeneratedMusicUrl(null);

    try {
      const res = await fetch('/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: musicPrompt,
          type: musicType
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'تولید موسیقی ناموفق بود.');
      }

      const data = await res.json();
      if (!data.audioBase64) {
        throw new Error('داده‌های صوتی تولید نشد.');
      }

      const binary = atob(data.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
      const audioUrl = URL.createObjectURL(blob);
      setGeneratedMusicUrl(audioUrl);

      if (currentUser) {
        await saveUserCreation(currentUser.uid, {
          type: 'music',
          title: `موسیقی Lyria (${musicType === 'clip' ? '۳۰ ثانیه' : 'کامل'})`,
          prompt: musicPrompt,
          model: data.model || 'lyria-3-clip-preview'
        });
        loadUserCreations(currentUser.uid);
      }
    } catch (err: any) {
      alert(`خطا در تولید موسیقی: ${err.message}`);
    } finally {
      setIsGeneratingMusic(false);
    }
  };

  return (
    <div className="space-y-6 text-right">
      {/* Top Banner with Firebase Auth Status */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>استودیوی یکپارچه هوش مصنوعی و ابر (AI Hub & Firebase)</span>
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700">
                Veo 3 · Gemini 3.5 Transcribe · Lyria Music · Firestore
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              تولید ویدیو، رونویسی صدا، چت‌بات و موسیقی هوش مصنوعی
            </h1>
            <p className="text-slate-300 text-xs md:text-sm max-w-2xl leading-relaxed">
              ابزارهای نسل جدید هوش مصنوعی گوگل برای تولید دارایی‌های ویدیویی، زیرنویس خودکار فارسی، مشاوره تخصصی تدوین و موسیقی اختصاصی همراه با ذخیره‌سازی ابری امن در فایربیس.
            </p>
          </div>

          {/* User Auth Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt="User"
                    className="w-9 h-9 rounded-full border border-indigo-400"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    {currentUser.displayName ? currentUser.displayName[0] : 'U'}
                  </div>
                )}
                <div className="text-right">
                  <div className="text-xs font-bold text-white leading-tight">
                    {currentUser.displayName || 'کاربر استودیو'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">{currentUser.email}</div>
                </div>
                <button
                  onClick={signOutUser}
                  title="خروج از حساب"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-indigo-600" />
                <span>ورود با حساب گوگل (Firebase Auth)</span>
              </button>
            )}
          </div>
        </div>

        {/* Feature Navigation Tabs */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSubTab('video')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'video'
                ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-black shadow-md shadow-teal-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>تولید ویدیو با متنی Veo 3</span>
          </button>

          <button
            onClick={() => setActiveSubTab('transcribe')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'transcribe'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md shadow-purple-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>رونویسی صدا با میکروفون (Gemini Transcribe)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('chat')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'chat'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>چت‌بات چندنقشه Gemini</span>
          </button>

          <button
            onClick={() => setActiveSubTab('music')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'music'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-md shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>تولید موسیقی (Lyria)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('saved')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'saved'
                ? 'bg-slate-700 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <FolderHeart className="w-4 h-4 text-rose-400" />
            <span>آرشیو ابری فایربیس ({savedCreations.length})</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: VEO 3 VIDEO GENERATION */}
      {activeSubTab === 'video' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Video className="w-4 h-4 text-teal-400" />
                <span>تولید ویدیوی هوش مصنوعی Veo 3</span>
              </h2>
              <span className="text-[11px] font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                veo-3.1-fast-generate-preview
              </span>
            </div>

            {/* Prompt Input */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-semibold block">
                متن پرامپت سناریوی ویدیو (انگلیسی یا فارسی):
              </label>
              <textarea
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 leading-relaxed font-sans"
                placeholder="توصیف جزئیات نورپردازی، زاویه دوربین، حرکت و سوژه..."
              />
            </div>

            {/* Quick Templates */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400 block">پرامپت‌های سریع وایرال:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    label: 'شهر نئون سایبرپانک',
                    prompt: 'Ultra-cinematic drone tracking shot of a neon cyberpunk Tokyo street in heavy rain with glowing reflections, 4k 60fps'
                  },
                  {
                    label: 'هوک مستربیست استودیویی',
                    prompt: 'High-energy presenter opening a glowing mystery safe box in modern studio with bright volumetric studio lighting'
                  },
                  {
                    label: 'غروب طلایی سینمایی',
                    prompt: 'Slow-motion 35mm golden hour portrait of an artist in nature with soft lens flares and shallow depth of field'
                  }
                ].map((tmpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => setVideoPrompt(tmpl.prompt)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition-colors"
                  >
                    {tmpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Config: Aspect Ratio & Resolution */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <span className="text-xs text-slate-300 block">نسبت ابعاد (Aspect Ratio):</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setVideoAspectRatio('16:9')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      videoAspectRatio === '16:9'
                        ? 'bg-teal-500 text-black border-teal-400 font-bold'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    16:9 سینمایی
                  </button>
                  <button
                    onClick={() => setVideoAspectRatio('9:16')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      videoAspectRatio === '9:16'
                        ? 'bg-teal-500 text-black border-teal-400 font-bold'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    9:16 سوشال ریلز
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-300 block">کیفیت خروجی (Resolution):</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setVideoResolution('720p')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      videoResolution === '720p'
                        ? 'bg-indigo-600 text-white border-indigo-500 font-bold'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    720p HD
                  </button>
                  <button
                    onClick={() => setVideoResolution('1080p')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      videoResolution === '1080p'
                        ? 'bg-indigo-600 text-white border-indigo-500 font-bold'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    1080p Full HD
                  </button>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleGenerateVideo}
              disabled={isGeneratingVideo}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-black font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isGeneratingVideo ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{videoStatusMessage || 'در حال رندر هوش مصنوعی...'}</span>
                </>
              ) : (
                <>
                  <Video className="w-4 h-4" />
                  <span>تولید ویدیو با هوش مصنوعی Veo 3</span>
                </>
              )}
            </button>
          </div>

          {/* Right Preview Column */}
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-400" />
                  <span>پیش‌نمایش ویدیوی رندرشده Veo 3</span>
                </h3>
                <span className="text-xs font-mono text-slate-400">{videoAspectRatio}</span>
              </div>

              {generatedVideoUrl ? (
                <div
                  className={`relative rounded-xl overflow-hidden border border-slate-700 bg-black flex items-center justify-center ${
                    videoAspectRatio === '16:9' ? 'aspect-video w-full' : 'w-64 h-96 mx-auto'
                  }`}
                >
                  <video
                    src={generatedVideoUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div
                  className={`rounded-xl border border-dashed border-slate-800 bg-slate-950/70 flex flex-col items-center justify-center p-8 text-center ${
                    videoAspectRatio === '16:9' ? 'aspect-video w-full' : 'w-64 h-96 mx-auto'
                  }`}
                >
                  <Video className="w-12 h-12 text-slate-600 mb-2 animate-pulse" />
                  <p className="text-xs text-slate-400 max-w-xs">
                    پس از ارسال پرامپت، ویدیوی تولیدشده توسط مدل veo-3.1-fast-generate-preview در این بخش پخش خواهد شد.
                  </p>
                  {videoStatusMessage && (
                    <div className="mt-4 px-3 py-1.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-mono">
                      {videoStatusMessage}
                    </div>
                  )}
                </div>
              )}
            </div>

            {generatedVideoUrl && (
              <div className="pt-3 border-t border-slate-800 flex gap-2">
                <a
                  href={generatedVideoUrl}
                  download="veo3_generated_video.mp4"
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود ویدیو (MP4)</span>
                </a>

                {onInjectMediaToNLE && (
                  <button
                    onClick={() =>
                      onInjectMediaToNLE({
                        type: 'video',
                        url: generatedVideoUrl,
                        title: 'Veo 3 AI Video'
                      })
                    }
                    className="flex-1 py-2 px-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-black text-xs font-black flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Layers className="w-4 h-4" />
                    <span>تزریق به تایم‌لاین کپکات</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: AUDIO TRANSCRIPTION WITH GEMINI 3.5 TRANSCRIBE */}
      {activeSubTab === 'transcribe' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Mic className="w-4 h-4 text-purple-400" />
                <span>ضبط زنده و رونویسی با میکروفون</span>
              </h2>
              <span className="text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                gemini-3.5-transcribe
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              صدای خود یا مصاحبه را با فشردن دکمه ضبط ثبت کنید؛ مدل قدرتمند <code className="text-purple-300">gemini-3.5-transcribe</code> آن را به همراه برچسب‌های زمانی و قلم فارسی استخراج می‌کند.
            </p>

            {/* Microphone Recording UI */}
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center space-y-4 text-center">
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  isRecording
                    ? 'bg-rose-500/20 border-2 border-rose-500 animate-pulse text-rose-400'
                    : 'bg-purple-600/20 border border-purple-500 text-purple-300'
                }`}
              >
                {isRecording ? <Mic className="w-10 h-10" /> : <MicOff className="w-10 h-10" />}
              </div>

              <div className="font-mono text-xl font-bold text-white">
                {Math.floor(recordingSeconds / 60)
                  .toString()
                  .padStart(2, '0')}
                :{(recordingSeconds % 60).toString().padStart(2, '0')}
              </div>

              <div className="flex gap-2">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    disabled={isTranscribing}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Mic className="w-4 h-4" />
                    <span>شروع ضبط صدا</span>
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
                  >
                    <MicOff className="w-4 h-4" />
                    <span>توقف و رونویسی آنی</span>
                  </button>
                )}
              </div>
            </div>

            {/* File Upload Fallback */}
            <div className="space-y-1.5 pt-2">
              <span className="text-xs text-slate-400 block">یا بارگذاری فایل صوتی از سیستم:</span>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleTranscribeBlob(file);
                  }
                }}
                className="w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
              />
            </div>
          </div>

          {/* Transcription Results */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>متن پیاده‌شده و زیرنویس فارسی</span>
                </h3>
                {transcriptionResult && (
                  <button
                    onClick={() => handleCopyText(transcriptionResult, 'transcript')}
                    className="text-xs text-purple-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'transcript' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'transcript' ? 'کپی شد' : 'کپی متن'}</span>
                  </button>
                )}
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 min-h-[220px] max-h-[340px] overflow-y-auto text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                {isTranscribing ? (
                  <div className="flex items-center justify-center h-40 text-purple-400 gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>در حال رونویسی هوشمند با مدل gemini-3.5-transcribe...</span>
                  </div>
                ) : transcriptionResult ? (
                  transcriptionResult
                ) : (
                  <span className="text-slate-500">
                    صدای ضبط‌شده یا بارگذاری‌شده پس از تحلیل هوش مصنوعی به همراه تایم‌کدها در اینجا قرار می‌گیرد.
                  </span>
                )}
              </div>
            </div>

            {transcriptionResult && (
              <div className="pt-3 border-t border-slate-800 flex gap-2">
                <button
                  onClick={() => {
                    const blob = new Blob([transcriptionResult], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'subtitles_persian.txt';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود فایل متنی زیرنویس</span>
                </button>

                {onInjectMediaToNLE && (
                  <button
                    onClick={() =>
                      onInjectMediaToNLE({
                        type: 'text',
                        text: transcriptionResult,
                        title: 'Persian RTL Subtitle'
                      })
                    }
                    className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Layers className="w-4 h-4" />
                    <span>تزریق به عنوان ترک زیرنویس T1</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: MULTI-TURN GEMINI CHATBOT */}
      {activeSubTab === 'chat' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <span>دستیار هوشمند تدوین Gemini (چت چندمرحله‌ای)</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                راهنمای تخصصی کات‌های سینمایی، مهندسی پرامپت و ترفندهای نرم‌افزارهای تدوین
              </p>
            </div>

            {/* Model & Role Selection */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={chatModel}
                onChange={(e: any) => setChatModel(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-cyan-300 font-mono focus:outline-none"
              >
                <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (پیچیده و استدلالی)</option>
                <option value="gemini-3.5-flash">gemini-3.5-flash (عمومی و متعادل)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (فوق‌سریع)</option>
              </select>

              <select
                value={chatRole}
                onChange={(e) => setChatRole(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
              >
                <option value="Senior Video Editor & Viral Storytelling Strategist">تدوینگر ارشد و استراتژیست وایرال</option>
                <option value="Master Colorist (DaVinci Resolve & Premiere)">متخصص اتالوناژ و اصلاح رنگ سینمایی</option>
                <option value="Audio Sound Designer & Foley Engineer">مهندس صداگذاری و افکت‌های صوتی</option>
              </select>
            </div>
          </div>

          {/* Scrollable Messages Thread */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 h-96 overflow-y-auto space-y-3">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-start flex-row-reverse' : 'justify-start'}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}
                >
                  {msg.role === 'user' ? 'شما' : 'AI'}
                </div>
                <div
                  className={`rounded-2xl p-3 max-w-[80%] text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white font-sans'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 font-sans'
                  }`}
                >
                  <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex items-center gap-2 text-cyan-400 text-xs">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>در حال تحلیل و نگارش پاسخ با مدل {chatModel}...</span>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
              placeholder="سؤال خود را بپرسید (مثلاً: چطور یک هوک ۳ ثانیه‌ای با Smash Cut بسازم؟)..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleSendChatMessage}
              disabled={isChatLoading || !chatInput.trim()}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>ارسال</span>
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: LYRIA MUSIC GENERATION */}
      {activeSubTab === 'music' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Music className="w-4 h-4 text-amber-400" />
                <span>تولید موسیقی پس‌زمینه با مدل Lyria</span>
              </h2>
              <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {musicType === 'clip' ? 'lyria-3-clip-preview' : 'lyria-3-pro-preview'}
              </span>
            </div>

            {/* Prompt Input */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-semibold block">
                توصیف سبک موسیقی، ریتم و سازبندی:
              </label>
              <textarea
                value={musicPrompt}
                onChange={(e) => setMusicPrompt(e.target.value)}
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
                placeholder="توصیف سبک (سینمایی، بیت الکترونیک، هیپ‌هاپ لو-فای، پیانو احساسی)..."
              />
            </div>

            {/* Style Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400 block">پریست‌های موسیقی آماده:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    label: 'تریلر حماسی سینمایی',
                    prompt: 'Epic cinematic orchestral trailer with intense risers, heavy brass, driving strings and sub-bass drop'
                  },
                  {
                    label: 'بیت وایرال تیک‌تاک',
                    prompt: 'Upbeat modern electronic trap beat with punchy 808 bass, crisp hi-hats, and catchy synth hook'
                  },
                  {
                    label: 'لو-فای آرامش‌بخش برای ولاگ',
                    prompt: 'Cozy chill lofi hip hop beat with warm rhodes electric piano, mellow vinyl crackle, and soft bassline'
                  }
                ].map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => setMusicPrompt(p.prompt)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Model Length Toggle */}
            <div className="space-y-1 pt-2">
              <span className="text-xs text-slate-300 block">مدت زمان ترک (Length Mode):</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setMusicType('clip')}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    musicType === 'clip'
                      ? 'bg-amber-500 text-black border-amber-400 font-bold'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  کلیپ کوتاه تا ۳۰ ثانیه (Lyria Clip)
                </button>
                <button
                  onClick={() => setMusicType('pro')}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    musicType === 'pro'
                      ? 'bg-amber-500 text-black border-amber-400 font-bold'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  ترک کامل استودیویی (Lyria Pro)
                </button>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleGenerateMusic}
              disabled={isGeneratingMusic}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isGeneratingMusic ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال ساخت استریم موسیقی با مدل Lyria...</span>
                </>
              ) : (
                <>
                  <Music className="w-4 h-4" />
                  <span>تولید قطعه موسیقی با Lyria</span>
                </>
              )}
            </button>
          </div>

          {/* Right Player Column */}
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-amber-400" />
                  <span>پلیر پخش موسیقی ویدیویی</span>
                </h3>
                <span className="text-xs font-mono text-amber-400">WAV · 48kHz</span>
              </div>

              {generatedMusicUrl ? (
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40">
                    <Music className="w-8 h-8 animate-bounce" />
                  </div>

                  <audio
                    ref={audioPlayerRef}
                    src={generatedMusicUrl}
                    controls
                    className="w-full mt-3"
                  />
                </div>
              ) : (
                <div className="bg-slate-950/70 p-8 rounded-2xl border border-dashed border-slate-800 flex flex-col items-center justify-center text-center">
                  <Music className="w-12 h-12 text-slate-600 mb-2 animate-pulse" />
                  <p className="text-xs text-slate-400 max-w-xs">
                    موسیقی ساخته‌شده توسط هوش مصنوعی Lyria پس از پردازش، در این بخش قابل شنیدن و دانلود خواهد بود.
                  </p>
                </div>
              )}
            </div>

            {generatedMusicUrl && (
              <div className="pt-3 border-t border-slate-800 flex gap-2">
                <a
                  href={generatedMusicUrl}
                  download="lyria_track.wav"
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود فایل صوتی (WAV)</span>
                </a>

                {onInjectMediaToNLE && (
                  <button
                    onClick={() =>
                      onInjectMediaToNLE({
                        type: 'audio',
                        url: generatedMusicUrl,
                        title: 'Lyria Background Music'
                      })
                    }
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Layers className="w-4 h-4" />
                    <span>افزودن به لاین صوتی A1</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: SAVED CLOUD CREATIONS (FIRESTORE PERSISTENCE) */}
      {activeSubTab === 'saved' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>دارایی‌های ذخیره‌شده در پایگاه‌داده Firestore</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                تمام ویدیوها، ترک‌های موسیقی و رونویسی‌های تولیدی به صورت امن در حساب ابری شما نگهداری می‌شوند.
              </p>
            </div>
            {currentUser && (
              <button
                onClick={() => loadUserCreations(currentUser.uid)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تازه‌سازی</span>
              </button>
            )}
          </div>

          {!currentUser ? (
            <div className="bg-slate-950 p-8 rounded-xl border border-slate-800 text-center space-y-3">
              <Database className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-300">
                برای مشاهده و همگام‌سازی ابری دارایی‌ها، لطفاً با حساب گوگل وارد شوید.
              </p>
              <button
                onClick={signInWithGoogle}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>ورود به سیستم با Google Auth</span>
              </button>
            </div>
          ) : savedCreations.length === 0 ? (
            <div className="bg-slate-950 p-8 rounded-xl border border-slate-800 text-center text-slate-500 text-xs">
              هنوز فایلی در پایگاه‌داده ابری ثبت نشده است. هر بار که ویدیو یا موسیقی تولید کنید، به صورت اتوماتیک در اینجا ذخیره می‌گردد.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedCreations.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-right"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                      {item.type}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{item.model}</span>
                  </div>
                  <h4 className="text-xs font-bold text-white">{item.title}</h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {item.prompt || item.textContent}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
