"""
Capability Registry
===================
Deterministic, provider-neutral registry of Bridge capabilities.
Reports real operational states without advertising unverified or fake features.
"""

from __future__ import annotations

import sys
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class CapabilityStatus(str, Enum):
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    EXPERIMENTAL = "experimental"


@dataclass(frozen=True)
class ToolCapability:
    """Describes a specific tool supported by the CapCut Bridge contract."""
    name: str
    category: str  # "discovery", "inspection", "analysis", "planning", "execution", "verification"
    status: CapabilityStatus
    mutating: bool
    read_only: bool
    requires_confirmation: bool
    requires_live_capcut: bool
    description: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "category": self.category,
            "status": self.status.value,
            "mutating": self.mutating,
            "read_only": self.read_only,
            "requires_confirmation": self.requires_confirmation,
            "requires_live_capcut": self.requires_live_capcut,
            "description": self.description,
        }


@dataclass
class CapabilityRegistry:
    """Canonical registry describing Bridge capabilities for external AI clients."""
    protocol_version: str = "2026.1"
    bridge_version: str = "2.4.0"
    platform: str = field(default_factory=lambda: sys.platform)
    tools: List[ToolCapability] = field(default_factory=list)

    def get_tool(self, name: str) -> Optional[ToolCapability]:
        for tool in self.tools:
            if tool.name == name:
                return tool
        return None

    def is_available(self, name: str) -> bool:
        tool = self.get_tool(name)
        return tool is not None and tool.status == CapabilityStatus.AVAILABLE

    def to_dict(self) -> Dict[str, Any]:
        return {
            "protocol_version": self.protocol_version,
            "bridge_version": self.bridge_version,
            "platform": self.platform,
            "capabilities_count": len(self.tools),
            "available_tools_count": sum(1 for t in self.tools if t.status == CapabilityStatus.AVAILABLE),
            "tools": [t.to_dict() for t in self.tools],
        }


def build_capability_registry(current_platform: Optional[str] = None) -> CapabilityRegistry:
    """
    Constructs the canonical capability registry.
    Only marks capabilities as 'available' when backed by tested backend modules.
    """
    plat = current_platform or sys.platform

    tools = [
        ToolCapability(
            name="get_capabilities",
            category="discovery",
            status=CapabilityStatus.AVAILABLE,
            mutating=False,
            read_only=True,
            requires_confirmation=False,
            requires_live_capcut=False,
            description="Discover protocol version, platform, and supported AI contract capabilities.",
        ),
        ToolCapability(
            name="inspect_project",
            category="inspection",
            status=CapabilityStatus.AVAILABLE,
            mutating=False,
            read_only=True,
            requires_confirmation=False,
            requires_live_capcut=False,
            description="Inspect high-level metadata (duration, canvas dimensions, fps, track summary) of a CapCut draft.",
        ),
        ToolCapability(
            name="inspect_timeline",
            category="inspection",
            status=CapabilityStatus.AVAILABLE,
            mutating=False,
            read_only=True,
            requires_confirmation=False,
            requires_live_capcut=False,
            description="Inspect tracks, segments, render indices, and time ranges in a CapCut draft.",
        ),
        ToolCapability(
            name="inspect_media",
            category="inspection",
            status=CapabilityStatus.AVAILABLE,
            mutating=False,
            read_only=True,
            requires_confirmation=False,
            requires_live_capcut=False,
            description="Inspect referenced video and audio materials, local paths, and verify file existence on disk.",
        ),
        ToolCapability(
            name="inspect_subtitles",
            category="inspection",
            status=CapabilityStatus.AVAILABLE,
            mutating=False,
            read_only=True,
            requires_confirmation=False,
            requires_live_capcut=False,
            description="Extract text materials and ordered timeline subtitle items with cleaned prose.",
        ),
        ToolCapability(
            name="analyze_gaps",
            category="analysis",
            status=CapabilityStatus.AVAILABLE,
            mutating=False,
            read_only=True,
            requires_confirmation=False,
            requires_live_capcut=False,
            description="Analyze pause gaps between consecutive subtitle segments with configurable duration thresholds.",
        ),
        ToolCapability(
            name="analyze_duplicates",
            category="analysis",
            status=CapabilityStatus.AVAILABLE,
            mutating=False,
            read_only=True,
            requires_confirmation=False,
            requires_live_capcut=False,
            description="Analyze candidate duplicate takes or repetitive utterances using text similarity within a time window.",
        ),
        ToolCapability(
            name="create_edit_plan",
            category="planning",
            status=CapabilityStatus.AVAILABLE,
            mutating=False,
            read_only=True,
            requires_confirmation=False,
            requires_live_capcut=False,
            description="Compile pause and duplicate analysis findings into a structured, read-only EditPlan.",
        ),
        ToolCapability(
            name="validate_edit_plan",
            category="planning",
            status=CapabilityStatus.AVAILABLE,
            mutating=False,
            read_only=True,
            requires_confirmation=False,
            requires_live_capcut=False,
            description="Validate structural integrity, actions, and time ranges of an EditPlan against a project.",
        ),
        ToolCapability(
            name="preview_edit_plan",
            category="planning",
            status=CapabilityStatus.AVAILABLE,
            mutating=False,
            read_only=True,
            requires_confirmation=False,
            requires_live_capcut=False,
            description="Generate a dry-run preview showing projected duration changes without modifying source files.",
        ),
        ToolCapability(
            name="execute_edit_plan",
            category="execution",
            status=CapabilityStatus.UNAVAILABLE,
            mutating=True,
            read_only=False,
            requires_confirmation=True,
            requires_live_capcut=False,
            description="Apply an approved EditPlan with staging, auto-backup, and readback verification (Phase 4B+: awaiting mutation layer).",
        ),
        ToolCapability(
            name="verify_execution",
            category="verification",
            status=CapabilityStatus.UNAVAILABLE,
            mutating=False,
            read_only=True,
            requires_confirmation=False,
            requires_live_capcut=False,
            description="Verify disk readback for an applied edit receipt (Phase 4B+: awaiting mutation layer).",
        ),
        ToolCapability(
            name="get_execution_receipt",
            category="verification",
            status=CapabilityStatus.AVAILABLE,
            mutating=False,
            read_only=True,
            requires_confirmation=False,
            requires_live_capcut=False,
            description="Retrieve a structured ExecutionReceipt by ID from the contract receipt store.",
        ),
    ]

    return CapabilityRegistry(platform=plat, tools=tools)
