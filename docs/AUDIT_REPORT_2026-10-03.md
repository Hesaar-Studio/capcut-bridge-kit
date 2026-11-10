# گزارش بازبینی امنیتی و آمادگی انتشار

**پروژه:** HS.Tech AI Video Bridge / مسیر نصاب Windows x64
**تاریخ:** ۳ اکتبر ۲۰۲۶
**نوع بررسی:** بازبینی ایستا و آزمون‌های محلیِ غیرتهاجمی؛ بدون دسترسی به سیستم Windows یا نشست زندهٔ CapCut

## رأی اجرایی

**وضعیت انتشار نصاب: NO-GO — فایل Setup.exe هنوز ساخته یا آزموده نشده است.** مسیر ساخت در سورس آماده و preflight آن موفق است، اما اجرای `npm run build:win` روی Linux عمداً با پیام نیاز به runner بومی Windows x64 متوقف شد. در workspace و بستهٔ ZIP هیچ `HS.Tech-Bridge-Setup-x64.exe` وجود ندارد. workflow ویندوز هم نوشته شده، ولی اجرا نشده است.

این یعنی «مسیر ساخت سورس بررسی شده»، نه «نصاب واقعی تحویل یا تأیید شده». تا وقتی runner ویندوز فایل را نسازد و آزمون نصب/اجرا/حذف روی Windows تمیز انجام نشود، نباید آن را نصاب آمادهٔ انتشار نامید.

## دامنه و روش

بررسی شامل `package.json` و lockfile، workflow، اسکریپت‌های PyInstaller/NSIS، preload و تنظیمات Electron، endpointهای loopback، مستندات نقشهٔ CapCut، تست‌ها و audit وابستگی‌ها بود. هیچ اسکن شبکه یا فرایند روی دستگاه کاربر، استخراج اعتبارنامه، تزریق، elevation/UIAccess/UIPI bypass، دست‌کاری پروژه یا اتصال به CapCut انجام نشد. بازبینی رفتار واقعی Windows و CapCut خارج از دسترس این محیط است.

## یافته‌ها

### 1. مسدودکنندهٔ انتشار — نبود نصاب و آزمون Windows

- `scripts/build-win.mjs` پیش‌نیازها و تنظیمات per-user را بررسی می‌کند و روی سیستم غیر Windows عمداً build را رد می‌کند (`scripts/build-win.mjs:28–50, 78–113`).
- bundler پایتون هم native Windows و Python x64 می‌خواهد (`scripts/build-python-services.py:72–80`).
- بررسی فایل‌ها نشان داد فایل `.exe` نصاب وجود ندارد. GitHub Actions workflow موجود است، اما تا زمان این گزارش اجرا نشده.
- بنابراین PyInstaller روی Windows، اجرای MCP از runtime بسته‌بندی‌شده، عملکرد NSIS، و uninstall هنوز اثبات نشده‌اند.

**اقدام لازم:** اجرای workflow روی Windows x64 یا build محلی؛ سپس آزمون با حساب معمولی، بدون Administrator، شامل نصب، بازشدن برنامه، وضعیت سرویس‌ها، MCP config، توقف فرایندهای متعلق به برنامه و حذف نصب.

### 2. ریسک انتشار — فایل unsigned

NSIS برای نصب per-user و `asInvoker` پیکربندی شده و حذف دادهٔ کاربر هنگام uninstall خاموش است؛ این تنظیمات با اصل حداقل‌دسترسی سازگارند (`package.json`, بخش‌های `build.win` و `build.nsis`). اما امضای کد تنظیم نشده است. فایل عمومیِ unsigned ممکن است هشدار SmartScreen بگیرد و هویت ناشر را به گیرنده اثبات نمی‌کند.

**اقدام لازم:** پیش از توزیع عمومی، امضای کد معتبر اضافه و hash انتشار را خارج از فایل اجرایی اعلام کنید. workflow فعلی checksum می‌سازد، نه امضای دیجیتال.

### 3. ریسک محلی متوسط — سرویس loopback بدون احراز هویت برنامه‌ای

Electron API و افزونهٔ Flask روی loopback میزبانی می‌شوند؛ Express علاوه بر بررسی `Host`, برای درخواست‌های تغییردهنده Origin هم‌مبدأ می‌خواهد، و افزونه فقط `127.0.0.1` را bind می‌کند (`server.ts:55–116`, `electron_main.cjs:273–288`, `capcut-plugin-win.py:35–60, 342`). اینها از دسترسی عادی از شبکه و بخشی از درخواست‌های cross-origin مرورگر جلوگیری می‌کنند.

اما CORS/Origin احراز هویت نیست: **هر فرایند محلی همان کاربر** می‌تواند Origin را جعل یا حذف کند. endpoint فهرست پروژه‌ها مسیرهای محلی را برمی‌گرداند (`capcut-plugin-win.py:187–240`). endpointهای `split`, `play` و `export` هم shortcut صفحه‌کلید می‌فرستند؛ گارد foreground وجود دارد، ولی خود endpointها token/authorization ندارند و نتیجه را صریحاً `sent_unverified` می‌نامند (`capcut-plugin-win.py:246–328`). این، بر اساس کد فعلی، یک مسیر **محلی** است و مدرکی برای دسترسی مستقیم remote پیدا نشد؛ با این حال نباید پورت روی `0.0.0.0` باز شود یا این سرویس در شبکه منتشر شود.

**اقدام پیشنهادی:** برای endpointهای تغییردهنده، token تصادفی per-session یا IPC محدود به برنامه در نظر بگیرید؛ originهای توسعه را فقط در حالت dev نگه دارید؛ live shortcutها را خاموش یا به تأیید صریح و قابل‌مشاهدهٔ کاربر محدود کنید. در این audit هیچ endpointی فراخوانی نشد.

### 4. هشدار زنجیرهٔ ساخت — ۸ گزارش high، بدون critical

`npm audit --omit=dev --audit-level=high` با **صفر آسیب‌پذیری** موفق شد. بررسی کامل با `npm audit --audit-level=critical` نیز exit code صفر و **صفر critical** داشت، ولی ۸ ورودی high را از یک وابستگی build-time یعنی `http-cache-semantics@4.2.0` نشان داد: مسیر `electron-builder → app-builder-lib → @electron/get → got → cacheable-request`. بنابراین این هشدارها در زنجیرهٔ ابزار ساخت‌اند، نه وابستگی مستقیمِ API تولیدی؛ با این حال Electron هم در `devDependencies` است و audit کامل، نه فقط `--omit=dev`، باید پیش از انتشار مرور شود.

**اقدام پیشنهادی:** هشدار را سرکوب یا با downgrade کور پاک نکنید؛ CI را ایزوله نگه دارید، نتیجهٔ full audit را در هر انتشار بازبینی و پس از اصلاح upstream دوباره اسکن کنید. GitHub Actions فعلی روی سطح `critical` در کل درخت و `high` در dependencyهای production fail می‌شود، پس highهای build-only را گزارش می‌کند اما خودکار متوقف نمی‌کند.

`pip-audit -r requirements-win-build.txt` در Linux پیام «No known vulnerabilities found» داد. این ارزیابی **Windows-target کامل نیست**: شرط platform باعث می‌شود `pywin32` که فقط برای Windows تعریف شده، در محیط Linux ارزیابی نشود. بهتر است Python audit نیز در Windows CI اجرا شود.

### 5. زنجیرهٔ تأمین CI — pin کردن Actionها به SHA توصیه می‌شود

workflow از tagهای شناور major مانند `actions/checkout@v4` و `actions/setup-node@v4` استفاده می‌کند (`.github/workflows/windows-installer.yml:16–30, 63–65`). این الگو رایج است، اما به اندازهٔ pin کردن commit SHA ثابت نیست.

**اقدام پیشنهادی:** برای انتشارهای حساس، Actionها را به full commit SHA pin و به‌روزرسانی‌ها را با بازبینی وابستگی مدیریت کنید. workflow موجود فقط artifact آپلود می‌کند؛ release signing یا آزمون نصب را انجام نمی‌دهد.

### 6. نکتهٔ کم‌خطر — فهرست endpoint شامل مسیر ناموجود

پاسخ `GET /` در افزونه نام `/api/v1/launch` را تبلیغ می‌کند، اما در کد routeای برای آن پیدا نشد (`capcut-plugin-win.py:140–165`; فهرست routeها تا `play` ادامه دارد). این بیشتر ناسازگاری مستندات/API است تا آسیب‌پذیری؛ endpoint را صدا نزدم.

## کنترل‌های مثبت مشاهده‌شده

- Electron از `contextIsolation`, `sandbox`, `webSecurity` استفاده می‌کند و `nodeIntegration` خاموش است؛ preload فقط wrapperهای محدود و اعتبارسنجی‌شده را افشا می‌کند (`electron_main.cjs:187–204`, `preload.cjs:7–43`).
- بازکردن لینک خارجی به `https:`, `http:` و `mailto:` محدود شده و navigation داخل پنجرهٔ برنامه کنترل می‌شود.
- API کلید Gemini را با `safeStorage` ذخیره می‌کند و loggerها الگوهای رایج کلید/token را redact می‌کنند (`electron_main.cjs:35–99`).
- NSIS per-user و `asInvoker` است؛ build script نیز ورودی‌ها، target x64 و ساختار ICO را preflight می‌کند.
- سرویس manager فقط فرزندهایی را متوقف می‌کند که خودش راه‌اندازی کرده؛ هیچ `taskkill` عمومی یا بستن/اجرای CapCut در مسیر نصب دیده نشد.
- shortcutهای افزونه پیش از ارسال، وضعیت اجرا و foreground بودن CapCut را بررسی می‌کنند؛ پاسخ‌ها هم انجام واقعی تغییر یا export را تأیید نمی‌کنند.
- مستند نقشهٔ CapCut، اتصال رسمی CapCut × Codex را از این Bridge جدا می‌کند. همان مستند می‌گوید مسیر رسمی remote MCP منطقه‌محدود است و دسترسی حساب/شبکهٔ کاربر بررسی نشده؛ بنابراین این build **اتصال رسمی را پیاده‌سازی یا اثبات نمی‌کند**. سناریوی «اعمال زیرنویس در timeline» در وضعیت analysis/preview-only باقی می‌ماند (`docs/CAPCUT_SURFACE_MAP.md:23–41, 60–66`).

## آزمون‌های قابل بازتولید در این محیط

- `npm ci --no-audit --no-fund`: موفق، با Node `24.21.0`.
- `npm test`: پیش از اصلاحات P5، ۱۵ آزمون Node و ۸۳ آزمون Python موفق بود؛ پس از اصلاحات P5، **۱۵ آزمون Node و ۸۴ آزمون Python موفق** شدند. آزمون جدید ZIP سورس نیز به suite افزوده شد. برای suite پایتون، Flask `3.1.3` در محیط بررسی نصب شد.
- `npm run build:desktop`: موفق؛ Vite هشدار غیرمسدودکننده داد که chunk جاوااسکریپت minified حدود `1.15 MB` است و از آستانهٔ توصیه‌ای `500 kB` بیشتر است.
- `npm run lint` (`tsc --noEmit`): موفق.
- `npm run build:win:check` و `python scripts/build-python-services.py --validate-only`: موفق.
- syntax checks برای JavaScript/Python و `git diff --check`: موفق.
- `npm run build:win`: روی Linux پس از preflight به‌درستی با نیاز به native Windows x64 متوقف شد؛ هیچ `.exe` تولید نکرد.
- بستهٔ سورس پیش از P5 `HS.Tech-CapCut-Bridge-Windows-Installer-Source-2026-10-03.zip` از نظر ZIP و ورودی‌های اجباری بررسی شد؛ ۱۲۰ entry و SHA-256 آن `deb28c1bba2f0ae20ab7df241155bbb023570cd0dde19fd75c8b3460e593f2da` بود. بازبینی بعدی نشان داد این snapshot آرشیو عمومی قدیمی و helper نصبِ فعال را داخل خود داشت؛ بنابراین این checksum فقط برای سابقه است و آن فایل نباید دوباره توزیع شود. نسخهٔ قبلی در `/home/user/legacy-source-handoff-2026-10-03.zip` نگه‌داری شده است.

## جمع‌بندی و اولویت‌ها

**حکم نهایی:** سورس و preflight مسیر ساخت قابل‌قبول‌اند؛ محصول نصبی هنوز release-ready نیست.

1. **P0:** ساخت روی Windows x64، سپس نصب/اجرا/MCP/حذف را با کاربر معمولی آزمایش و نتیجه را ثبت کنید.
2. **P1:** برای loopback endpointهای تغییردهنده تهدیدِ فرایند محلی را صریحاً بپذیرید یا احراز هویت برنامه‌ای اضافه کنید؛ پورت را روی شبکه expose نکنید.
3. **P1:** امضای کد را قبل از توزیع عمومی اضافه کنید و checksum artifact را مستقل تأیید کنید.
4. **P2:** full npm audit را نگه دارید، هشدار build-only را تا اصلاح upstream دنبال کنید و audit پایتون را در Windows CI کامل کنید.
5. **P3:** Actionهای GitHub را به SHA pin و endpoint مستندشدهٔ `/api/v1/launch` را اصلاح کنید.

این گزارش تست نفوذ زنده، تأیید CapCut، یا اثبات بی‌نقص‌بودن نیست. بررسی فقط به سورس عمومی/موجود در workspace و آزمون‌های محلی محدود ماند.

## ارزیابی تکمیلی P5 (۳ اکتبر ۲۰۲۶)

### اصلاحات انجام‌شده

- ZIP دانلودی `public/hs-art-tech-bridge.zip` اکنون با `scripts/package-source.py` از درخت فعلی سورس ساخته می‌شود؛ نصاب نیست و شامل ZIP تودرتو یا Setup.exe نمی‌شود. تست `tests/test_source_archive.py` سلامت ZIP، ورودی‌های لازم، نبود cache/secret/binary و عدم self-inclusion خروجی را بررسی می‌کند.
- اجرای نخست سازنده یک اشکال self-inclusion را آشکار کرد: فایل موقت در پوشهٔ `public` وارد پیمایش lazy شده بود. خروجی عمومی به‌روزرسانی نشد؛ فایل موقت ناقص حذف شد. سازنده اصلاح شد تا ورودی‌ها را پیش از ایجاد خروجی موقت snapshot کند، آزمون هدفمند موفق شد و سپس ZIP با موفقیت ساخته شد.
- `install-plugin-win.bat` و helperهای قدیمی `bridge_system/setup.bat` و `bridge_system/install.sh` اکنون فقط هشدار می‌دهند و dependency نصب یا سرویسی اجرا نمی‌کنند. metadata تو‌در‌توی package نیز private و بدون dependency/script شد. نسخه‌های قبلی خارج از مخزن پشتیبان‌گیری شده‌اند؛ helper توسعهٔ root یعنی `install-all-win.bat` همچنان عمداً فعال است و README صریحاً می‌گوید در صورت نبود Node، `winget` را امتحان و dependencyهای Python را در محیط فعال نصب می‌کند.
- رابط، README و راهنمای `bridge_system` نام و ادعای قابلیت‌ها را محدودتر کرده‌اند: ZIP سورس است؛ سرویس REST افزونهٔ رسمی CapCut نیست؛ timeline زنده و پذیرش واقعی تغییرها تأیید نشده‌اند؛ فایل نصاب هنوز موجود نیست.
- snapshot handoff قبلی با SHA-256 `deb28c1bba2f0ae20ab7df241155bbb023570cd0dde19fd75c8b3460e593f2da` حفظ شد و باید به‌عنوان خروجی منسوخ تلقی شود. نسخهٔ تازه از سورس فعلی جداگانه بازتولید شده است؛ SHA دقیق artifact در رسید تحویل همان فایل ثبت شده، نه داخل ZIP خودش.

### راستی‌آزمایی پس از P5

- محیط: Node `v24.21.0`, npm `10.8.2`; `npm ci --no-audit --no-fund` موفق.
- `npm test`: ۱۵ آزمون Node و **۸۴ آزمون Python** موفق؛ `npm run lint` موفق.
- `npm run build:desktop` موفق؛ هشدار غیرمسدودکنندهٔ chunk بزرگ (`1,147.97 kB`) باقی است.
- `npm run build:win:check` و `python scripts/build-python-services.py --validate-only` موفق؛ این‌ها preflight هستند، نه build نصاب.
- `npm audit --omit=dev --audit-level=high`: صفر یافته. Full `npm audit --audit-level=high`: ۸ high در زنجیرهٔ build حول `http-cache-semantics@4.2.0`; downgrade کور یا `--force` اجرا نشد.
- آزمون منفی Windows/CapCut انجام نشده است. **نصاب Windows x64 و smoke test نصب/اجرا/حذف همچنان NO-GO است.** unsigned بودن، هشدار dependency ساخت و نیاز به تست Windows باقی‌اند.
- همهٔ تغییرها در workspace باقی‌اند؛ هیچ commit، push یا انتشار عمومی انجام نشده است.

## Windows runner follow-up

A one-command runner is now provided at `scripts/verify-windows-release.ps1`; it creates a temporary Python venv, runs the locked build/test steps, produces the Windows x64 installer and SHA-256, and saves a transcript. `.github/workflows/windows-installer.yml` now invokes the same script and uploads the log even when a run fails. This Linux workspace has no PowerShell, Windows runner, or CapCut session, so the runner and workflow have **not** been executed here. The Windows build and interactive smoke-test gate remains open; the script itself does not install or launch the app.
