# CapCut Bridge Kit 🎬⚡
### Automated AI-to-CapCut Timeline Pipeline & Desktop Bridge (Windows & macOS)

<p align="center">
  <a href="https://github.com/Hesaar-Studio/capcut-bridge-kit">
    <img src="https://img.shields.io/badge/CapCut-Bridge%20Kit-00E5B9?style=for-the-badge&logo=video&logoColor=black" alt="CapCut Bridge Kit" />
  </a>
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.11+" />
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/AI-Kling%20%7C%20Runway%20%7C%20ElevenLabs-8A2BE2?style=for-the-badge" alt="AI Models" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License" />
</p>

---

## 📖 معرفی به فارسی (Overview in Persian)

**CapCut Bridge Kit** یک نمونه‌ی در حال توسعه برای اتصال ابزارهای هوش مصنوعی به پروژه‌های دسکتاپ **CapCut** است. این بسته چند ابزار محلی پایتون و یک سرور MCP دارد؛ اتصال مستقیم و کامل به تایم‌لاین باز CapCut هنوز ارائه نشده است.

ابزارهای فعلی بخشی از تغییرات پروژه را از طریق فایل‌های داخلی CapCut انجام می‌دهند و چند میانبر دسکتاپ را می‌فرستند. رفتار آن‌ها به نسخه‌ی CapCut و ساختار فایل پروژه وابسته است؛ پیش از تغییر پروژه، نسخه‌ی پشتیبان بگیرید.

توسعه‌یافته توسط تیم **[Hesaar Studio](https://github.com/Hesaar-Studio)**.

---

## 🌟 ویژگی‌های کلیدی (Key Features)

- 🔌 **اتصال MCP محلی:** فهرست پروژه‌ها، بررسی وضعیت محلی، ساخت پروژه‌ی تازه از برش‌های فایل و افزودن متن به پروژه‌ی موجود. عملیات ساخت/ویرایش ممکن است CapCut را ببندد و دوباره باز کند.
- 🪟 **پشتیبانی کامل از ویندوز (Windows Native):**
  - اسکریپت اختصاصی `capcut-bridge-win.py` با بهره‌گیری از `pyautogui` و Win32 API.
  - فایل نصب خودکار یک‌کلیکه `install-plugin-win.bat`.
  - سرویس سرور پلاگین پس‌زمینه `capcut-plugin-win.py` روی پورت `http://127.0.0.1:8765`.
- 🍏 **پشتیبانی کامل از مکینتاش (macOS):**
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
[ CapCut Bridge Engine ]
 ├── File Lane (Disk Operations)
 │    ├── Graceful App Shutdown (taskkill / pkill)
 │    ├── Clean Cache: /Timelines/
 │    ├── Hardlink Assets to /Resources/
 │    └── Inject clean draft_content.json
 │
 └── Live Lane (local pyautogui / PyObjC keyboard and accessibility control)
      ├── Split Clip: Ctrl+B / Cmd+B
      ├── Play / Pause: Space
      ├── Export Timeline: Ctrl+E / Cmd+E
      └── Dismiss Social Share Dialog: Esc
           │
           ▼
[ CapCut Desktop Editor (Windows / macOS) ]
```

---

## 🚀 راهنمای نصب و راه‌اندازی سریع (Quick Start)

### 🪟 روش اول: ویندوز (Windows)

#### الف) نصب خودکار با ۱ کلیک:
فایل `install-plugin-win.bat` را دانلود کرده و روی آن راست‌کلیک کنید و گزینه **Run as administrator** را بزنید:
1. پایتون سیستم بررسی می‌شود.
2. پکیج‌های `pyautogui`، `pillow`، `flask`، `requests` و `pywin32` نصب می‌شوند.
3. متغیر محیطی `PATH` تنظیم شده و سرور محلی پلاگین در پس‌زمینه اجرا می‌گردد.

#### ب) نصب دستی در ویندوز (Command Prompt / PowerShell):
```bash
# ۱. نصب پکیج‌های پایتون
pip install pyautogui pillow flask requests pywin32

# ۲. اجرای سرور پلاگین پس‌زمینه
python capcut-plugin-win.py

# ۳. اجرای اسکریپت بریج برای مشاهده پروژه‌ها
python capcut-bridge-win.py ls
```

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

```bash
python bridge_system/bridge_server.py --mcp
```

## 🔌 اتصال MCP به دستیارها

راهنمای تنظیم Claude Desktop و Cursor و ابزارهای واقعاً پیاده‌سازی‌شده در [bridge_system/README.md](bridge_system/README.md) آمده است. سرور MCP از `stdio` استفاده می‌کند و برای همین نیازی به بازکردن پورت HTTP ندارد. در حال حاضر MCP کنترل زنده‌ی تایم‌لاین باز را انجام نمی‌دهد.

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

### ۳. اضافه کردن زیرنویس با استایل متحرک:
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
├── install-plugin-win.bat        # فایل نصب خودکار و ۱-کلیک برای ویندوز
├── capcut-bridge-win.py          # اسکریپت اتوماسیون کامل ویندوز (pyautogui)
├── capcut-plugin-win.py          # وب‌سرور پلاگین پس‌زمینه ویندوز (REST API)
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
