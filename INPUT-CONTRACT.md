# CapCut Bridge Kit — Input Contract Specification

This document defines the strict JSON shapes required by `replay` and `graphics` commands.

---

## 1. Cuts Contract (`cuts.json`) for `replay`

Used by `replay <job> [--name <draft>]` to rebuild an EDL into a clean CapCut project draft from scratch.

### Schema

```json
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
    },
    {
      "source_path": "/Users/username/Movies/RawFootage/take2.mov",
      "start": 5.4,
      "duration": 3.12,
      "width": 1080,
      "height": 1920
    }
  ]
}
```

### Fields

- `draft_name` *(string, optional)*: Name of the draft folder created under `~/Movies/CapCut/User Data/Projects/com.lveditor.draft/<name>/`.
- `resolution` *(object, optional)*: Canvas width, height, and aspect ratio. Default is `1080x1920` (`9:16`).
- `fps` *(float, optional)*: Timeline frame rate. Default `30.0`.
- `cuts` *(array of objects, required)*:
  - `source_path` *(string)*: Absolute path to the source video file. **Must live under `~/Movies`** or will be hardlinked into the draft's `Resources/` folder.
  - `start` *(float, seconds)*: In-point cut timestamp in the source footage.
  - `duration` *(float, seconds)*: Duration of this cut on the timeline.
  - `width` / `height` *(int, optional)*: Source dimensions.

---

## 2. Graphics Plan Contract (`graphics-plan.json`) for `graphics`

Used by `graphics <draft> <job>` to batch-place captions, hook cards, stickers, and sound fx without wiping existing main video edits.

### Schema

```json
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
    },
    {
      "type": "text",
      "text": "Here is why your workflow is slow:",
      "start": 1.8,
      "duration": 2.5,
      "style": "captions",
      "color": "#ffd700",
      "font_size": 24.0,
      "position": { "x": 0.0, "y": -0.35 }
    },
    {
      "type": "overlay",
      "source_path": "/Users/username/Movies/Graphics/arrow.mov",
      "start": 1.8,
      "duration": 1.5,
      "layer": 1,
      "mute": true
    }
  ]
}
```

### Hard Rules Compliance
1. Every text element's segment is written with `source_timerange: { start: 0, duration: <dur_us> }` to avoid encoder crashes on export.
2. Overlay footage paths are automatically hardlinked to `Resources/`.
3. Native `Timelines/` cache is erased prior to disk write.
