export { default as CAPCUT_BRIDGE_WIN_PY } from '../../capcut-bridge-win.py?raw';
export { default as CAPCUT_BRIDGE_PY } from '../../capcut-bridge.py?raw';
export { default as CAPCUT_PLUGIN_WIN_PY } from '../../capcut-plugin-win.py?raw';



export const INPUT_CONTRACT_MD = `# CapCut Bridge Kit — Input Contract Specification

This document defines the strict JSON shapes required by \`replay\` and \`graphics\` commands.

## 1. Cuts Contract (\`cuts.json\`) for \`replay\`

Rebuilds an EDL into a clean CapCut project draft from scratch.

\`\`\`json
{
  "draft_name": "My_Edited_Video",
  "resolution": {
    "width": 1080,
    "height": 1920,
    "ratio": "9:16"
  },
  "fps": 30.0,
  "cuts": [
    {
      "source_path": "/Users/username/Movies/RawFootage/take1.mov",
      "start": 0.0,
      "duration": 2.85,
      "width": 1080,
      "height": 1920
    }
  ]
}
\`\`\`

## 2. Graphics Plan Contract (\`graphics-plan.json\`) for \`graphics\`

Places captions, hook cards, and overlays without wiping existing main video edits.

\`\`\`json
{
  "elements": [
    {
      "type": "text",
      "text": "STOP SCROLLING 🚨",
      "start": 0.0,
      "duration": 1.8,
      "style": "tiktok-raw",
      "color": "#ffffff",
      "font_size": 32.0,
      "position": { "x": 0.0, "y": -0.32 }
    }
  ]
}
\`\`\`
`;

export const TEXT_MATERIAL_JSON = `{
  "id": "TEXT_MAT_TEMPLATE_ID",
  "type": "text",
  "content": "<font color=\\"#ffffff\\">Default Caption</font>",
  "font_size": 28.0,
  "alignment": 1,
  "has_shadow": true,
  "shadow_alpha": 0.8,
  "shadow_color": "#000000",
  "shadow_distance": 5.0,
  "shadow_point": { "x": 0.0, "y": -1.0 },
  "shadow_smooth": 0.45,
  "border_width": 0.0,
  "border_color": "#000000",
  "style_name": "tiktok_raw",
  "typesetting": 0,
  "letter_spacing": 0.0,
  "line_spacing": 0.0
}`;

export const TEXT_SEGMENT_JSON = `{
  "id": "TEXT_SEG_TEMPLATE_ID",
  "material_id": "TEXT_MAT_TEMPLATE_ID",
  "render_index": 1000,
  "target_timerange": {
    "start": 0,
    "duration": 3000000
  },
  "source_timerange": {
    "start": 0,
    "duration": 3000000
  },
  "speed": 1.0,
  "volume": 1.0,
  "clip": {
    "scale": { "x": 1.0, "y": 1.0 },
    "transform": { "x": 0.0, "y": -0.32 },
    "rotation": 0.0
  },
  "extra_material_refs": []
}`;

export const TEXT_ANIMATIONS_JSON = `{
  "id": "ANIM_MAT_TEMPLATE_ID",
  "type": "material_animation",
  "animations": [
    {
      "id": "ANIM_IN_POP",
      "category_id": "text_in",
      "category_name": "In",
      "duration": 300000,
      "material_type": "text",
      "name": "Pop",
      "path": "",
      "request_id": "",
      "resource_id": "text_anim_pop_in",
      "start": 0
    }
  ]
}`;

export const SAMPLE_CUTS_JSON = `{
  "draft_name": "Product_Teaser_Final",
  "resolution": {
    "width": 1080,
    "height": 1920,
    "ratio": "9:16"
  },
  "fps": 30.0,
  "cuts": [
    {
      "source_path": "/Users/username/Movies/Takes/intro_hook.mov",
      "start": 0.0,
      "duration": 2.4,
      "width": 1080,
      "height": 1920
    },
    {
      "source_path": "/Users/username/Movies/Takes/demo_problem.mov",
      "start": 1.2,
      "duration": 3.6,
      "width": 1080,
      "height": 1920
    },
    {
      "source_path": "/Users/username/Movies/Takes/solution_reveal.mov",
      "start": 0.5,
      "duration": 4.1,
      "width": 1080,
      "height": 1920
    },
    {
      "source_path": "/Users/username/Movies/Takes/call_to_action.mov",
      "start": 0.0,
      "duration": 2.8,
      "width": 1080,
      "height": 1920
    }
  ]
}`;

export const SAMPLE_GRAPHICS_PLAN_JSON = `{
  "elements": [
    {
      "type": "text",
      "text": "THIS CHANGES EVERYTHING 🔥",
      "start": 0.2,
      "duration": 2.2,
      "style": "tiktok-raw",
      "color": "#ffffff",
      "font_size": 34.0,
      "position": { "x": 0.0, "y": -0.32 }
    },
    {
      "type": "text",
      "text": "Stop editing manually in 2026",
      "start": 2.5,
      "duration": 3.2,
      "style": "captions",
      "color": "#ffd700",
      "font_size": 26.0,
      "position": { "x": 0.0, "y": -0.35 }
    },
    {
      "type": "text",
      "text": "Full CapCut Bridge Active",
      "start": 6.0,
      "duration": 3.8,
      "style": "tiktok-raw",
      "color": "#00f0ff",
      "font_size": 30.0,
      "position": { "x": 0.0, "y": -0.32 }
    }
  ]
}`;

export const INSTALL_PLUGIN_WIN_BAT = `@echo off
TITLE CapCut Bridge Kit - Windows Plugin Installer
color 0A

echo =======================================================
echo   CapCut Bridge Kit - Windows Plugin & CLI Installer
echo =======================================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    pause
    exit /b 1
)

echo [1/4] Installing required packages (pyautogui, pillow, flask, requests)...
pip install pyautogui pillow flask requests pywin32

set INSTALL_DIR=%USERPROFILE%\\.capcut-bridge
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

copy /Y "capcut-bridge-win.py" "%INSTALL_DIR%\\capcut-bridge.py" >nul
copy /Y "capcut-plugin-win.py" "%INSTALL_DIR%\\capcut-plugin.py" >nul

echo @echo off > "%INSTALL_DIR%\\capcut-bridge.bat"
echo python "%INSTALL_DIR%\\capcut-bridge.py" %%* >> "%INSTALL_DIR%\\capcut-bridge.bat"

powershell -Command "[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';%INSTALL_DIR%', 'User')" >nul 2>&1

echo.
echo [SUCCESS] CapCut Bridge installed to %INSTALL_DIR%!
echo Run 'capcut-bridge ls' in any command prompt.
pause
`;

