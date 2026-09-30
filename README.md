


🎬 CapCut Bridge Kit
AI → MCP → CapCut Desktop Bridge for Windows & macOS
<p align="center"> <strong>Connect AI-assisted editing workflows to CapCut Desktop through a local, safety-conscious bridge.</strong> </p>

<p align="center"> <img src="./assets/capcut-bridge-control-panel.png" alt="CapCut Bridge Kit Control Panel" width="1200" /> </p>

<p align="center"> <a href="https://github.com/Hesaar-Studio/capcut-bridge-kit"> <img src="https://img.shields.io/badge/CapCut-Bridge%20Kit-00E5B9?style=for-the-badge&logo=capcut&logoColor=black" alt="CapCut Bridge Kit" /> </a> <img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.11+" /> <img src="https://img.shields.io/badge/Windows-%26-macOS-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows and macOS" /> <img src="https://img.shields.io/badge/MCP-Local%20stdio-8A2BE2?style=for-the-badge" alt="MCP" /> <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" /> <img src="https://img.shields.io/badge/Status-In%20Development-orange?style=for-the-badge" alt="In Development" /> </p>

<p align="center"> 🇬🇧 <a href="#-english">English</a> &nbsp;•&nbsp; 🇮🇷 <a href="#-فارسی">فارسی</a> &nbsp;•&nbsp; 🇨🇳 <a href="#-中文">中文</a> </p>

🇬🇧 English
📖 Overview
CapCut Bridge Kit is an open-source project for connecting AI-assisted editing workflows and local developer tools to CapCut Desktop on Windows and macOS.

The project provides:

Local Python bridge tools

MCP integration

Project-file operations

Windows desktop automation

macOS desktop automation

Local REST services

CLI workflows

Editing prompt resources

Experimental timeline/project manipulation

The architecture intentionally separates file-based operations from live desktop automation.

⚠️ CapCut does not provide a stable, official public API for all of the operations this project explores. Some functionality therefore depends on CapCut's local project structure, application version, and desktop behavior.

Always back up important CapCut projects before allowing automated file modifications.

🎯 Project Goal
The goal is to create a practical bridge between:

AI tools
   ↓
MCP / Local Automation
   ↓
CapCut Bridge Kit
   ↓
CapCut Desktop
   ↓
Video Editing Workflow
The project is intended to make AI-assisted editing workflows more reproducible, scriptable, inspectable, and easier to extend.

It is not intended to claim that CapCut has an official public automation API.

✨ Key Features
🤖 Local MCP Integration
The project includes local MCP functionality designed to expose implemented bridge capabilities to compatible AI/developer tools.

Current capabilities may include:

Project discovery

Local status inspection

Project creation workflows

Text insertion

File-based editing operations

Local bridge communication

MCP currently does not provide unrestricted control over every operation in an already-open CapCut timeline.

🪟 Windows Automation
Windows support includes local automation through:

pyautogui

Win32 APIs

Local REST bridge

CapCut-specific Python scripts

Desktop keyboard automation

Example components:

capcut-bridge-win.py
capcut-plugin-win.py
install-plugin-win.bat
The Windows bridge is designed to remain local.

The controller binds to:

127.0.0.1
rather than exposing the service publicly.

🍏 macOS Automation
The macOS bridge uses Python tooling with:

uv

PyObjC

Quartz

Native macOS desktop interaction

Example:

uv run capcut-bridge.py ls
🏗️ Architecture
┌──────────────────────────────────────────────┐
│              AI / Developer Layer            │
│                                              │
│ Gemini • Claude • Cursor • Other AI Tools    │
└───────────────────────┬──────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────┐
│             CapCut Bridge Engine             │
│                                              │
│   ┌────────────────┐   ┌─────────────────┐  │
│   │   FILE LANE    │   │    LIVE LANE    │  │
│   │                │   │                 │  │
│   │ Project files  │   │ pyautogui       │  │
│   │ draft_content  │   │ PyObjC          │  │
│   │ assets         │   │ keyboard input  │  │
│   │ replay         │   │ desktop actions │  │
│   └────────────────┘   └─────────────────┘  │
└───────────────────────┬──────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────┐
│              CapCut Desktop                  │
│           Windows / macOS                    │
└──────────────────────────────────────────────┘
🛣️ Two-Lane Architecture
📁 File Lane
The File Lane works with local project data.

Conceptually:

CapCut Project
      ↓
Backup / Staging
      ↓
Project Data
      ↓
Modify / Generate
      ↓
Validate
      ↓
CapCut
Typical operations may include:

Creating a project from structured cut data

Adding text

Working with project assets

Preparing project data

Replaying an edit plan

The File Lane is the more deterministic side of the system, but it is still dependent on CapCut's project structure.

🖥️ Live Lane
The Live Lane communicates with the desktop application using local keyboard or accessibility-oriented automation.

Examples include:

Split        → Ctrl+B / Cmd+B
Play/Pause   → Space
Export       → Ctrl+E / Cmd+E
Dismiss      → Esc
Live actions are inherently more dependent on:

The active window

CapCut version

Window state

Focus

Desktop environment

Timing

Therefore, a live action should not automatically be treated as successfully completed merely because a keyboard shortcut was sent.

🔐 Safety & Verification
Safety is a core design principle of the project.

Project Replacement
The replay workflow does not silently replace an existing project.

A replacement requires explicit confirmation.

Example:

uv run capcut-bridge.py replay sample-cuts.json \
  --name MyViralVideo \
  --overwrite \
  --confirm-name MyViralVideo
The intended workflow is:

Request
  ↓
Create staging project
  ↓
Validate
  ↓
Backup existing project
  ↓
Explicit name confirmation
  ↓
Replace
This is designed to reduce accidental destruction of existing projects.

🧪 Verification Principle
The bridge distinguishes between:

Command Sent
and:

Action Verified
For example:

Export shortcut sent
        ≠
Export completed
Likewise:

Split shortcut sent
        ≠
Clip successfully split
Where reliable readback is available, the system should verify the resulting project state.

Where verification is unavailable, the response should explicitly state that completion was not verified.

🔌 MCP
The project uses a local MCP architecture.

Conceptually:

AI Client
   │
   │ MCP / stdio
   ▼
CapCut Bridge
   │
   ├── File operations
   ├── Project operations
   ├── Local automation
   └── Desktop bridge
The MCP layer is intended to keep AI interaction structured rather than exposing arbitrary shell execution.

Current limitation
MCP does not currently represent unrestricted live control over every element of an open CapCut timeline.

📡 Local REST API
The Windows bridge exposes a local REST service.

Default address:

http://127.0.0.1:8765
The service is intentionally local.

Example endpoints
Method	Endpoint	Purpose
GET	/api/v1/status	Local CapCut/process status
GET	/api/v1/drafts	List local projects
POST	/api/v1/split	Send split action
POST	/api/v1/export	Send export action
POST	/api/v1/play	Play / pause action
Verification note
Some desktop operations only confirm that an action was dispatched.

They do not necessarily prove that CapCut completed the action.

🛡️ Local Security Boundary
The bridge is intended for local use.

The default architecture uses:

127.0.0.1
and restricts browser origins to allowed local origins.

Do not expose the local controller directly to the public Internet.

Native local clients may not have full application-level authentication, so network exposure is not an intended deployment model.

🚀 Quick Start
Windows
Install dependencies
pip install pyautogui pillow flask requests pywin32
Start the local bridge
python capcut-plugin-win.py
List projects
python capcut-bridge-win.py ls
macOS
Install uv if required:

curl -LsSf https://astral.sh/uv/install.sh | sh
List CapCut projects:

uv run capcut-bridge.py ls
Replay a cut list:

uv run capcut-bridge.py replay sample-cuts.json --name MyViralVideo
💻 CLI Examples
1. List Projects
Windows
python capcut-bridge-win.py ls
macOS
uv run capcut-bridge.py ls
2. Replay EDL Cuts
python capcut-bridge-win.py replay sample-cuts.json \
  --name "Podcast_Highlight_01"
For an explicit replacement:

python capcut-bridge-win.py replay sample-cuts.json `
  --name "Podcast_Highlight_01" `
  --overwrite `
  --confirm-name "Podcast_Highlight_01"
3. Add Text
python capcut-bridge-win.py add-text \
  "Podcast_Highlight_01" \
  "Your text here" \
  --at 1.2 \
  --dur 2.0
4. Add Overlay
python capcut-bridge-win.py add-overlay \
  "Podcast_Highlight_01" \
  broll.mp4 \
  --at 2.0 \
  --dur 3.5 \
  --layer 2
5. Transform Overlay
python capcut-bridge-win.py transform \
  "Podcast_Highlight_01" \
  --track overlay \
  --index 1 \
  --scale 1.15 \
  --y -0.1
🎨 Editing Prompt Library
The repository also contains resources for AI-assisted editing workflows.

Example topics include:

Professional lighting

Rembrandt lighting

Cyberpunk / neon looks

Golden-hour aesthetics

Speed-ramping

J-Cuts

Cinematic editing

Audio engineering

Safe zones

Viewer retention

Social-media editing

These resources are intended as editing guidance and prompt material rather than guarantees of automatic execution.

📚 Editing Workflow
A typical AI-assisted workflow can look like:

1. Import footage
        ↓
2. Analyze content
        ↓
3. Generate transcript / edit decisions
        ↓
4. Build structured cut list
        ↓
5. Review edit decisions
        ↓
6. Replay / assemble project
        ↓
7. Apply text / overlays / transforms
        ↓
8. Verify project state
        ↓
9. Open in CapCut
        ↓
10. Human review
        ↓
11. Export
The project intentionally keeps human review in the workflow.

📂 Repository Structure
capcut-bridge-kit/
│
├── .gitignore
├── LICENSE
├── README.md
│
├── install-plugin-win.bat
│
├── capcut-bridge-win.py
├── capcut-plugin-win.py
├── capcut-bridge.py
│
├── INPUT-CONTRACT.md
├── sample-cuts.json
├── sample-graphics-plan.json
│
├── package.json
├── vite.config.ts
│
└── src/
    ├── components/
    │   ├── CapCutStudio.tsx
    │   ├── PromptLibrary.tsx
    │   ├── EditingMastery.tsx
    │   ├── WindowsPluginGuide.tsx
    │   ├── CommandBuilder.tsx
    │   └── TimelineVisualizer.tsx
    │
    └── data/
        ├── editingPrompts.ts
        └── bridgeSource.ts
🧩 Project Status
Area	Status
Local project tooling	🟢 Implemented
Windows bridge	🟢 Implemented / evolving
macOS bridge	🟢 Implemented / evolving
Local REST service	🟢 Implemented
MCP integration	🟢 Implemented
Project-file workflows	🧪 Experimental
Live desktop automation	🧪 Experimental
Full open-timeline control	🚧 Not yet provided
AI editing orchestration	🚧 In development
Production-grade verification for every action	🚧 In development
Status labels describe the current project direction and should be updated as capabilities are tested and verified.

🗺️ Roadmap
Phase 1 — Bridge Foundation
Local Python bridge

Windows automation foundation

macOS automation foundation

Local REST service

MCP foundation

Project replay workflow

Phase 2 — Reliability
Safer project replacement

Staging before replacement

Backup workflow

Local-only network boundary

Action/readback distinction

Expanded automated verification

Broader live CapCut testing

Phase 3 — AI Editing
AI edit-plan generation

Structured edit orchestration

Transcript-driven cuts

Automated subtitle workflows

B-roll planning

Audio cleanup planning

Style-aware editing prompts

Phase 4 — Production Workflow
Job lifecycle

Queue management

Provider registry

Reliable export verification

Batch editing workflows

Production-grade desktop lifecycle management

Phase 5 — Ecosystem
Additional editing applications

More MCP integrations

Community plugins

Documentation expansion

Community-maintained adapters

🤝 Contributing
Contributions are welcome from:

Software developers

AI engineers

Video editors

Motion designers

Automation engineers

MCP developers

CapCut workflow researchers

Contribution Workflow
git clone https://github.com/Hesaar-Studio/capcut-bridge-kit.git

cd capcut-bridge-kit

git checkout -b feature/your-feature
Make your changes, test them, then:

git add .
git commit -m "Add your feature"
git push origin feature/your-feature
Open a Pull Request on GitHub.

🧪 Testing Philosophy
Before considering an automation feature reliable, test:

Does the command execute?

Does the expected project change occur?

Can the change be read back?

Does the behavior survive the target CapCut version?

Does failure produce an honest error?

Can the operation be safely repeated?

Can the original project be recovered?

A successful process exit is not automatically proof of a successful edit.

⚠️ Known Limitations
CapCut Desktop behavior can vary between versions.

Project-file automation may depend on:

Internal project structure

File locations

Application version

Media paths

Project state

Operating system

Window focus

Desktop automation may depend on:

Active window

Keyboard focus

Screen state

Window dimensions

Timing

Permissions

Therefore:

Always test automation on a copy of an important project first.

🔒 Security
Please do not expose the local bridge to the public Internet.

If you discover a security issue, please report it privately to the project maintainers before publishing a public exploit.

Do not include:

API keys

Authentication tokens

Personal credentials

Private project files

Private media

Machine-specific secrets

in issues or pull requests.

📜 License
This project is released under the MIT License.

See:

LICENSE
for the complete license text.

🏢 Maintainer
Hesaar Studio

GitHub:

https://github.com/Hesaar-Studio

Repository:

https://github.com/Hesaar-Studio/capcut-bridge-kit

⚖️ Disclaimer
CapCut is a product and trademark of ByteDance.

This project is an independent open-source project and is not presented as an official ByteDance product unless explicitly stated otherwise.

CapCut versions, project formats, desktop interfaces, and behavior may change.

❤️ Open Source
CapCut Bridge Kit is intended to grow as a community-driven bridge between:

AI
+
MCP
+
Automation
+
Video Editing
The project welcomes experimentation, testing, documentation, bug reports, and responsible contributions.

🇮🇷 فارسی
📖 معرفی
CapCut Bridge Kit یک پروژه متن‌باز برای ایجاد ارتباط میان گردش‌کارهای تدوین با کمک هوش مصنوعی، ابزارهای توسعه‌دهندگان و CapCut Desktop در ویندوز و macOS است.

این پروژه مجموعه‌ای از ابزارهای محلی Python، اتصال MCP، عملیات روی فایل پروژه، اتوماسیون دسکتاپ، REST محلی، دستورات CLI و منابع آموزشی تدوین را ارائه می‌کند.

معماری پروژه دو مسیر اصلی دارد:

هوش مصنوعی
   ↓
MCP / اتوماسیون محلی
   ↓
CapCut Bridge Kit
   ↓
CapCut Desktop
   ↓
گردش‌کار تدوین ویدیو
⚠️ CapCut برای همه عملیات مورد بررسی این پروژه یک API عمومی و پایدار ارائه نمی‌کند. بنابراین بخشی از قابلیت‌ها به ساختار فایل پروژه، نسخه CapCut و رفتار برنامه دسکتاپ وابسته است.

پیش از اجرای عملیات خودکار روی پروژه‌های مهم، حتماً از آن‌ها نسخه پشتیبان تهیه کنید.

🎯 هدف پروژه
هدف اصلی CapCut Bridge Kit ایجاد یک پل عملی میان ابزارهای هوش مصنوعی و CapCut Desktop است تا فرایندهای تدوین بتوانند:

ساختاریافته‌تر باشند

قابل اسکریپت‌نویسی باشند

قابل بررسی باشند

قابل تکرار باشند

از طریق MCP در اختیار ابزارهای هوش مصنوعی قرار بگیرند

به‌مرور قابل توسعه باشند

این پروژه ادعا نمی‌کند که CapCut یک API رسمی عمومی برای تمام عملیات اتوماسیون دارد.

✨ قابلیت‌های اصلی
🤖 اتصال محلی MCP
پروژه دارای معماری MCP محلی است که قابلیت‌های پیاده‌سازی‌شده Bridge را در اختیار ابزارهای سازگار قرار می‌دهد.

قابلیت‌های فعلی می‌توانند شامل موارد زیر باشند:

شناسایی پروژه‌ها

بررسی وضعیت محلی

ایجاد پروژه

افزودن متن

عملیات مبتنی بر فایل

ارتباط با Bridge محلی

در حال حاضر MCP کنترل نامحدود همه اجزای یک Timeline باز CapCut را ارائه نمی‌کند.

🪟 پشتیبانی Windows
نسخه Windows از ابزارهای محلی زیر استفاده می‌کند:

pyautogui

Win32 API

REST Bridge

اسکریپت‌های Python

اتوماسیون صفحه‌کلید

نمونه فایل‌ها:

capcut-bridge-win.py
capcut-plugin-win.py
install-plugin-win.bat
Bridge به‌صورت محلی اجرا می‌شود:

127.0.0.1
و نباید مستقیماً در اینترنت عمومی قرار گیرد.

🍏 پشتیبانی macOS
Bridge مک از ابزارهای زیر استفاده می‌کند:

uv

PyObjC

Quartz

کنترل محلی محیط دسکتاپ

نمونه:

uv run capcut-bridge.py ls
🏗️ معماری سیستم
┌──────────────────────────────────────────────┐
│              لایه هوش مصنوعی                 │
│                                              │
│ Gemini • Claude • Cursor • سایر ابزارها      │
└───────────────────────┬──────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────┐
│             CapCut Bridge Engine             │
│                                              │
│   ┌────────────────┐   ┌─────────────────┐  │
│   │   FILE LANE    │   │    LIVE LANE    │  │
│   │                │   │                 │  │
│   │ فایل پروژه     │   │ pyautogui       │  │
│   │ draft_content  │   │ PyObjC          │  │
│   │ assets         │   │ keyboard       │  │
│   │ replay         │   │ desktop        │  │
│   └────────────────┘   └─────────────────┘  │
└───────────────────────┬──────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────┐
│               CapCut Desktop                 │
│              Windows / macOS                 │
└──────────────────────────────────────────────┘
🛣️ معماری دو مسیره
📁 File Lane
مسیر File Lane با داده‌های محلی پروژه کار می‌کند.

گردش‌کار کلی:

پروژه CapCut
     ↓
Backup / Staging
     ↓
داده پروژه
     ↓
تغییر / تولید
     ↓
اعتبارسنجی
     ↓
CapCut
این مسیر می‌تواند برای مواردی مانند موارد زیر استفاده شود:

ساخت پروژه از داده‌های ساختاریافته کات

افزودن متن

مدیریت داده‌های پروژه

آماده‌سازی اطلاعات پروژه

Replay کردن Edit Plan

🖥️ Live Lane
Live Lane با استفاده از اتوماسیون محلی دسکتاپ با برنامه تعامل می‌کند.

نمونه عملیات:

Split        → Ctrl+B / Cmd+B
Play/Pause   → Space
Export       → Ctrl+E / Cmd+E
Dismiss      → Esc
عملیات Live به عوامل زیر وابسته است:

پنجره فعال

نسخه CapCut

Focus

وضعیت دسکتاپ

Timing

مجوزهای سیستم

بنابراین ارسال یک Shortcut به‌تنهایی به معنی موفقیت قطعی عملیات نیست.

🔐 ایمنی و اعتبارسنجی
یکی از اصول مهم پروژه تفاوت میان:

Command Sent
و:

Action Verified
است.

برای مثال:

ارسال فرمان Export
        ≠
تکمیل Export
و:

ارسال فرمان Split
        ≠
Split موفق کلیپ
هرجا امکان Readback وجود داشته باشد، وضعیت واقعی پروژه باید بررسی شود.

اگر امکان اعتبارسنجی وجود نداشته باشد، سیستم باید صریحاً اعلام کند که نتیجه تأیید نشده است.

🛡️ ایمنی Replay
فرایند replay نباید پروژه موجود را بدون تأیید صریح جایگزین کند.

نمونه:

uv run capcut-bridge.py replay sample-cuts.json \
  --name MyViralVideo \
  --overwrite \
  --confirm-name MyViralVideo
گردش‌کار پیشنهادی:

Request
  ↓
Staging
  ↓
Validation
  ↓
Backup
  ↓
تأیید صریح نام
  ↓
Replacement
🔌 MCP
معماری MCP به‌صورت محلی طراحی شده است:

AI Client
   │
   │ MCP / stdio
   ▼
CapCut Bridge
   │
   ├── File Operations
   ├── Project Operations
   ├── Local Automation
   └── Desktop Bridge
در وضعیت فعلی، MCP کنترل کامل و نامحدود Timeline باز CapCut را ارائه نمی‌کند.

📡 REST API
REST Controller ویندوز به‌صورت محلی روی:

http://127.0.0.1:8765
اجرا می‌شود.

نمونه Endpointها:

Method	Endpoint	عملکرد
GET	/api/v1/status	وضعیت CapCut و سرویس محلی
GET	/api/v1/drafts	فهرست پروژه‌های محلی
POST	/api/v1/split	ارسال فرمان Split
POST	/api/v1/export	ارسال فرمان Export
POST	/api/v1/play	Play / Pause
برخی عملیات فقط ارسال فرمان را تأیید می‌کنند و تکمیل واقعی عملیات را اثبات نمی‌کنند.

🚀 نصب سریع
Windows
pip install pyautogui pillow flask requests pywin32
اجرای Bridge:

python capcut-plugin-win.py
فهرست پروژه‌ها:

python capcut-bridge-win.py ls
macOS
نصب uv در صورت نیاز:

curl -LsSf https://astral.sh/uv/install.sh | sh
فهرست پروژه‌ها:

uv run capcut-bridge.py ls
Replay:

uv run capcut-bridge.py replay sample-cuts.json --name MyViralVideo
💻 نمونه دستورات CLI
فهرست پروژه‌ها
python capcut-bridge-win.py ls
یا:

uv run capcut-bridge.py ls
ساخت پروژه از Cut List
python capcut-bridge-win.py replay sample-cuts.json `
  --name "Podcast_Highlight_01"
جایگزینی ایمن
python capcut-bridge-win.py replay sample-cuts.json `
  --name "Podcast_Highlight_01" `
  --overwrite `
  --confirm-name "Podcast_Highlight_01"
افزودن متن
python capcut-bridge-win.py add-text \
  "Podcast_Highlight_01" \
  "Your text here" \
  --at 1.2 \
  --dur 2.0
افزودن Overlay
python capcut-bridge-win.py add-overlay \
  "Podcast_Highlight_01" \
  broll.mp4 \
  --at 2.0 \
  --dur 3.5 \
  --layer 2
Transform
python capcut-bridge-win.py transform \
  "Podcast_Highlight_01" \
  --track overlay \
  --index 1 \
  --scale 1.15 \
  --y -0.1
🎨 کتابخانه پرامپت‌های تدوین
پروژه شامل منابعی برای گردش‌کارهای تدوین با کمک هوش مصنوعی است.

موضوعات شامل:

نورپردازی حرفه‌ای

نورپردازی Rembrandt

استایل Neon / Cyberpunk

Golden Hour

Speed Ramp

J-Cut

تدوین سینمایی

مهندسی صدا

Safe Zones

حفظ مخاطب

تدوین برای شبکه‌های اجتماعی

این منابع به‌عنوان راهنمای تدوین و Prompt Library ارائه می‌شوند و تضمین اجرای خودکار همه موارد نیستند.

📚 گردش‌کار پیشنهادی
1. ورود ویدیو
      ↓
2. تحلیل محتوا
      ↓
3. تولید Transcript / Edit Decisions
      ↓
4. ساخت Cut List
      ↓
5. بررسی تصمیم‌های تدوین
      ↓
6. Replay / Assemble
      ↓
7. افزودن متن و Overlay
      ↓
8. Verification
      ↓
9. باز کردن در CapCut
      ↓
10. بررسی انسانی
      ↓
11. Export
هدف پروژه حذف کامل بررسی انسانی نیست؛ بلکه ساختن یک Workflow قابل تکرار و قابل کنترل است.

📂 ساختار Repository
capcut-bridge-kit/
│
├── .gitignore
├── LICENSE
├── README.md
│
├── install-plugin-win.bat
├── capcut-bridge-win.py
├── capcut-plugin-win.py
├── capcut-bridge.py
│
├── INPUT-CONTRACT.md
├── sample-cuts.json
├── sample-graphics-plan.json
│
├── package.json
├── vite.config.ts
│
└── src/
    ├── components/
    │   ├── CapCutStudio.tsx
    │   ├── PromptLibrary.tsx
    │   ├── EditingMastery.tsx
    │   ├── WindowsPluginGuide.tsx
    │   ├── CommandBuilder.tsx
    │   └── TimelineVisualizer.tsx
    │
    └── data/
        ├── editingPrompts.ts
        └── bridgeSource.ts
🧩 وضعیت پروژه
بخش	وضعیت
Local Project Tooling	🟢 پیاده‌سازی شده
Windows Bridge	🟢 پیاده‌سازی شده / در حال توسعه
macOS Bridge	🟢 پیاده‌سازی شده / در حال توسعه
Local REST	🟢 پیاده‌سازی شده
MCP	🟢 پیاده‌سازی شده
Project File Workflows	🧪 آزمایشی
Live Desktop Automation	🧪 آزمایشی
Full Open Timeline Control	🚧 هنوز ارائه نشده
AI Editing Orchestration	🚧 در حال توسعه
Production Verification	🚧 در حال توسعه
🗺️ نقشه راه
Phase 1 — Foundation
Local Python Bridge

Windows Automation

macOS Automation

Local REST

MCP Foundation

Project Replay

Phase 2 — Reliability
Safe Project Replacement

Staging

Backup

Local Network Boundary

Action / Verification Separation

Expanded Readback

More Live CapCut Testing

Phase 3 — AI Editing
AI Edit Plan

Structured Editing Orchestration

Transcript-driven Cuts

Subtitle Automation

B-roll Planning

Audio Cleanup Planning

Style-aware Editing Prompts

Phase 4 — Production
Job Lifecycle

Queue Management

Provider Registry

Export Verification

Batch Editing

Production-grade Desktop Lifecycle

Phase 5 — Ecosystem
Additional Editors

Additional MCP Integrations

Community Plugins

Expanded Documentation

Community-maintained Adapters

🤝 مشارکت
از مشارکت توسعه‌دهندگان، مهندسان AI، تدوینگران، طراحان Motion، مهندسان Automation و توسعه‌دهندگان MCP استقبال می‌شود.

git clone https://github.com/Hesaar-Studio/capcut-bridge-kit.git

cd capcut-bridge-kit

git checkout -b feature/your-feature
پس از تغییرات:

git add .
git commit -m "Add your feature"
git push origin feature/your-feature
سپس Pull Request ایجاد کنید.

🧪 فلسفه تست
قبل از اینکه یک قابلیت Automation قابل اعتماد تلقی شود، باید بررسی شود:

آیا فرمان اجرا شد؟

آیا تغییر مورد انتظار در پروژه اتفاق افتاد؟

آیا تغییر قابل Readback است؟

آیا روی نسخه هدف CapCut آزمایش شده؟

آیا خطا به شکل صحیح گزارش می‌شود؟

آیا اجرای دوباره امن است؟

آیا امکان بازیابی پروژه اصلی وجود دارد؟

موفقیت Process به‌تنهایی به معنی موفقیت Edit نیست.

⚠️ محدودیت‌های شناخته‌شده
رفتار CapCut ممکن است بین نسخه‌های مختلف تغییر کند.

اتوماسیون فایل پروژه ممکن است به موارد زیر وابسته باشد:

ساختار داخلی پروژه

محل فایل‌ها

نسخه CapCut

مسیر Media

وضعیت پروژه

سیستم‌عامل

وضعیت برنامه

اتوماسیون دسکتاپ نیز می‌تواند به موارد زیر وابسته باشد:

پنجره فعال

Focus

ابعاد پنجره

وضعیت صفحه

Timing

مجوزهای سیستم

بنابراین:

همیشه ابتدا روی یک Copy از پروژه مهم خود آزمایش کنید.

🔒 امنیت
Bridge برای استفاده محلی طراحی شده است.

لطفاً موارد زیر را در Repository یا Issueها قرار ندهید:

API Keys

Tokens

Passwords

Credentials

فایل‌های خصوصی پروژه

Media خصوصی

Secrets مربوط به سیستم

Bridge محلی را مستقیماً در اینترنت عمومی قرار ندهید.

📜 مجوز
این پروژه تحت مجوز MIT License منتشر می‌شود.

فایل کامل مجوز:

LICENSE
🏢 نگهدارنده پروژه
Hesaar Studio

GitHub:

https://github.com/Hesaar-Studio

Repository:

https://github.com/Hesaar-Studio/capcut-bridge-kit

⚖️ Disclaimer
CapCut محصول و علامت تجاری ByteDance است.

CapCut Bridge Kit یک پروژه مستقل Open Source است و به‌عنوان محصول رسمی ByteDance معرفی نمی‌شود.

ساختار پروژه، رابط دسکتاپ و رفتار CapCut ممکن است در نسخه‌های آینده تغییر کند.

❤️ Open Source
CapCut Bridge Kit با هدف ایجاد یک پل متن‌باز میان:

AI
+
MCP
+
Automation
+
Video Editing
ساخته می‌شود.

از تست، مستندسازی، گزارش خطا، پیشنهاد قابلیت و مشارکت مسئولانه استقبال می‌شود.

🇨🇳 中文
📖 项目简介
CapCut Bridge Kit 是一个开源项目，旨在将 AI 辅助视频编辑工作流、开发者工具与 CapCut Desktop 连接起来。

项目面向：

Windows

macOS

并提供：

本地 Python Bridge

MCP 集成

项目文件操作

桌面自动化

本地 REST 服务

CLI 工作流

AI 编辑 Prompt 资源

实验性项目/时间线操作

整体工作流：

AI 工具
   ↓
MCP / 本地自动化
   ↓
CapCut Bridge Kit
   ↓
CapCut Desktop
   ↓
视频编辑工作流
⚠️ CapCut 并没有为本项目涉及的所有操作提供稳定、公开的官方 API。因此，部分功能依赖 CapCut 的项目文件结构、软件版本以及桌面端行为。

在处理重要项目之前，请始终创建备份。

🎯 项目目标
CapCut Bridge Kit 的目标是建立一个实用的 AI → CapCut 桥接层，使视频编辑流程更加：

可重复

可脚本化

可检查

可扩展

可通过 MCP 与 AI 工具连接

本项目不会声称 CapCut 为所有自动化功能提供官方公共 API。

✨ 核心功能
🤖 本地 MCP
项目提供本地 MCP 架构，用于将已经实现的 Bridge 功能提供给兼容的 AI / Developer 工具。

当前能力可能包括：

项目发现

本地状态检查

项目创建

文本添加

基于文件的编辑操作

本地 Bridge 通信

目前 MCP 并不提供对已打开 CapCut 时间线的无限制完整控制。

🪟 Windows
Windows Bridge 使用：

pyautogui

Win32 API

本地 REST Bridge

Python 脚本

桌面键盘自动化

主要文件：

capcut-bridge-win.py
capcut-plugin-win.py
install-plugin-win.bat
Bridge 默认使用本地地址：

127.0.0.1
不建议将其直接暴露到公网。

🍏 macOS
macOS Bridge 使用：

uv

PyObjC

Quartz

macOS 本地桌面控制

示例：

uv run capcut-bridge.py ls
🏗️ 系统架构
┌──────────────────────────────────────────────┐
│                  AI 层                       │
│                                              │
│ Gemini • Claude • Cursor • Other AI Tools    │
└───────────────────────┬──────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────┐
│             CapCut Bridge Engine             │
│                                              │
│   ┌────────────────┐   ┌─────────────────┐  │
│   │   FILE LANE    │   │    LIVE LANE    │  │
│   │                │   │                 │  │
│   │ 项目文件       │   │ pyautogui       │  │
│   │ draft_content  │   │ PyObjC          │  │
│   │ assets         │   │ keyboard        │  │
│   │ replay         │   │ desktop         │  │
│   └────────────────┘   └─────────────────┘  │
└───────────────────────┬──────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────┐
│              CapCut Desktop                  │
│              Windows / macOS                 │
└──────────────────────────────────────────────┘
🛣️ 双通道架构
📁 File Lane
File Lane 主要处理本地项目数据。

典型流程：

CapCut 项目
    ↓
Backup / Staging
    ↓
项目数据
    ↓
修改 / 生成
    ↓
验证
    ↓
CapCut
可以用于：

从结构化 Cut List 创建项目

添加文本

处理项目资源

准备项目数据

Replay 编辑计划

🖥️ Live Lane
Live Lane 通过本地桌面自动化与 CapCut 进行交互。

例如：

Split        → Ctrl+B / Cmd+B
Play/Pause   → Space
Export       → Ctrl+E / Cmd+E
Dismiss      → Esc
Live 操作可能受到以下因素影响：

当前窗口

CapCut 版本

Focus

桌面状态

Timing

系统权限

因此：

发送快捷键
    ≠
操作已经成功完成
🔐 安全与验证
项目的重要原则是区分：

Command Sent
和：

Action Verified
例如：

发送 Export 命令
       ≠
Export 已完成
以及：

发送 Split 命令
       ≠
剪辑已经成功 Split
如果可以读取项目状态，应进行 Readback 验证。

如果无法验证，则必须明确说明结果没有得到确认。

🛡️ Replay 安全
replay 不应该在没有明确确认的情况下覆盖已有项目。

示例：

uv run capcut-bridge.py replay sample-cuts.json \
  --name MyViralVideo \
  --overwrite \
  --confirm-name MyViralVideo
设计流程：

Request
  ↓
Staging
  ↓
Validation
  ↓
Backup
  ↓
明确确认项目名称
  ↓
Replacement
🔌 MCP
MCP 架构：

AI Client
   │
   │ MCP / stdio
   ▼
CapCut Bridge
   │
   ├── File Operations
   ├── Project Operations
   ├── Local Automation
   └── Desktop Bridge
当前版本并不提供对打开的 CapCut Timeline 的无限制完整控制。

📡 本地 REST API
Windows Controller 默认运行于：

http://127.0.0.1:8765
示例 Endpoint：

Method	Endpoint	功能
GET	/api/v1/status	CapCut / 本地服务状态
GET	/api/v1/drafts	本地项目列表
POST	/api/v1/split	发送 Split 操作
POST	/api/v1/export	发送 Export 操作
POST	/api/v1/play	Play / Pause
部分接口只能确认命令已经发送，而不能证明 CapCut 已经完成操作。

🚀 快速安装
Windows
安装依赖：

pip install pyautogui pillow flask requests pywin32
启动 Bridge：

python capcut-plugin-win.py
查看项目：

python capcut-bridge-win.py ls
macOS
如果尚未安装 uv：

curl -LsSf https://astral.sh/uv/install.sh | sh
查看项目：

uv run capcut-bridge.py ls
Replay：

uv run capcut-bridge.py replay sample-cuts.json --name MyViralVideo
💻 CLI 示例
查看项目
python capcut-bridge-win.py ls
或者：

uv run capcut-bridge.py ls
Replay Cut List
python capcut-bridge-win.py replay sample-cuts.json `
  --name "Podcast_Highlight_01"
安全替换
python capcut-bridge-win.py replay sample-cuts.json `
  --name "Podcast_Highlight_01" `
  --overwrite `
  --confirm-name "Podcast_Highlight_01"
添加文本
python capcut-bridge-win.py add-text \
  "Podcast_Highlight_01" \
  "Your text here" \
  --at 1.2 \
  --dur 2.0
添加 Overlay
python capcut-bridge-win.py add-overlay \
  "Podcast_Highlight_01" \
  broll.mp4 \
  --at 2.0 \
  --dur 3.5 \
  --layer 2
Transform
python capcut-bridge-win.py transform \
  "Podcast_Highlight_01" \
  --track overlay \
  --index 1 \
  --scale 1.15 \
  --y -0.1
🎨 AI 编辑 Prompt Library
项目还包含 AI 辅助视频编辑工作流相关资源。

主题包括：

专业灯光

Rembrandt Lighting

Neon / Cyberpunk

Golden Hour

Speed Ramp

J-Cut

Cinematic Editing

Audio Engineering

Safe Zones

Audience Retention

Social Media Editing

这些资源主要用于编辑指导和 Prompt 工作流，不代表所有效果都可以自动执行。

📚 推荐工作流
1. 导入视频
      ↓
2. 内容分析
      ↓
3. Transcript / Edit Decisions
      ↓
4. 创建 Cut List
      ↓
5. 审核编辑决策
      ↓
6. Replay / Assemble
      ↓
7. 添加文字 / Overlay
      ↓
8. Verification
      ↓
9. 在 CapCut 中打开
      ↓
10. 人工检查
      ↓
11. Export
项目的目标不是完全取消人工检查，而是让编辑工作流更加结构化、可重复和可控制。

📂 Repository Structure
capcut-bridge-kit/
│
├── .gitignore
├── LICENSE
├── README.md
│
├── install-plugin-win.bat
├── capcut-bridge-win.py
├── capcut-plugin-win.py
├── capcut-bridge.py
│
├── INPUT-CONTRACT.md
├── sample-cuts.json
├── sample-graphics-plan.json
│
├── package.json
├── vite.config.ts
│
└── src/
    ├── components/
    │   ├── CapCutStudio.tsx
    │   ├── PromptLibrary.tsx
    │   ├── EditingMastery.tsx
    │   ├── WindowsPluginGuide.tsx
    │   ├── CommandBuilder.tsx
    │   └── TimelineVisualizer.tsx
    │
    └── data/
        ├── editingPrompts.ts
        └── bridgeSource.ts
🧩 项目状态
模块	状态
Local Project Tooling	🟢 已实现
Windows Bridge	🟢 已实现 / 持续开发
macOS Bridge	🟢 已实现 / 持续开发
Local REST	🟢 已实现
MCP	🟢 已实现
Project File Workflows	🧪 实验性
Live Desktop Automation	🧪 实验性
Full Open Timeline Control	🚧 尚未提供
AI Editing Orchestration	🚧 开发中
Production Verification	🚧 开发中
🗺️ Roadmap
Phase 1 — Foundation
Local Python Bridge

Windows Automation

macOS Automation

Local REST

MCP Foundation

Project Replay

Phase 2 — Reliability
Safe Project Replacement

Staging

Backup

Local Network Boundary

Action / Verification Separation

Expanded Readback

More Live CapCut Testing

Phase 3 — AI Editing
AI Edit Plan

Structured Editing Orchestration

Transcript-driven Cuts

Subtitle Automation

B-roll Planning

Audio Cleanup Planning

Style-aware Editing Prompts

Phase 4 — Production
Job Lifecycle

Queue Management

Provider Registry

Export Verification

Batch Editing

Production-grade Desktop Lifecycle

Phase 5 — Ecosystem
Additional Editors

Additional MCP Integrations

Community Plugins

Expanded Documentation

Community-maintained Adapters

🤝 贡献
欢迎以下领域的开发者和创作者参与：

软件开发

AI Engineering

视频编辑

Motion Design

Automation

MCP Development

CapCut Workflow Research

创建分支：

git checkout -b feature/your-feature
提交：

git add .
git commit -m "Add your feature"
git push origin feature/your-feature
然后创建 Pull Request。

🧪 测试原则
一个自动化功能在被认为可靠之前，应至少检查：

命令是否执行？

项目是否发生预期变化？

是否可以 Readback？

是否在目标 CapCut 版本上测试？

错误是否被正确报告？

重复执行是否安全？

原始项目是否可以恢复？

Process 成功退出并不等于 Edit 成功。

⚠️ 已知限制
CapCut 不同版本之间的行为可能不同。

项目文件自动化可能依赖：

内部项目结构

文件位置

CapCut 版本

Media 路径

项目状态

操作系统

应用状态

桌面自动化可能依赖：

当前窗口

Focus

窗口尺寸

屏幕状态

Timing

系统权限

因此：

对重要项目进行自动化操作之前，请先在项目副本上测试。

🔒 安全
Bridge 面向本地使用。

请不要在 GitHub Repository、Issue 或 Pull Request 中提交：

API Keys

Tokens

Passwords

Credentials

私有项目文件

私有媒体

系统 Secrets

不要将本地 Bridge 直接暴露到公网。

📜 License
本项目采用 MIT License。

完整许可证：

LICENSE
🏢 Maintainer
Hesaar Studio

GitHub:

https://github.com/Hesaar-Studio

Repository:

https://github.com/Hesaar-Studio/capcut-bridge-kit

⚖️ Disclaimer
CapCut 是 ByteDance 的产品和商标。

CapCut Bridge Kit 是独立的开源项目，不代表 ByteDance 官方产品。

CapCut 的项目结构、桌面界面和行为可能随版本更新而变化。

❤️ Open Source
CapCut Bridge Kit 希望逐步建立一个开放的：

AI
+
MCP
+
Automation
+
Video Editing
生态。

欢迎测试、文档贡献、Bug Report、功能建议以及负责任的代码贡献。

🌍 Language Versions
🇬🇧 English — README.md

🇮🇷 فارسی — README.fa.md

🇨🇳 中文 — README.zh-CN.md
