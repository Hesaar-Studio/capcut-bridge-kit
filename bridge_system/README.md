# CapCut Bridge MCP

> **وضعیت فایل‌های قدیمی:** `electron_main.js`، `setup.bat`، `install.sh` و metadata این پوشه مربوط به prototype قدیمی‌اند؛ در مسیر بسته‌بندی فعلی استفاده نمی‌شوند. دو helper قدیمی غیرفعال‌اند و هیچ dependency نصب یا سرویسی اجرا نمی‌کنند. برای اپ desktop فعلی فقط از `package.json` و راهنمای ریشهٔ مخزن استفاده کنید. سورس daemon قدیمی صرفاً برای مرجع نگه داشته شده و آزمون زنده نشده است.

پل محلی این پوشه یک سرور MCP با ارتباط `stdio` است. نسخه‌ی فعلی ابزارهای زیر را به کلاینت‌های MCP سازگار (از جمله Claude Desktop و Cursor) می‌دهد:

- `capcut_status`: وضعیت قابل مشاهده‌ی محلی، شامل وجود پوشه‌ی پروژه‌ها و بررسی فرایند CapCut. این بررسی اتصال زنده به تایم‌لاین را اثبات نمی‌کند.
- `list_capcut_projects`: ابزار سازگاری قدیمی برای فهرست نام پوشه‌ها با پاسخ `{projects, count}`؛ اکنون از عملیات contract زیر استفاده می‌کند.
- `bridge_contract_list_projects`: فهرست تایپ‌شده و فقط‌خواندنی از draftهای حساب فعلی با metadata موجود در فایل روی دیسک. مسیر مطلق را برنمی‌گرداند، hidden/symlinkها را رد می‌کند و وضعیت بازبودن پروژه در CapCut را تشخیص نمی‌دهد. بخش `data` پاسخ شامل `projects`, `count`, و `source` است؛ هر خلاصه می‌تواند `name`, `modified_at`, `duration_seconds`, `media_count`, `video_count`, `audio_count`, `timeline_count`, `clip_count`, و `read_error` داشته باشد. خطای خواندن metadata، عملیات کل فهرست را متوقف نمی‌کند.
- `bridge_contract_get_capabilities`, `bridge_contract_get_capcut_surface_map`, `bridge_contract_inspect_project`, `bridge_contract_inspect_timeline`, `bridge_contract_inspect_media`, `bridge_contract_inspect_subtitles`, `bridge_contract_analyze_gaps`, `bridge_contract_analyze_duplicates`, و ابزارهای ساخت/اعتبارسنجی/پیش‌نمایش EditPlan از مرز provider-neutral عبور می‌کنند. نقشهٔ سطح‌های اتصال ده مسیر CapCut را با status/evidence و حدّ راستی‌آزمایی گزارش می‌کند؛ static و read-only است و هیچ probe یا درخواست خارجی اجرا نمی‌کند. `get_capabilities` همچنان فقط registry عملیات Bridge را توصیف می‌کند. اجرای EditPlan و تأیید اجرای آن `UNAVAILABLE` هستند؛ هیچ ویرایش زنده‌ای از این فهرست نتیجه نمی‌شود.
- `create_capcut_draft`: ساخت یک پروژه‌ی جدید از برش‌های فایل‌های ویدیویی محلی. پروژه‌ی هم‌نام بازنویسی نمی‌شود.

فرمان `replay` در هر دو CLI نیز پیش‌فرض فقط‌سازنده است. جایگزینی پروژه فقط با `--overwrite --confirm-name <نام دقیق پروژه>` انجام می‌شود؛ پروژه‌ی جدید در staging ساخته و JSON آن اعتبارسنجی می‌شود و backup پوشه‌ی قبلی کنار پروژه می‌ماند. ابزار MCP `create_capcut_draft` همچنان فقط پروژه‌ی تازه می‌سازد.
- `add_capcut_text`: افزودن یک قطعه‌ی متن به پروژه‌ی موجود.

ساخت و ویرایش پروژه با CLI فعلی روی فایل‌های پروژه انجام می‌شود. اگر CapCut باز باشد، عملیات نوشتن رد می‌شود؛ پل آن را نمی‌بندد یا دوباره راه‌اندازی نمی‌کند. readback فقط محتوای روی دیسک را تأیید می‌کند و ثابت نمی‌کند CapCut تغییر را بارگذاری، نمایش یا رندر کرده باشد. این پل هنوز کنترل کامل تایم‌لاین باز یا واردکردن زنده‌ی رسانه را فراهم نمی‌کند. Premiere و DaVinci Resolve فقط مرجع معماری هستند و هدف این adapter نیستند.

## راه‌اندازی MCP

### Claude Desktop

در فایل `%APPDATA%\Claude\claude_desktop_config.json`، مسیر نمونه‌ی زیر را با مسیر واقعی `bridge_server.py` در این پروژه جایگزین و تنظیم را با تنظیمات موجود ادغام کنید:

```json
{
  "mcpServers": {
    "capcut-bridge": {
      "command": "python",
      "args": ["C:\\path\\to\\capcut-bridge-kit\\bridge_system\\bridge_server.py", "--mcp"],
      "env": {"PYTHONIOENCODING": "utf-8"}
    }
  }
}
```

در macOS/Linux از `python3` و مسیر کامل همان فایل استفاده کنید. راه‌اندازی مجدد کلاینت MCP لازم است.

### Cursor

فایل `cursor_mcp_config.json` نمونه‌ی تنظیم است. `${workspaceFolder}` فقط وقتی کار می‌کند که کلاینت آن متغیر را پشتیبانی کند؛ در غیر این صورت مسیر کامل فایل را جایگزین کنید.

### اجرای دستی

```powershell
python bridge_server.py --mcp
```

سرور MCP از `stdout` فقط برای پیام‌های پروتکل استفاده می‌کند؛ گزارش‌ها به `stderr` می‌روند. برای این حالت به بسته‌ی Electron یا سرور HTTP نیازی نیست. اسکریپت CLI ویندوز از Python 3.11+ استفاده می‌کند. نسخه‌ی macOS نیز برای عملیات بومی به مجوزهای Accessibility و وابستگی‌های PyObjC نیاز دارد.

## دامنه‌ی HTTP

اجرای `python bridge_server.py --port 8766` سرور HTTP نمونه را اجرا می‌کند تا با REST کنترلر ویندوز CapCut روی پورت 8765 تداخل نداشته باشد. مسیر `/api/v1/sync` با پاسخ 501 اعلام می‌کند که همگام‌سازی تایم‌لاین پیاده‌سازی نشده است؛ `/api/v1/export-lut` یک LUT ساده‌ی کنتراست می‌سازد. این سرویس اتصال زنده به NLE فراهم نمی‌کند. برای عملیات واقعی پروژه از MCP stdio و CLI استفاده کنید.
