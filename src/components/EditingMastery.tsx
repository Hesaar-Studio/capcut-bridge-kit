import React, { useState } from "react";
import { 
  EDITING_MASTERY_SKILLS, 
  EditingMasteryTopic 
} from "../data/editingPrompts";
import { 
  BookOpen, 
  Sparkles, 
  Film, 
  Sun, 
  Volume2, 
  Type, 
  CheckCircle2, 
  AlertTriangle, 
  Terminal, 
  HelpCircle, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Layers, 
  Flame, 
  Clock, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu
} from "lucide-react";
import { Platform } from "../types";

interface EditingMasteryProps {
  platform: Platform;
  onNavigateToTab?: (tab: string) => void;
}

export const EditingMastery: React.FC<EditingMasteryProps> = ({ platform, onNavigateToTab }) => {
  const [activeSection, setActiveSection] = useState<"manual" | "skills" | "cuts_guide" | "shortcuts">("manual");
  const [expandedTopic, setExpandedTopic] = useState<string>("pacing-rhythm");

  const cutStyles = [
    {
      name: "J-Cut (جی کات صوتی)",
      desc: "صدای صحنه بعد حدود ۰.۸ تا ۱ ثانیه قبل از کات خوردن تصویر شنیده می‌شود.",
      whenToUse: "شروع دیالوگ‌ها، مصاحبه‌ها، ولاگ‌ها برای روان‌تر شدن انتقال صحنه و رفع خشکی کات.",
      hotkey: "جداسازی ترک صوتی در A1 و امتداد به سمت چپ"
    },
    {
      name: "L-Cut (ال کات تصویری)",
      desc: "تصویر عوض می‌شود اما صدای دیالوگ صحنه قبل هنوز روی تصویر جدید ادامه می‌یابد.",
      whenToUse: "نمایش واکنش چهره شنونده (Reaction Shot) در حین صحبت گوینده.",
      hotkey: "نگه داشتن صدای کلیپ قبلی زیر بی‌رول کلیپ بعدی"
    },
    {
      name: "Match Cut (مچ‌کات تطبیقی)",
      desc: "اتصال دو شیء، حرکت دست یا کادر مشابه از دو موقعیت زمانی یا مکانی کاملاً مجزا.",
      whenToUse: "ویدیوهای تبلیغاتی، انتقال از فضای خیالی به واقعیت، جهش‌های داستانی.",
      hotkey: "تراز کردن موقعیت سوژه با خطوط راهنما (Guides)"
    },
    {
      name: "Smash Cut (اسمش کات ناگهانی)",
      desc: "انتقال با کنتراست شدید؛ مثلاً از یک صحنه بسیار آرام به یک تصادف یا فریاد پرهیجان.",
      whenToUse: "ایجاد شوک حسی به مخاطب در ثانیه‌های بحرانی هوک یا پایان ویدیو.",
      hotkey: "برش بدون ترنزیشن در اوج پیک صوتی"
    },
    {
      name: "Whip Pan (سویش پن شلاقی)",
      desc: "حرکت فوق‌العاده سریع دوربین از چپ به راست همراه با تاری حرکت (Motion Blur).",
      whenToUse: "مخفی کردن کات بین دو کلیپ هوش مصنوعی به طوری که یکپارچه به نظر برسند.",
      hotkey: "اعمال ترنزیشن Directional Blur در نقطه اتصال"
    },
    {
      name: "Speed Ramp (اسپید رمپینگ)",
      desc: "شتاب‌گیری تدریجی یا ناگهانی سرعت ویدیو از اسلوموشن به فست‌فوروارد و برعکس.",
      whenToUse: "نمایش پرانرژی ورزش، رقص، سفر و رونمایی از محصولات جدید.",
      hotkey: "منحنی Speed Curve: Hero در پنل سرعت کپکات"
    }
  ];

  const shortcutsList = [
    { action: "برش کلیپ در محل نشانگر (Split)", win: "Ctrl + B", mac: "Cmd + B", note: "مهم‌ترین کلید تدوین سریع" },
    { action: "خروجی گرفتن و اکسپورت پروژه (Export)", win: "Ctrl + E", mac: "Cmd + E", note: "هدایت به دیالوگ نهایی" },
    { action: "پخش و توقف تایم‌لاین (Play/Pause)", win: "Space", mac: "Space", note: "بررسی روان بودن ریتم" },
    { action: "حذف بخش انتخاب‌شده (Delete Ripple)", win: "Delete / Backspace", mac: "Delete", note: "حذف بدون باقی ماندن جای خالی" },
    { action: "لغو آخرین تغییر (Undo)", win: "Ctrl + Z", mac: "Cmd + Z", note: "بازگشت به گام قبل" },
    { action: "تکرار مجدد تغییر (Redo)", win: "Ctrl + Shift + Z", mac: "Cmd + Shift + Z", note: "بازیابی عمل لغوشده" },
    { action: "زوم کامل روی تایm‌لاین (Zoom to Fit)", win: "Shift + Z", mac: "Shift + Z", note: "دیدن کل پروژه‌ در یک نگاه" },
    { action: "پرش یک فریم به جلو/عقب", win: "کلیدهای جهت‌نما راست/چپ", mac: "Arrow Left/Right", note: "تنظیم میلی‌ثانیه‌ای فریم کات" }
  ];

  return (
    <div className="space-y-6 text-right">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              <BookOpen className="w-3.5 h-3.5" />
              <span>مرکز آموزش تخصصی تدوین و راهنمای کامل برنامه</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              اسکیل‌های ادیت حرفه‌ای و راهنمای جامع کار با CapCut Bridge
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              آموزش گام‌به‌گام نحوه اتصال پایتون و هوش مصنوعی به نرم‌افزار دسکتاپ کپکات، تسلط بر تئوری کات‌های سینمایی، 
              نورپردازی، مهندسی صدا، و جلوگیری از خطاهای رایج دیسک.
            </p>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveSection("manual")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeSection === "manual"
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>راهنمای کار با برنامه</span>
            </button>

            <button
              onClick={() => setActiveSection("skills")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeSection === "skills"
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>اسکیل‌های ادیت و ریتم</span>
            </button>

            <button
              onClick={() => setActiveSection("cuts_guide")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeSection === "cuts_guide"
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>سبک‌های کات سینمایی</span>
            </button>

            <button
              onClick={() => setActiveSection("shortcuts")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeSection === "shortcuts"
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>کلیدهای میانبر</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: USER MANUAL (راهنمای کار با برنامه) */}
      {activeSection === "manual" && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
                ۱
              </div>
              <div>
                <h3 className="text-base font-bold text-white">معماری سیستم و چرخه کارکرد (How it Works)</h3>
                <p className="text-xs text-slate-400">کپکات یک پایگاه داده غنی مبتنی بر فایل JSON در پوشه پروژه‌ها دارد. بریج به دو صورت با آن صحبت می‌کند:</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* File Lane */}
              <div className="bg-slate-950 p-4.5 rounded-xl border border-teal-500/30 space-y-3">
                <div className="flex items-center gap-2 text-teal-400 font-bold text-sm">
                  <Cpu className="w-4 h-4" />
                  <span>خط دیسک (File Lane - برای پروژه‌های جدید و تغییرات سنگین)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  هنگامی که می‌خواهید یک پروژه جدید از صفر بسازید، برش‌های راش (EDL) اضافه کنید یا صدها زیرنویس را با هوش مصنوعی تزریق نمایید:
                </p>
                <ol className="text-xs text-slate-400 space-y-1.5 list-decimal pr-4">
                  <li>اسکریپت پایتون ابتدا کپکات را به صورت تمیز می‌بندد (برای جلوگیری از بازنویسی رجیستری).</li>
                  <li>پوشه کش بومی <code className="text-teal-300 font-mono">Timelines/</code> را پاک می‌کند.</li>
                  <li>فایل‌های ویدیویی را با هاردلینک به پوشه <code className="text-teal-300 font-mono">Resources/</code> متصل می‌نماید.</li>
                  <li>فایل <code className="text-teal-300 font-mono">draft_content.json</code> را می‌نویسد و مجدداً کپکات را باز می‌کند.</li>
                </ol>
              </div>

              {/* Live Lane */}
              <div className="bg-slate-950 p-4.5 rounded-xl border border-purple-500/30 space-y-3">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                  <Zap className="w-4 h-4" />
                  <span>خط زنده (Live Lane - اتوماسیون برنامه باز بدون ری‌استارت)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  هنگامی که کپکات روی سیستم شما باز است و می‌خواهید دستوراتی مانند برش، جابجایی یا خروجی نهایی بگیرید:
                </p>
                <ol className="text-xs text-slate-400 space-y-1.5 list-decimal pr-4">
                  <li>ارسال شورت‌کات‌های فیزیکی <code className="text-purple-300 font-mono">Ctrl+B</code> (ویندوز) یا <code className="text-purple-300 font-mono">Cmd+B</code> (مک) برای برش زدن.</li>
                  <li>ارسال میانبر خروجی <code className="text-purple-300 font-mono">Ctrl+E</code> برای باز کردن پنل رندر.</li>
                  <li>رد کردن هوشمند صفحه اشتراک‌گذاری تیک‌تاک با کلید خودکار <code className="text-purple-300 font-mono">Esc</code> (رفع قفل شدن برنامه).</li>
                  <li>گرفتن اسکرین‌شات اتوماتیک از پنجره برای کنترل کیفیت نهایی (QA).</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Step by step install guide */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                ۲
              </div>
              <div>
                <h3 className="text-base font-bold text-white">راهنمای راه‌اندازی سریع در ویندوز و مکینتاش</h3>
                <p className="text-xs text-slate-400">فقط ۳ دستور ساده برای آماده‌سازی سیستم و شروع اتوماسیون:</p>
              </div>
            </div>

            <div className="space-y-4">
              {platform === "win" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-2">
                      <Terminal className="w-4 h-4" />
                      <span>دستورات نصب خودکار در ویندوز (PowerShell / Command Prompt):</span>
                    </span>
                    <span className="text-[11px] text-slate-400">بدون نیاز به تنظیم دستی متغیرها</span>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 space-y-2 ltr text-left">
                    <div><span className="text-slate-500"># ۱. نصب کتابخانه‌های اتوماسیون</span></div>
                    <div>pip install pyautogui pillow flask requests pywin32</div>
                    <div className="pt-2"><span className="text-slate-500"># ۲. اجرای سرور پلاگین پس‌زمینه</span></div>
                    <div>python capcut-plugin-win.py</div>
                    <div className="pt-2"><span className="text-slate-500"># ۳. بررسی وضعیت پروژه‌های کپکات</span></div>
                    <div>python capcut-bridge-win.py ls</div>
                  </div>
                  <p className="text-xs text-slate-400">
                    همچنین می‌توانید از فایل <span className="text-teal-400 font-mono">install-plugin-win.bat</span> در تب Windows Plugin استفاده کنید تا تمام مراحل فوق با یک دابل‌کلیک اجرا شوند.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-400 flex items-center gap-2">
                      <Terminal className="w-4 h-4" />
                      <span>دستورات راه‌اندازی در مکینتاش (macOS Terminal):</span>
                    </span>
                    <span className="text-[11px] text-slate-400">با استفاده از پکیج‌منیجر سریع uv</span>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-teal-300 space-y-2 ltr text-left">
                    <div><span className="text-slate-500"># ۱. نصب uv (در صورت عدم نصب قبلی)</span></div>
                    <div>curl -LsSf https://astral.sh/uv/install.sh | sh</div>
                    <div className="pt-2"><span className="text-slate-500"># ۲. مشاهده تمام پروژه‌های کپکات روی دیسک</span></div>
                    <div>uv run capcut-bridge.py ls</div>
                    <div className="pt-2"><span className="text-slate-500"># ۳. برش زدن ویدیوی راش بر اساس فایل برش هوش مصنوعی</span></div>
                    <div>uv run capcut-bridge.py replay sample-cuts.json --name MyProject</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Hard Rules Warning */}
          <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>سه نکته حیاتی برای جلوگیری از خراب شدن پروژه‌های کپکات:</span>
            </div>
            <ul className="text-xs text-slate-300 space-y-2 pr-5 list-disc leading-relaxed">
              <li>
                <strong>هرگز فایل JSON را در حین باز بودن کپکات دستی ویرایش نکنید:</strong> نرم‌افزار کپکات هنگام بسته شدن کل محتوای رم را روی دیسک می‌نویسد و تغییرات دستی شما را کاملاً پاک خواهد کرد. همیشه از قابلیت بسته شدن خودکار بریج استفاده کنید.
              </li>
              <li>
                <strong>خطای source_timerange: null در متن‌ها:</strong> در نسخه‌های جدید کپکات اگر برای لایه‌های متنی تایم‌رنج سورس خالی بماند، در لحظه فشردن کلید Export برنامه تا ۹۹٪ رفته و گیر می‌کند. ما این فیلد را در بریج به صورت اتوماتیک با مقادیر دقیق پر می‌کنیم.
              </li>
              <li>
                <strong>انتقال ویدیوها به پوشه Movies / Resources:</strong> برای جلوگیری از خطای قرمز رنگ «Media Lost»، ویدیوها توسط اسکریپت به درون فولدر داخلی پروژه هاردلینک می‌شوند تا نیازی به کپی حجیم نباشد.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* SECTION 2: EDITING MASTERY CURRICULUM (اسکیل‌های تدوین) */}
      {activeSection === "skills" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {EDITING_MASTERY_SKILLS.map((topic) => {
              const isExpanded = expandedTopic === topic.id;
              return (
                <div
                  key={topic.id}
                  className={`bg-slate-900 border rounded-2xl p-5 transition-all ${
                    isExpanded ? "border-indigo-500/80 shadow-lg shadow-indigo-500/10" : "border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <button
                      onClick={() => setExpandedTopic(isExpanded ? "" : topic.id)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      <span>{isExpanded ? "بستن جزئیات" : "مشاهده اصول و ترفندها"}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <h3 className="text-base font-bold text-white mb-1">{topic.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">{topic.subtitle}</p>

                  {isExpanded && (
                    <div className="space-y-4 pt-3 border-t border-slate-800">
                      <div className="space-y-3">
                        <span className="text-xs font-bold text-indigo-300 block">قوانین و ترفندهای حرفه‌ای:</span>
                        {topic.principles.map((pr, pIdx) => (
                          <div key={pIdx} className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                            <span className="text-xs font-bold text-white block">{pr.rule}</span>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{pr.description}</p>
                            <div className="bg-indigo-950/30 p-2 rounded-lg border border-indigo-500/20 text-[11px] text-indigo-300 flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                              <span>ترفند پرو: {pr.proTrick}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2 pt-2">
                        <span className="text-xs font-bold text-teal-300 block">بهترین تنظیمات در نرم‌افزار کپکات:</span>
                        <ul className="space-y-1 text-xs text-slate-300">
                          {topic.capcutBestPractices.map((bp, bIdx) => (
                            <li key={bIdx} className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                              <span>{bp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: CUT STYLES (سبک‌های کات سینمایی) */}
      {activeSection === "cuts_guide" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-2">راهنمای انواع کات‌های ویدیویی (The Cut Styles Handbook)</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              انتخاب کات صحیح تفاوت بین یک ویدیوی خام و یک اثر سینمایی جذاب است. هر کدام از این تکنیک‌ها عملکرد روانی خاصی در ذهن تماشاچی ایجاد می‌کند:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cutStyles.map((cut, idx) => (
                <div key={idx} className="bg-slate-950 p-4.5 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                      کات شماره {idx + 1}
                    </span>
                    <Film className="w-4 h-4 text-slate-500" />
                  </div>
                  <h4 className="text-sm font-bold text-white">{cut.name}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{cut.desc}</p>
                  
                  <div className="pt-2 border-t border-slate-800 space-y-1.5 text-[11px]">
                    <div>
                      <span className="text-indigo-400 font-semibold">چه موقع استفاده کنیم: </span>
                      <span className="text-slate-400">{cut.whenToUse}</span>
                    </div>
                    <div>
                      <span className="text-amber-400 font-semibold">روش اجرا در کپکات: </span>
                      <span className="text-slate-400">{cut.hotkey}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: SHORTCUTS CHEAT SHEET (کلیدهای میانبر) */}
      {activeSection === "shortcuts" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">جدول کلیدهای میانبر فوق‌سریع تدوین (CapCut Pro Shortcuts)</h3>
              <p className="text-xs text-slate-400">سرعت تدوینگران حرفه‌ای ۳ برابر افراد عادی است چون دستانشان هرگز از کیبورد جدا نمی‌شود:</p>
            </div>
            <span className="text-xs font-mono text-teal-400 bg-teal-500/10 px-3 py-1 rounded-lg border border-teal-500/20">
              سیستم فعلی: {platform === "win" ? "ویندوز" : "مکینتاش"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-3 px-4">عنوان عمل</th>
                  <th className="py-3 px-4">میانبر در ویندوز</th>
                  <th className="py-3 px-4">میانبر در مکینتاش</th>
                  <th className="py-3 px-4">هدف و کاربرد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {shortcutsList.map((sc, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-sans font-bold text-white">{sc.action}</td>
                    <td className="py-3 px-4 text-amber-300 bg-amber-500/5">{sc.win}</td>
                    <td className="py-3 px-4 text-teal-300 bg-teal-500/5">{sc.mac}</td>
                    <td className="py-3 px-4 font-sans text-slate-400">{sc.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
