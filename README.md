# CapCut Bridge Kit 🎬⚡
### Local draft tools, guarded desktop shortcuts, and CapCut discovery (Windows & macOS)

<p align="center">
  <a href="https://github.com/Hesaar-Studio/capcut-bridge-kit">
    <img src="https://img.shields.io/badge/CapCut-Bridge%20Kit-00E5B9?style=for-the-badge&logo=video&logoColor=black" alt="CapCut Bridge Kit" />
  </a>
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.11+" />
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/AI-Prompt%20Library-8A2BE2?style=for-the-badge" alt="AI prompt library" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License" />
</p>

---

## 📖 معرفی به فارسی (Overview in Persian)

**CapCut Bridge Kit** مجموعه‌ای آزمایشی از ابزارهای محلی برای کار با فایل پروژه و بررسی مسیرهای اتصال به **CapCut** است. این بسته چند ابزار Python و یک سرور MCP دارد؛ اتصال مستقیم و تأییدشده به تایم‌لاین باز CapCut ارائه نمی‌کند.

ابزارهای فعلی بخشی از تغییرات پروژه را از طریق فایل‌های داخلی CapCut انجام می‌دهند و چند میانبر دسکتاپ را می‌فرستند. رفتار آن‌ها به نسخه‌ی CapCut و ساختار فایل پروژه وابسته است؛ پیش از تغییر پروژه، نسخه‌ی پشتیبان بگیرید.

توسعه‌یافته توسط تیم **[Hesaar Studio](https://github.com/Hesaar-Studio)**.

---

## 🌟 ویژگی‌های کلیدی (Key Features)

- 🔌 **اتصال MCP محلی:** ابزارهای read-only برای فهرست و بررسی پروژه‌ها، بررسی capabilityها و نمایش نقشهٔ شواهد مسیرهای اتصال CapCut؛ ابزارهای ساخت/متن فقط در مسیر فایل پروژه‌اند و readback روی دیسک، پذیرش در CapCut را ثابت نمی‌کند.
- 🪟 **مسیر Windows (نمونهٔ در حال توسعه؛ اجرای زنده تأییدنشده):**
  - اسکریپت `capcut-bridge-win.py` و میانبرهای محدود با بررسی foreground؛ ارسال کلید به‌تنهایی نتیجهٔ timeline را تأیید نمی‌کند.
  - سرویس REST محلی `capcut-plugin-win.py` روی `http://127.0.0.1:8765`؛ روی loopback بماند و به شبکه/اینترنت منتشر نشود.
- 🍏 **مسیر macOS (نمونهٔ در حال توسعه؛ اجرای زنده تأییدنشده):**
  - اسکریپت `capcut-bridge.py` با هدر استاندارد PEP 723 و پکیج‌منیجر سریع `uv` با پکیج‌های PyObjC و Quartz.
- 🧪 **ابزارهای فایل پروژه (تجربی):**
  - نوشتن پروژه‌ی تازه از فهرست برش‌های ویدیویی.
  - افزودن متن به پروژه‌ی موجود.
  - تهیه‌ی نسخه‌ی پشتیبان پیش از اجرای این عملیات توصیه می‌شود.
- 🎨 **کتابخانه پرامپت‌های تدوین و نورپردازی:**
  - ده‌ها پرامپت آماده و مهندسی‌شده برای نورپردازی رامبراند، نئون سایبرپانک، ساعت طلایی، کات‌های اسپیدرمپ، جی‌کات (J-Cut) و الکس هرموزی.
- 📚 **آکادمی اسکیل‌های تدوین و راهنمای کامل کاربری:**
  - آموزش اصول حفظ مخاطب (۳ ثانیه اول)، مهندسی صدای ۴ لایه و محدوده‌های امن (Safe Zones).

---

## 🏗️ معماری سیستم (System Architecture)

```
[ AI Content / Prompts ]
(Kling / Runway / ElevenLabs / Gemini)
           │
           ▼
[ HS.Tech Bridge ]
 ├── Read-only surface map (10 CapCut integration pathways)
 ├── Draft-file lane
 │    ├── Backup before an existing-draft write
 │    ├── Atomic JSON replacement and disk readback
 │    └── Disk readback is not CapCut UI acceptance
 ├── Guarded keyboard lane
 │    ├── Limited shortcuts only when CapCut is foreground
 │    └── Sent events are not editor-side completion proof
 └── Local MCP stdio / loopback REST
      └── Bridge-to-agent protocol; not a CapCut-owned IPC API
           │
           ▼
[ CapCut Desktop (manual review required for live acceptance) ]
```

---

## 🚀 راهنمای نصب و راه‌اندازی سریع (Quick Start)

### 🪟 نصب‌کنندهٔ ویندوز (Windows x64)

این مخزن مسیر ساخت نصب‌کنندهٔ NSIS دارد؛ ZIP قابل‌دانلود از پنل، snapshot سورس است و **Setup.exe نیست**. برای بازسازی آن از سورس فعلی، `npm run package:source` را اجرا کنید. ساخت نصب‌کننده باید روی **Windows x64** انجام شود، چون runtime پایتون با PyInstaller برای ویندوز بسته‌بندی می‌شود. پیش‌نیازها Node.js 22.12 یا جدیدتر، Python 3.11 یا جدیدتر و npm 10 یا جدیدتر هستند. پس از گرفتن سورس:

```powershell
npm ci
python -m pip install -r requirements-win-build.txt
npm test
npm run build:win
```

فایل خروجی در `release/artifacts/HS.Tech-Bridge-Setup-x64.exe` ساخته می‌شود. GitHub Actions نیز با اجرای workflow دستی **Windows x64 installer** همین فایل و checksum آن را به‌صورت artifact می‌سازد. این نصب‌کننده per-user است و نباید برای اجرا به Administrator نیاز داشته باشد. فایل unsigned است؛ در صورت انتشار عمومی باید امضای کد معتبر اضافه شود.

`install-all-win.bat` نصاب برنامه نیست و فقط برای آماده‌سازی محیط توسعه است. اگر Node.js موجود نباشد، تلاش می‌کند با `winget` نسخهٔ LTS را نصب کند؛ همچنین بسته‌های Python را در محیط فعال نصب و `npm ci` اجرا می‌کند، بنابراین ممکن است محیط/نرم‌افزار دستگاه را تغییر دهد. فقط در صورت قصد توسعه آن را اجرا کنید. این اسکریپت به‌تنهایی Setup.exe نمی‌سازد. ساخت موفق فایل `.exe` نیز آزمون نصب، شروع و حذف روی Windows یا اتصال زنده به CapCut را ثابت نمی‌کند. هرگز CapCut را با Administrator اجرا نکنید و برای دورزدن UIPI یا محدودیت‌های دسترسی elevation ندهید.

---

### 🍏 روش دوم: مکینتاش (macOS)

کافیست از پکیج‌منیجر مدرن `uv` بدون نیاز به نصب دستی کتابخانه‌ها استفاده کنید:

```bash
# ۱. نصب ابزار uv (در صورت عدم نصب قبلی)
curl -LsSf https://astral.sh/uv/install.sh | sh

# ۲. مشاهده تمام پروژه‌های کپکات دسکتاپ
uv run capcut-bridge.py ls

# ۳. اجرای یک فایل برش اتوماتیک روی پروژه
uv run capcut-bridge.py replay sample-cuts.json --name MyViralVideo
```

`replay` فقط پروژه‌ی تازه می‌سازد و اگر نام مقصد وجود داشته باشد متوقف می‌شود. برای جایگزینی، مقصد ابتدا در staging ساخته و اعتبارسنجی می‌شود؛ سپس نام پروژه را صریحاً دوباره تأیید کنید. نسخه‌ی قبلی در پوشه‌ی backup مخفی کنار پروژه نگه داشته می‌شود:

```bash
uv run capcut-bridge.py replay sample-cuts.json --name MyViralVideo --overwrite --confirm-name MyViralVideo
```

---

### 🖥️ اجرای پنل وب پروژه

پنل تصویری پروژه یک اپ React است و به‌صورت جدا از سرویس MCP اجرا می‌شود:

```bash
npm install
npm run dev
```

اگر `npm install` خطای ناسازگاری `vite` و `esbuild` داد، ابتدا مطمئن شوید آخرین نسخهٔ repository را دریافت کرده‌اید؛ این ناسازگاری در `package.json` اصلاح شده است. سپس `npm install` را دوباره اجرا کنید. استفاده از `--force` یا `--legacy-peer-deps` لازم نیست.

بعد از اجرای موفق، آدرس محلی نمایش‌داده‌شده در ترمینال را در مرورگر باز کنید. برای اجرای مستقیم Bridge MCP نیز از این فرمان استفاده کنید:

`install-all-win.bat` فقط helper توسعه است؛ جزئیات تغییراتی که انجام می‌دهد در هشدار بالا آمده است. برای ساخت Setup.exe، پیش‌نیازها و فرمان‌های [راهنمای نصاب Windows](docs/WINDOWS_INSTALLER_BUILD.md) را دنبال کنید. اسکریپت‌های قدیمی `install-plugin-win.bat`، `bridge_system/setup.bat` و `bridge_system/install.sh` غیرفعال‌اند.

```bash
python bridge_system/bridge_server.py --mcp
```

## 🔌 اتصال MCP به دستیارها

راهنمای تنظیم Claude Desktop و Cursor و ابزارهای پیاده‌سازی‌شده در [bridge_system/README.md](bridge_system/README.md) آمده است. MCP این Bridge از `stdio` استفاده می‌کند و کنترل مستقیم timeline باز در CapCut ارائه نمی‌دهد. CapCut × Codex یک مسیر رسمی جداگانه و region-gated است؛ آن را با API محلی یا IPC برنامه اشتباه نگیرید.

## 🧭 نقشه مسیرهای اتصال CapCut

برای جلوگیری از توقف در «API عمومی پیدا نشد»، ده مسیر رسمی، محلی، فایل‌محور، UIA، community و black-box جداگانه با وضعیت‌های `FOUND`, `SUPPORTED`, `EXPERIMENTAL`, `UNVERIFIED`, یا `UNAVAILABLE` ثبت شده‌اند. نقشه read-only است و هیچ probe یا تغییری اجرا نمی‌کند. شواهد، محدودیت‌ها و آزمون امن بعدی در [docs/CAPCUT_SURFACE_MAP.md](docs/CAPCUT_SURFACE_MAP.md) آمده و از operation قرارداد `get_capcut_surface_map` نیز در دسترس است.

## 📡 وب‌سرویس نمونه

REST کنترلر Windows روی `http://127.0.0.1:8765` اجرا می‌شود و CORS مرورگری آن به Originهای محلی مجاز محدود است. API برای کلاینت‌های بومی احراز هویت ندارد و نباید در معرض شبکه یا اینترنت قرار گیرد. REST نمونه‌ی `bridge_system` روی پورت `8766` است؛ این API فرمان تدوین واقعی ارائه نمی‌دهد:

| متد | مسیر (Endpoint) | عملکرد |
|---|---|---|
| `GET` | `/api/v1/status` | وضعیت فرایند CapCut و وجود پوشه‌ی پروژه‌ها |
| `GET` | `/api/v1/drafts` | فهرست پروژه‌های محلی |
| `POST` | `/api/v1/split` | ارسال میانبر به برنامه‌ی فعال؛ نتیجه تأیید نمی‌شود |
| `POST` | `/api/v1/export` | ارسال میانبر export؛ تکمیل و فایل خروجی تأیید نمی‌شوند |
| `POST` | `/api/v1/play` | ارسال میانبر پخش/توقف به برنامه‌ی فعال |

REST نمونه‌ی پورت 8766 فقط مسیر health/status، پاسخ 501 برای sync و تولید LUT ساده دارد.

---

## 💻 دستورات خط فرمان (CLI Commands)

### ۱. لیست پروژه‌ها:
```bash
python capcut-bridge-win.py ls
# یا در مک:
uv run capcut-bridge.py ls
```

### ۲. ساخت پروژه جدید از روی برش‌های راش (EDL Cuts Replay):
```bash
python capcut-bridge-win.py replay sample-cuts.json --name "Podcast_Highlight_01"
```

برای جایگزینی در Windows نیز هر دو گزینه‌ی تأیید لازم‌اند؛ backup قبلی در پوشه‌ی CapCut کنار پروژه باقی می‌ماند:

```powershell
python capcut-bridge-win.py replay sample-cuts.json --name "Podcast_Highlight_01" --overwrite --confirm-name "Podcast_Highlight_01"
```

### ۳. افزودن یک قطعهٔ متن به فایل پروژه (آزمایشی):
```bash
python capcut-bridge-win.py add-text "Podcast_Highlight_01" "راز موفقیت اینجاست!" --at 1.2 --dur 2.0 --font "TheBoldFont"
```

### ۴. قرار دادن بی‌رول و لایه هوش مصنوعی (B-Roll Overlay):
```bash
python capcut-bridge-win.py add-overlay "Podcast_Highlight_01" broll_neon.mp4 --at 2.0 --dur 3.5 --layer 2
```

### ۵. تنظیم مقیاس و جابجایی تصویر (Transform):
```bash
python capcut-bridge-win.py transform "Podcast_Highlight_01" --track overlay --index 1 --scale 1.15 --y -0.1
```

---

## 📂 ساختار فایل‌های مخزن (Repository Structure)

```
capcut-bridge-kit/
├── .gitignore                    # فایل‌های نادیده‌گرفته‌شده در گیت
├── LICENSE                       # مجوز نرم‌افزار آزاد MIT
├── README.md                     # راهنمای کامل پروژه (فارسی و انگلیسی)
├── install-plugin-win.bat        # اسکریپت قدیمی؛ غیرفعال و بدون تغییر سیستم
├── capcut-bridge-win.py          # CLI ویندوز؛ میانبرهای محدود و guarded، نتیجهٔ زنده تأییدنشده
├── capcut-plugin-win.py          # سرویس REST روی loopback؛ پلاگین رسمی CapCut نیست
├── capcut-bridge.py              # اسکریپت اتوماسیون مکینتاش (PyObjC / uv)
├── INPUT-CONTRACT.md             # مستندات قرارداد فنی فرمت JSON و EDL
├── sample-cuts.json              # نمونه فایل کات‌های تدوین هوش مصنوعی
├── sample-graphics-plan.json     # نمونه برنامه‌ریزی لایه‌های موشن گرافیک
├── package.json                  # رابط کاربری تحت وب (React + Tailwind)
├── vite.config.ts                # پیکربندی سرور بیلد Vite
└── src/
    ├── components/
    │   ├── CapCutStudio.tsx      # پنل شبیه‌ساز استودیو کپکات و پایپ‌لاین AI
    │   ├── PromptLibrary.tsx     # کتابخانه پرامپت‌های تدوین، نور و کات
    │   ├── EditingMastery.tsx    # راهنمای جامع و اسکیل‌های ادیتور حرفه‌ای
    │   ├── WindowsPluginGuide.tsx# راهنمای تعاملی و تستر API ویندوز
    │   ├── CommandBuilder.tsx    # ابزار تولید دستورات CLI
    │   └── TimelineVisualizer.tsx# مانیتور تایم‌لاین چندلایه‌ای
    └── data/
        ├── editingPrompts.ts     # دیتای پرامپت‌های تدوین و اصول سینمایی
        └── bridgeSource.ts       # سورس‌کدهای متنی اسکریپت‌ها
```

---

## 🤝 مشارکت و توسعه (Contributing)

از تمامی توسعه‌دهندگان، ادیتورهای ویدیویی و مهندسان هوش مصنوعی برای توسعه این پروژه استقبال می‌شود:
1. مخزن را فورک (Fork) کنید.
2. یک شاخه جدید بسازید (`git checkout -b feature/AmazingFeature`).
3. تغییرات خود را ثبت (Commit) کنید (`git commit -m 'Add some AmazingFeature'`).
4. به شاخه اصلی پوش (Push) کنید (`git push origin feature/AmazingFeature`).
5. یک درخواست پول ریکوئست (Pull Request) ارسال نمایید.

---

## 📄 مجوز (License)

این پروژه تحت مجوز **MIT** منتشر شده است. استفاده تجاری و شخصی با ذکر منبع کاملاً آزاد است.

سازنده و صاحب امتیاز: **[Hesaar Studio](https://github.com/Hesaar-Studio)**  
ایمیل تماس: `hesaart3@gmail.com`
