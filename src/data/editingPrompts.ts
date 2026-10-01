export interface EditingPrompt {
  id: string;
  title: string;
  category: "lighting" | "cuts" | "hook" | "grading" | "sound" | "motion" | "b-roll";
  categoryLabel: string;
  badge: string;
  difficulty: "مقدماتی" | "متوسط" | "پیشرفته";
  description: string;
  aiPrompt: string;
  capcutCommand: string;
  edlSnippet: {
    in_s: number;
    out_s: number;
    type: "video" | "text" | "overlay" | "audio";
    label: string;
    params?: Record<string, any>;
  };
  recommendedModel: "Kling AI" | "Midjourney v6" | "Runway Gen-3" | "ElevenLabs" | "Gemini 1.5 Pro";
  tips: string[];
}

export const EDITING_PROMPTS: EditingPrompt[] = [
  // 1. نورپردازی و اصلاح رنگ (Lighting & Grading)
  {
    id: "cinematic-moody-rembrandt",
    title: "نورپردازی دراماتیک رامبراند با اصلاح رنگ سینمایی",
    category: "lighting",
    categoryLabel: "نورپردازی و رنگ",
    badge: "Cinematic Lighting",
    difficulty: "پیشرفته",
    description: "ایجاد نورپردازی پرتره سینمایی با مثلث نور زیر چشم (Rembrandt Lighting)، کنتراست ملایم، و تفکیک پس‌زمینه با نور حاشیه‌ای (Rim Light).",
    aiPrompt: "Cinematic portrait shot, 35mm lens, f/1.8, deep dramatic Rembrandt lighting on face with soft triangle light on shadow side, subtle warm 3200K key light, cool 5600K cyan backlight separating subject from dark atmospheric moody studio background with subtle volumetric haze, ARRI Alexa Mini LF look, color graded Kodak Vision3 500T, rich shadows, balanced skin tones.",
    capcutCommand: "uv run capcut-bridge.py transform Viral_Reel_AI_01 --track overlay --index 1 --scale 1.05 --x 0 --y 0",
    edlSnippet: {
      in_s: 0.0,
      out_s: 4.5,
      type: "overlay",
      label: "B-Roll: Cinematic Rembrandt Lighting",
      params: { blend_mode: "screen", opacity: 0.85 }
    },
    recommendedModel: "Runway Gen-3",
    tips: [
      "از تنظیم تراز سفیدی (White Balance) بر روی نور روز در تایم‌لاین کپکات استفاده کنید.",
      "سایه‌ها را کمی به سمت رنگ‌های سرد متمایل کرده و های‌لایت‌ها را گرم نگه دارید (Teal & Orange).",
      "از ویجت فیلتر Vintage Film یا Movie Filter در کپکات برای افزودن گرین سینمایی بهره ببرید."
    ]
  },
  {
    id: "cyberpunk-neon-split",
    title: "نورپردازی دوگانه سایبرپانک (نئون ارغوانی و فیروزه‌ای)",
    category: "lighting",
    categoryLabel: "نورپردازی و رنگ",
    badge: "Dual Neon Lighting",
    difficulty: "متوسط",
    description: "نورپردازی پرکشش با ترکیب نور نئون بنفش پررنگ از چپ و فیروزه‌ای خنک از راست، مخصوص ولاگ‌های گیمینگ و تیک‌تاک‌های پرانرژی.",
    aiPrompt: "Hyper-stylish modern portrait with intense dual neon rim lighting, deep magenta and electric cyan split lighting on subject's face, dark rainy futuristic city reflection in background, high contrast, glossy highlights, 8k resolution, photorealistic, cinematic anamorphic lens flare.",
    capcutCommand: "uv run capcut-bridge.py add-overlay Viral_Reel_AI_01 neon_cyberpunk.mp4 --at 2.0 --dur 3.0 --layer 2",
    edlSnippet: {
      in_s: 2.0,
      out_s: 5.0,
      type: "overlay",
      label: "B-Roll: Dual Neon Glow",
      params: { layer: 2, mute: true }
    },
    recommendedModel: "Kling AI",
    tips: [
      "لایه اورلی را روی حالت Blend Mode: Screen یا Linear Dodge قرار دهید تا درخشندگی نئون روی سوژه اصلی منتقل شود.",
      "از افکت استروپ یا فلیکر ملایم برای زنده نشان دادن نئون استفاده کنید."
    ]
  },
  {
    id: "golden-hour-backlight",
    title: "نور ملایم ساعت طلایی (Golden Hour & Lens Flare)",
    category: "lighting",
    categoryLabel: "نورپردازی و رنگ",
    badge: "Golden Hour",
    difficulty: "مقدماتی",
    description: "نور غروب طبیعی خورشید از پشت سر سوژه با بازتاب‌های لنز نرم (Lens Flare)، گرمای پوستی فوق‌العاده و ایجاد فضای احساسی.",
    aiPrompt: "Authentic documentary outdoor scene during golden hour, low-angle natural warm sunlight streaming from behind the subject, soft organic anamorphic lens flare across the frame, glowing hair rim light, soft creamy bokeh background, shallow depth of field, natural motion blur, 50mm f/1.2 shot.",
    capcutCommand: "uv run capcut-bridge.py add-overlay Viral_Reel_AI_01 golden_sun.mp4 --at 0.0 --dur 4.0 --layer 2 --mute",
    edlSnippet: {
      in_s: 0.0,
      out_s: 4.0,
      type: "overlay",
      label: "Overlay: Sun Flare",
      params: { opacity: 0.7 }
    },
    recommendedModel: "Runway Gen-3",
    tips: [
      "افزودن نور نشت لنز (Light Leak) در نقطه اتصال دو کات، انتقال صحنه‌ها را طبیعی‌تر می‌کند.",
      "تنظیم Color Temperature روی +15 تا +25 در کپکات گرمای حس غروب را دوچندان می‌کند."
    ]
  },

  // 2. سبک‌های کات و ریتم (Cuts & Transitions)
  {
    id: "smash-cut-speed-ramp",
    title: "اسمپش کات ناگهانی همراه با اسپیدرمپینگ (Smash Cut & Speed Ramp)",
    category: "cuts",
    categoryLabel: "سبک کات و ریتم",
    badge: "Viral Speed Ramp",
    difficulty: "پیشرفته",
    description: "انتقال با شتاب فوق‌العاده سریع از حالت اسلوموشن به اکشن پرسرعت، ایجاد شوک حرکتی و جلوگیری از خروج مخاطب در ثانیه‌های اول.",
    aiPrompt: "Extreme dynamic action sequence, camera whip-pan zooming into an urban scene, shifting instantly from 120fps ultra slow motion to 4x fast forward speed, hyper-dynamic kinetic motion blur, energetic camera movement, professional commercial camera rig.",
    capcutCommand: "uv run capcut-bridge.py split 2.4",
    edlSnippet: {
      in_s: 2.0,
      out_s: 2.4,
      type: "video",
      label: "Speed Ramp Peak Cut",
      params: { speed_curve: "Hero", duration: 0.4 }
    },
    recommendedModel: "Kling AI",
    tips: [
      "در کپکات از منحنی سرعت پیش‌فرض 'Hero' یا 'Bullet' استفاده کنید تا سرعت در ابتدای کات اوج گرفته و سپس به آرامی متوقف شود.",
      "حتماً صدای وووش صوتی (Whoosh) قوی را دقیقاً ۳ فریم قبل از کات قرار دهید."
    ]
  },
  {
    id: "j-cut-dialogue-flow",
    title: "تکنیک جی-کات صوتی برای پیوستگی طبیعی دیالوگ (J-Cut Audio Lead)",
    category: "cuts",
    categoryLabel: "سبک کات و ریتم",
    badge: "Audio J-Cut",
    difficulty: "متوسط",
    description: "شنیده شدن صدای صحنه بعدی حدود ۰.۸ ثانیه قبل از کات خوردن تصویر؛ حس روانی و کشش فوق‌العاده ایجاد می‌کند.",
    aiPrompt: "Professional podcast dialogue transition, natural speaker gesture, engaging facial expression nodding while talking, crisp studio close-up, audio ambiance seamlessly transitioning.",
    capcutCommand: "uv run capcut-bridge.py add-text Viral_Reel_AI_01 \"گوش کن چی میگم!\" --at 2.2 --dur 2.0",
    edlSnippet: {
      in_s: 2.2,
      out_s: 4.2,
      type: "audio",
      label: "Audio J-Cut Lead (-0.8s)",
      params: { audio_lead_offset_s: -0.8 }
    },
    recommendedModel: "ElevenLabs",
    tips: [
      "مغز انسان ابتدا صدا را تحلیل می‌کند و سپس تصویر را می‌بیند. J-Cut کات‌های پرشی (Jump Cuts) خشن را ملایم می‌کند.",
      "ترک صوتی A1 را بدون جدا کردن تصویر تا زیر فریم قبلی بکشید."
    ]
  },
  {
    id: "invisible-whip-pan-match",
    title: "مچ‌کات و شلاقی مخفی (Invisible Match Cut / Whip Pan)",
    category: "cuts",
    categoryLabel: "سبک کات و ریتم",
    badge: "Match Cut",
    difficulty: "پیشرفته",
    description: "اتصال دو صحنه کاملاً متفاوت بر اساس حرکت یکسان دست یا چرخش سریع دوربین، که باعث می‌شود کات به چشم نیاید.",
    aiPrompt: "Subject swings right arm quickly across camera creating extreme directional motion blur from left to right, transitioning seamlessly into next modern office scene with matching arm gesture and composition.",
    capcutCommand: "uv run capcut-bridge.py seek 3.2",
    edlSnippet: {
      in_s: 3.1,
      out_s: 3.3,
      type: "video",
      label: "Invisible Whip Transition",
      params: { transition: "Camera Shake & Blur", duration_frames: 4 }
    },
    recommendedModel: "Kling AI",
    tips: [
      "جهت تاری حرکت (Motion Blur) در هر دو کلیپ باید کاملاً در یک جهت (مثلاً چپ به راست) باشد.",
      "فریم کات را دقیقاً در تاری‌ترین لحظه موشن‌بلر قرار دهید."
    ]
  },

  // 3. هوک وایرال و تایپوگرافی (Hooks & Typography)
  {
    id: "retention-hook-mrbeast",
    title: "هوک ۳ ثانیه‌ای سبک مستربیست با کلمات پاپ‌آپ و لرزش (MrBeast Hook)",
    category: "hook",
    categoryLabel: "هوک و تایپوگرافی",
    badge: "Viral Hook 3s",
    difficulty: "متوسط",
    description: "زیرنویس تک‌کلمه‌ای سریع با استروک مشکی عمیق، های‌لایت زرد فسفری، افکت صوتی Pop و زوم جزئی در هر تغییر زاویه.",
    aiPrompt: "High-energy YouTuber staring directly at lens with mouth open in shock, holding mysterious high-tech glowing object, bright studio lighting, intense expressive eyes, vivid saturated colors, dynamic wide-angle 16mm perspective.",
    capcutCommand: "uv run capcut-bridge.py add-text Viral_Reel_AI_01 \"راز اصلی این بود!\" --at 0.2 --dur 1.2",
    edlSnippet: {
      in_s: 0.2,
      out_s: 1.4,
      type: "text",
      label: "Popup Hook: راز اصلی این بود!",
      params: { font: "TheBoldFont", font_size: 42, color: "#FFE600", stroke: "#000000" }
    },
    recommendedModel: "Gemini 1.5 Pro",
    tips: [
      "استفاده از الگوی Pattern Interrupt: هر ۲.۵ ثانیه باید یک المان حرکتی، افکت صوتی، یا تغییر مقیاس (+5% Zoom) اعمال شود.",
      "کلمات کلیدی مثل 'راز'، 'اشتباه'، 'رایگان' را با رنگ زرد فسفری (#FFE600) متمایز کنید."
    ]
  },
  {
    id: "alex-hormozi-word-by-word",
    title: "تایپوگرافی کلمه به کلمه سبک الکس هرموزی (Word-by-Word Kinetic)",
    category: "hook",
    categoryLabel: "هوک و تایپوگرافی",
    badge: "Hormozi Captions",
    difficulty: "متوسط",
    description: "انیمیشن متنی پرانرژی که هر کلمه دقیقاً هنگام تلفظ شدن پررنگ یا بزرگ می‌شود، همراه با آیکون‌های متحرک مرتبط.",
    aiPrompt: "Top-tier entrepreneurial short video presentation, confident speaker gesture with hands, ultra sharp 4k, crisp clean monochrome dark background with rim light, modern startup aesthetic.",
    capcutCommand: "uv run capcut-bridge.py graphics Viral_Reel_AI_01 job_hormozi_plan.json",
    edlSnippet: {
      in_s: 1.0,
      out_s: 3.5,
      type: "text",
      label: "Word Animation Track (T1)",
      params: { animation: "Spring Zoom In", duration: 0.3 }
    },
    recommendedModel: "Gemini 1.5 Pro",
    tips: [
      "مکان قرارگیری متن حتماً باید در محدوده امن (Safe Zone) بین Y: 0.2 تا Y: -0.3 باشد تا زیر دکمه‌های اینستاگرام یا تیک‌تاک پنهان نشود.",
      "فونت‌های ضخیم و بدون دندانه (مانند لاله‌زار، کلمه یا Impact) بالاترین نرخ خوانایی در ابعاد کوچک موبایل را دارند."
    ]
  },

  // 4. طراحی صدا (Sound Design & Foley)
  {
    id: "sub-drop-riser-impact",
    title: "توالی ایمپکت صوتی ساب‌بیس، رایزر و هوش صوتی (Sub-Drop & Riser)",
    category: "sound",
    categoryLabel: "طراحی صدا و افکت",
    badge: "Audio Impact",
    difficulty: "پیشرفته",
    description: "طراحی صدای چندلایه با فرکانس‌های بم زیر ۶۰ هرتز (Sub-Bass) و صدای افزایش فرکانس (Riser) برای بالا بردن ضربان و سپس سکوت لحظه‌ای قبل از ضربه نهایی.",
    aiPrompt: "Deep sub-bass cinematic boom hitting at the moment of reveal, rising white noise building tension over 2 seconds, followed by 0.2s dead silence, then massive bass impact with crisp vinyl crackle.",
    capcutCommand: "uv run capcut-bridge.py add-overlay Viral_Reel_AI_01 sfx_riser_impact.wav --at 1.8 --dur 2.5",
    edlSnippet: {
      in_s: 1.8,
      out_s: 4.3,
      type: "audio",
      label: "SFX: Riser + Sub-Drop",
      params: { volume_db: +2.5, low_cut: 30 }
    },
    recommendedModel: "ElevenLabs",
    tips: [
      "قانون طلایی سکوت: اگر می‌خواهید ضربه یک کات به حداکثر قدرت برسد، ۰.۳ ثانیه قبل از آن صدای پس‌زمینه را به طور ناگهانی قطع کنید.",
      "فرکانس‌های بم را هرگز همزمان با صدای گوینده در اوج ولوم نگذارید؛ از اکولایزر (EQ) یا کاهش ولوم خودکار (Ducking) استفاده کنید."
    ]
  },

  // 5. بی‌رول و پرده سبز هوش مصنوعی (AI B-Roll & Green Screen)
  {
    id: "futuristic-hud-overlay",
    title: "اورلی انیمیشن رابط کاربری هولوگرافیک و آینده‌نگرانه (Holographic HUD)",
    category: "b-roll",
    categoryLabel: "بی‌رول و لایه هوش مصنوعی",
    badge: "Hologram HUD",
    difficulty: "متوسط",
    description: "لایه‌بندی نمودارهای دیجیتال، اسکنرهای بیومتریک و خطوط نورانی روی صورت یا دست گوینده برای نمایش محتوای علمی و فناوری.",
    aiPrompt: "Futuristic sci-fi holographic user interface elements floating in air, glowing cyan and amber data graphs, rotating biometric wireframe rings, isolated on pure pitch-black background for screen blend mode, 60fps.",
    capcutCommand: "uv run capcut-bridge.py add-overlay Viral_Reel_AI_01 hud_loop.mp4 --at 1.2 --dur 4.0 --layer 2 --blend screen",
    edlSnippet: {
      in_s: 1.2,
      out_s: 5.2,
      type: "overlay",
      label: "V2: Hologram Screen Blend",
      params: { blend: "screen", opacity: 0.9 }
    },
    recommendedModel: "Kling AI",
    tips: [
      "ویدیوهایی که پس‌زمینه کاملاً مشکی دارند با افکت Blend: Screen فوراً شفاف شده و نیازی به پرده سبز ندارند.",
      "با افزودن حرکت ردیابی دست (Keyframe Position)، حس تعامل گوینده با هولوگرام تقویت می‌شود."
    ]
  }
];

export interface EditingMasteryTopic {
  id: string;
  title: string;
  icon: string;
  subtitle: string;
  principles: {
    rule: string;
    description: string;
    proTrick: string;
  }[];
  capcutBestPractices: string[];
}

export const EDITING_MASTERY_SKILLS: EditingMasteryTopic[] = [
  {
    id: "pacing-rhythm",
    title: "قوانین ریتم، زمان‌بندی و حفظ مخاطب (Retention & Pacing)",
    icon: "Activity",
    subtitle: "چگونه ویدیو بسازید که بیش از ۷۵٪ تماشاچیان تا ثانیه آخر بمانند",
    principles: [
      {
        rule: "قانون ۳ ثانیه اول (The 3-Second Hook Rule)",
        description: "مغز انسان در ۱.۵ ثانیه تصمیم می‌گیرد ویدیو را بالا بزند یا خیر. هیچ سلام، خوش‌آمدگویی یا معرفی برند در ابتدای ویدیو نباید وجود داشته باشد.",
        proTrick: "ویدیو را با یک ادعای غیرمنتظره، عدد غیرعادی یا یک شکست دیداری آغاز کنید."
      },
      {
        rule: "وقفه در الگو هر ۲.۵ ثانیه (Pattern Interrupt)",
        description: "اگر بیش از ۳ ثانیه قاب تصویر ثابت بماند، توجه مغز کاهش می‌یابد. تغییر نما، افکت زوم جزئی (+6%)، گرافیک یا یک صدای کوتاه الزامی است.",
        proTrick: "از تکنیک Punch-in Zoom در ادیت برای تاکید روی کلمات مهم استفاده کنید."
      },
      {
        rule: "ریتم تنفس و سکوت (The Breathing Space)",
        description: "ریتم سریع مداوم ذهن مخاطب را خسته می‌کند. بعد از هر اوج هیجان، ۱ تا ۲ ثانیه ریتم آرام‌تری برای جذب اطلاعات در نظر بگیرید.",
        proTrick: "دیالوگ‌های پی‌درپی را با یک بی‌رول اتمسفریک ۲ ثانیه‌ای همراه با صدای محیط پیوند بزنید."
      }
    ],
    capcutBestPractices: [
      "استفاده از کلید میانبر Split (Ctrl+B / Cmd+B) برای کات زدن دقیق کلمات زاید و تنفس‌ها.",
      "استفاده از قابلیت Auto Cut Silences در پایتون بریج با دستور کات‌های خودکار.",
      "تنظیم فریم ریت ثابت روی 30fps یا 60fps برای هماهنگی کامل برش‌ها."
    ]
  },
  {
    id: "lighting-color",
    title: "اصول نورپردازی سه‌نقطه‌ای و اصلاح رنگ سینمایی",
    icon: "Sun",
    subtitle: "تبدیل ویدیوی آماتور به خروجی استودیویی با درک عمق نور و کنتراست",
    principles: [
      {
        rule: "تئوری نورپردازی سه‌نقطه‌ای (Key, Fill, Rim Light)",
        description: "نور اصلی (Key) سوژه را از زاویه ۴۵ درجه روشن می‌کند؛ نور پرکننده (Fill) سایه‌های تند را ملایم می‌سازد؛ و نور حاشیه‌ای (Rim) سوژه را از پس‌زمینه جدا می‌کند.",
        proTrick: "اگر فقط یک نور دارید، آن را کمی از بالا و پهلو بتابانید و پشت سر خود را تاریک نگه دارید تا عمق خلق شود."
      },
      {
        rule: "تئوری رنگ‌های مکمل (Color Theory & Contrast)",
        description: "استفاده از رنگ‌های متضاد در چرخه رنگ (مانند نارنجی برای پوست و فیروزه‌ای برای محیط) مغز را مجذوب کنتراست می‌کند.",
        proTrick: "در کپکات مقدار Temperature را گرم کرده و در بخش HSL رنگ آبی پس‌زمینه را اشباع‌تر کنید."
      },
      {
        rule: "کنتراست در سایه‌ها (Crush the Blacks Carefully)",
        description: "تیرگی واقعی حس کیفیت و لوکس بودن به تصویر می‌دهد، اما نباید جزئیات بافت لباس یا مو در سیاهی گم شود.",
        proTrick: "منحنی Luma Curve را به شکل یک S بسیار ملایم تنظیم کنید."
      }
    ],
    capcutBestPractices: [
      "اعمال Adjustment Layer کلی روی بالاترین لایه تایم‌لاین برای یکپارچگی رنگ تمام کات‌ها.",
      "استفاده از فیلترهای استاندارد سینمایی (Teal-Orange / Vintage Film) با شدت ۳۰ تا ۴۰ درصد.",
      "تنظیم شارپنس (Sharpening) روی حداکثر ۱۵٪ برای جلوگیری از نویز دیجیتال."
    ]
  },
  {
    id: "sound-design",
    title: "مهندسی صدا و افکت‌های صوتی (Sound Design Mastery)",
    icon: "Volume2",
    subtitle: "۷۰ درصد ادراک کیفیت یک ویدیو توسط گوش شنیده می‌شود، نه چشم",
    principles: [
      {
        rule: "قانون لایه‌بندی صدا (Audio Layering Hierarchy)",
        description: "صدا باید از ۴ لایه مجزا تشکیل شود: ۱. صدای گوینده (Dialogue)، ۲. صدای محیط (Ambience)، ۳. افکت‌های موضعی (Foley/SFX)، ۴. موسیقی متن (BGM).",
        proTrick: "ولوم موسیقی حتماً باید حداقل ۱۸- تا ۲۲- دسی‌بل زیر صدای گوینده تنظیم شود."
      },
      {
        rule: "داکینگ خودکار (Audio Auto-Ducking)",
        description: "موسیقی در لحظاتی که گوینده حرف می‌زند باید به صورت نرم فروکش کند و در لحظات سکوت اندکی بالا بیاید.",
        proTrick: "از افکت صوتی Whoosh و Swish همراه با تغییر زوایای دوربین استفاده کنید."
      },
      {
        rule: "کنترل فرکانس‌های زیرین (Sub-frequencies)",
        description: "فرکانس‌های نامطلوب لرزش میکروفون زیر ۱۰۰ هرتز را فیلتر کنید تا صدا در بلندگوی گوشی موبایل واضح و شفاف بماند.",
        proTrick: "با اکولایزر High-Pass فیلتر روی ۸۰Hz اعمال کنید."
      }
    ],
    capcutBestPractices: [
      "فعال‌سازی دکمه Voice Enhancement و Noise Reduction در پنل سمت راست کپکات.",
      "همگام‌سازی بیت‌های آهنگ (Beats Match) با استفاده از نشانگرهای زردرنگ روی ترک صوتی.",
      "تنظیم Fade In و Fade Out حداقل ۰.۲ ثانیه‌ای برای تمامی افکت‌های صوتی برای ممانعت از ایجاد صدای تق (Click Pop)."
    ]
  },
  {
    id: "viral-typography",
    title: "تایپوگرافی متحرک و مناطق امن (Typography & Safe Zones)",
    icon: "Type",
    subtitle: "طراحی کلمات و زیرنویس‌هایی که چشم را ناخودآگاه به سمت خود می‌کشانند",
    principles: [
      {
        rule: "محدوده امن عمودی ۹:۱۶ (The Vertical Safe Zone)",
        description: "در پلتفرم‌های اینستاگرام ریلز، یوتیوب شورتز و تیک‌تاک، بالای تصویر (۲۰٪) و پایین تصویر (۳۰٪) توسط آیکون‌های لایک، کامنت و کپشن پوشانده می‌شود.",
        proTrick: "زیرنویس‌ها و المان‌های کلیدی را دقیقاً در یک‌سوم میانی صفحه (Middle Third) متمرکز کنید."
      },
      {
        rule: "کنتراست فونت با پس‌زمینه (Drop Shadow & Stroke)",
        description: "اگر ویدیوی شما صحنه‌های روشن و تاریک دارد، زیرنویس بدون کادر در صحنه‌های روشن محو می‌شود.",
        proTrick: "یک Stroke مشکی ۲ پیکسلی به همراه یک سایه نرم (Blur: 8, Opacity: 60%) فونت را در هر شرایطی خوانا نگه می‌دارد."
      },
      {
        rule: "انیمیشن ورودی فنری (Elastic Spring Easing)",
        description: "کلمات نباید به صورت مکانیکی ظاهر شوند؛ انیمیشن فنری کوتاه حس زنده بودن و سرگرمی به ویدیو می‌بخشد.",
        proTrick: "مدت زمان انیمیشن ورودی متن نباید بیشتر از ۰.۲۵ ثانیه باشد."
      }
    ],
    capcutBestPractices: [
      "به‌کارگیری فونت‌های با وزن بالا (Bold / Black / Extra Bold).",
      "فعال‌سازی باگ‌زدایی خودکار با اسکریپت پایتون تا source_timerange متن‌ها null نشود و خروجی نسوزد.",
      "استفاده از حداکثر ۳ الی ۵ کلمه در هر فریم زیرنویس برای خوانایی در موبایل."
    ]
  }
];
