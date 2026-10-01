"""
Draft Engine Data Models
========================
Structured representation of CapCut Desktop draft components.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class TimeRange:
    """Represents a time range in microseconds (us)."""
    start: int = 0
    duration: int = 0

    @classmethod
    def from_seconds(cls, start_sec: float, duration_sec: float) -> TimeRange:
        return cls(
            start=int(round(start_sec * 1_000_000)),
            duration=int(round(duration_sec * 1_000_000)),
        )

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]) -> Optional[TimeRange]:
        if not data or not isinstance(data, dict):
            return None
        return cls(
            start=int(data.get("start", 0)),
            duration=int(data.get("duration", 0)),
        )

    def to_dict(self) -> Dict[str, int]:
        return {
            "start": self.start,
            "duration": self.duration,
        }

    @property
    def start_sec(self) -> float:
        return self.start / 1_000_000.0

    @property
    def duration_sec(self) -> float:
        return self.duration / 1_000_000.0

    @property
    def end(self) -> int:
        return self.start + self.duration

    @property
    def end_sec(self) -> float:
        return self.end / 1_000_000.0


@dataclass
class VideoMaterial:
    id: str
    path: str
    duration: int
    width: int = 1080
    height: int = 1920
    material_name: str = ""
    extra: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> VideoMaterial:
        mat_id = str(data.get("id", ""))
        path = str(data.get("path", ""))
        duration = int(data.get("duration", 0))
        width = int(data.get("width", 1080))
        height = int(data.get("height", 1920))
        name = str(data.get("material_name", ""))
        extra = {k: v for k, v in data.items() if k not in {"id", "path", "duration", "width", "height", "material_name"}}
        return cls(id=mat_id, path=path, duration=duration, width=width, height=height, material_name=name, extra=extra)

    def to_dict(self) -> Dict[str, Any]:
        base = {
            "id": self.id,
            "type": "video",
            "path": self.path,
            "duration": self.duration,
            "width": self.width,
            "height": self.height,
            "material_name": self.material_name or self.path.split("/")[-1].split("\\")[-1],
        }
        base.update(self.extra)
        return base


@dataclass
class AudioMaterial:
    id: str
    path: str
    duration: int
    material_name: str = ""
    extra: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> AudioMaterial:
        mat_id = str(data.get("id", ""))
        path = str(data.get("path", ""))
        duration = int(data.get("duration", 0))
        name = str(data.get("material_name", ""))
        extra = {k: v for k, v in data.items() if k not in {"id", "path", "duration", "material_name"}}
        return cls(id=mat_id, path=path, duration=duration, material_name=name, extra=extra)

    def to_dict(self) -> Dict[str, Any]:
        base = {
            "id": self.id,
            "type": "audio",
            "path": self.path,
            "duration": self.duration,
            "material_name": self.material_name or self.path.split("/")[-1].split("\\")[-1],
        }
        base.update(self.extra)
        return base


@dataclass
class TextMaterial:
    id: str
    content: str
    font_size: float = 28.0
    extra: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> TextMaterial:
        mat_id = str(data.get("id", ""))
        content = str(data.get("content", ""))
        font_size = float(data.get("font_size", 28.0))
        extra = {k: v for k, v in data.items() if k not in {"id", "content", "font_size"}}
        return cls(id=mat_id, content=content, font_size=font_size, extra=extra)

    def to_dict(self) -> Dict[str, Any]:
        base = {
            "id": self.id,
            "type": "text",
            "content": self.content,
            "font_size": self.font_size,
        }
        base.update(self.extra)
        return base


@dataclass
class Segment:
    id: str
    material_id: str
    target_timerange: TimeRange
    source_timerange: TimeRange
    render_index: int = 0
    speed: float = 1.0
    volume: float = 1.0
    extra_material_refs: List[str] = field(default_factory=list)
    extra: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Segment:
        seg_id = str(data.get("id", ""))
        mat_id = str(data.get("material_id", ""))
        render_index = int(data.get("render_index", 0))
        speed = float(data.get("speed", 1.0))
        volume = float(data.get("volume", 1.0))
        extra_refs = list(data.get("extra_material_refs", []))

        target_tr = TimeRange.from_dict(data.get("target_timerange")) or TimeRange(0, 0)
        source_tr = TimeRange.from_dict(data.get("source_timerange")) or TimeRange(0, target_tr.duration)

        known = {"id", "material_id", "render_index", "speed", "volume", "extra_material_refs", "target_timerange", "source_timerange"}
        extra = {k: v for k, v in data.items() if k not in known}

        return cls(
            id=seg_id,
            material_id=mat_id,
            target_timerange=target_tr,
            source_timerange=source_tr,
            render_index=render_index,
            speed=speed,
            volume=volume,
            extra_material_refs=extra_refs,
            extra=extra,
        )

    def to_dict(self) -> Dict[str, Any]:
        base = {
            "id": self.id,
            "material_id": self.material_id,
            "render_index": self.render_index,
            "target_timerange": self.target_timerange.to_dict(),
            "source_timerange": self.source_timerange.to_dict(),
            "speed": self.speed,
            "volume": self.volume,
            "extra_material_refs": self.extra_material_refs,
        }
        base.update(self.extra)
        return base


@dataclass
class Track:
    id: str
    type: str  # "video", "audio", "text"
    attribute: int = 0
    segments: List[Segment] = field(default_factory=list)
    extra: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Track:
        t_id = str(data.get("id", ""))
        t_type = str(data.get("type", "video"))
        attr = int(data.get("attribute", 0))
        raw_segs = data.get("segments", [])
        segments = [Segment.from_dict(s) for s in raw_segs if isinstance(s, dict)]
        extra = {k: v for k, v in data.items() if k not in {"id", "type", "attribute", "segments"}}
        return cls(id=t_id, type=t_type, attribute=attr, segments=segments, extra=extra)

    def to_dict(self) -> Dict[str, Any]:
        base = {
            "id": self.id,
            "type": self.type,
            "attribute": self.attribute,
            "segments": [s.to_dict() for s in self.segments],
        }
        base.update(self.extra)
        return base


@dataclass
class DraftProject:
    id: str
    name: str
    duration: int
    fps: float = 30.0
    version: int = 2
    canvas_config: Dict[str, Any] = field(default_factory=lambda: {"width": 1080, "height": 1920, "ratio": "9:16"})
    videos: List[VideoMaterial] = field(default_factory=list)
    audios: List[AudioMaterial] = field(default_factory=list)
    texts: List[TextMaterial] = field(default_factory=list)
    tracks: List[Track] = field(default_factory=list)
    raw_materials: Dict[str, Any] = field(default_factory=dict)
    extra_root: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any], project_name: str = "") -> DraftProject:
        p_id = str(data.get("id", ""))
        duration = int(data.get("duration", 0))
        fps = float(data.get("fps", 30.0))
        version = int(data.get("version", 2))
        canvas = dict(data.get("canvas_config", {"width": 1080, "height": 1920, "ratio": "9:16"}))

        materials = data.get("materials", {})
        if not isinstance(materials, dict):
            materials = {}

        videos = [VideoMaterial.from_dict(v) for v in materials.get("videos", []) if isinstance(v, dict)]
        audios = [AudioMaterial.from_dict(a) for a in materials.get("audios", []) if isinstance(a, dict)]
        texts = [TextMaterial.from_dict(t) for t in materials.get("texts", []) if isinstance(t, dict)]

        tracks = [Track.from_dict(tr) for tr in data.get("tracks", []) if isinstance(tr, dict)]

        known_root = {"id", "duration", "fps", "version", "canvas_config", "materials", "tracks"}
        extra_root = {k: v for k, v in data.items() if k not in known_root}

        return cls(
            id=p_id,
            name=project_name,
            duration=duration,
            fps=fps,
            version=version,
            canvas_config=canvas,
            videos=videos,
            audios=audios,
            texts=texts,
            tracks=tracks,
            raw_materials=materials,
            extra_root=extra_root,
        )

    def to_dict(self) -> Dict[str, Any]:
        materials = dict(self.raw_materials)
        materials["videos"] = [v.to_dict() for v in self.videos]
        materials["audios"] = [a.to_dict() for a in self.audios]
        materials["texts"] = [t.to_dict() for t in self.texts]

        base = {
            "id": self.id,
            "version": self.version,
            "canvas_config": self.canvas_config,
            "duration": self.duration,
            "fps": self.fps,
            "materials": materials,
            "tracks": [tr.to_dict() for tr in self.tracks],
        }
        base.update(self.extra_root)
        return base
