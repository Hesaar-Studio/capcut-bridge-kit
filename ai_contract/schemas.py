"""
AI Editing Contract Schemas
===========================
JSON-serializable request/response schemas for provider-neutral AI client interaction.
Reuses existing Phase 2 DraftProject and Phase 3A EditPlan models.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

SAFE_PROJECT_NAME_REGEX = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 _.-]{0,79}$")


@dataclass
class ContractRequest:
    """Canonical request envelope sent by an AI client to CapCut Bridge Kit."""
    operation: str
    parameters: Dict[str, Any] = field(default_factory=dict)
    client_id: Optional[str] = None
    request_id: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> ContractRequest:
        op = str(data.get("operation", ""))
        params = data.get("parameters", {})
        if not isinstance(params, dict):
            params = {}
        return cls(
            operation=op,
            parameters=params,
            client_id=data.get("client_id"),
            request_id=data.get("request_id"),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "operation": self.operation,
            "parameters": self.parameters,
            "client_id": self.client_id,
            "request_id": self.request_id,
        }


@dataclass
class ContractResponse:
    """Canonical response envelope returned by CapCut Bridge Kit to an AI client."""
    operation: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None
    execution_receipt: Optional[Dict[str, Any]] = None
    request_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        res: Dict[str, Any] = {
            "operation": self.operation,
            "success": self.success,
            "request_id": self.request_id,
        }
        if self.data is not None:
            res["data"] = self.data
        if self.error is not None:
            res["error"] = self.error
        if self.execution_receipt is not None:
            res["execution_receipt"] = self.execution_receipt
        return res


TOOL_PARAM_SCHEMAS: Dict[str, Dict[str, Any]] = {
    "get_capabilities": {
        "required": [],
        "optional": ["platform"],
    },
    "inspect_project": {
        "required": ["project_name"],
        "optional": ["projects_dir"],
    },
    "inspect_timeline": {
        "required": ["project_name"],
        "optional": ["projects_dir"],
    },
    "inspect_media": {
        "required": ["project_name"],
        "optional": ["projects_dir", "check_files"],
    },
    "inspect_subtitles": {
        "required": ["project_name"],
        "optional": ["projects_dir"],
    },
    "analyze_gaps": {
        "required": ["project_name"],
        "optional": ["projects_dir", "min_gap_sec"],
    },
    "analyze_duplicates": {
        "required": ["project_name"],
        "optional": ["projects_dir", "max_time_distance_sec", "high_threshold", "possible_threshold"],
    },
    "create_edit_plan": {
        "required": ["project_name"],
        "optional": ["projects_dir", "min_pause_gap_sec", "max_duplicate_distance_sec"],
    },
    "validate_edit_plan": {
        "required": ["project_name", "plan"],
        "optional": ["projects_dir"],
    },
    "preview_edit_plan": {
        "required": ["project_name"],
        "optional": ["projects_dir", "plan", "min_pause_gap_sec"],
    },
    "execute_edit_plan": {
        "required": ["project_name", "plan", "confirm_token"],
        "optional": ["projects_dir", "create_backup"],
    },
    "verify_execution": {
        "required": ["execution_id"],
        "optional": ["project_name"],
    },
    "get_execution_receipt": {
        "required": ["execution_id"],
        "optional": [],
    },
}


def validate_contract_request(req: ContractRequest) -> Tuple[bool, Optional[str]]:
    """Validates operation existence and required parameter presence."""
    op = req.operation
    if not op:
        return False, "Missing 'operation' in request envelope."

    schema = TOOL_PARAM_SCHEMAS.get(op)
    if not schema:
        return False, f"Unknown operation: '{op}'"

    params = req.parameters
    for req_field in schema["required"]:
        if req_field not in params or params[req_field] is None:
            return False, f"Operation '{op}' missing required parameter '{req_field}'."

    # Validate project_name if provided to prevent path traversal
    proj_name = params.get("project_name")
    if proj_name is not None:
        if not isinstance(proj_name, str) or not SAFE_PROJECT_NAME_REGEX.fullmatch(proj_name) or proj_name in {".", ".."}:
            return False, f"Invalid project_name '{proj_name}'. Must be alphanumeric with spaces, dots, or dashes (max 80 chars)."

    return True, None
