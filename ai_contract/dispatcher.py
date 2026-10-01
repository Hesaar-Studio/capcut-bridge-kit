"""
Contract Dispatcher
===================
Pure routing layer for the AI Editing Contract.
Validates requests, routes supported read-only inspection/analysis operations,
rejects unavailable mutating operations, and returns structured ContractResponse objects.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from draft_engine.reader import get_capcut_projects_dir, read_draft_project
from smart_editing.duplicate_detection import detect_duplicate_candidates
from smart_editing.edit_planner import generate_edit_plan
from smart_editing.models import EditAction, EditPlan, PlanItem
from smart_editing.pause_detection import detect_subtitle_gaps, extract_subtitle_items

from .capabilities import CapabilityRegistry, CapabilityStatus, build_capability_registry
from .receipt import GLOBAL_RECEIPT_STORE, ExecutionReceipt, ExecutionStatus, ReceiptStore
from .schemas import ContractRequest, ContractResponse, validate_contract_request


class ContractDispatcher:
    """
    Stateless contract routing layer.
    Exposes Bridge capabilities to external AI systems through a stable envelope.
    """

    def __init__(
        self,
        registry: Optional[CapabilityRegistry] = None,
        receipt_store: Optional[ReceiptStore] = None,
    ):
        self.registry = registry or build_capability_registry()
        self.receipt_store = receipt_store or GLOBAL_RECEIPT_STORE

    def dispatch(self, request: Union[ContractRequest, Dict[str, Any]]) -> ContractResponse:
        """Main entry point to dispatch a contract request."""
        if isinstance(request, dict):
            req = ContractRequest.from_dict(request)
        else:
            req = request

        # 1. Structural schema validation
        is_valid, val_err = validate_contract_request(req)
        if not is_valid:
            return ContractResponse(
                operation=req.operation,
                success=False,
                error={"code": "INVALID_REQUEST", "message": val_err},
                request_id=req.request_id,
            )

        # 2. Check capability availability
        tool = self.registry.get_tool(req.operation)
        if not tool:
            return ContractResponse(
                operation=req.operation,
                success=False,
                error={"code": "UNKNOWN_OPERATION", "message": f"Operation '{req.operation}' is not recognized."},
                request_id=req.request_id,
            )

        if tool.status == CapabilityStatus.UNAVAILABLE:
            return ContractResponse(
                operation=req.operation,
                success=False,
                error={
                    "code": "UNSUPPORTED_OPERATION",
                    "status": "unavailable",
                    "message": (
                        f"Operation '{req.operation}' is marked unavailable in Phase 4B. "
                        f"Destructive project mutation is disabled pending the safe execution pipeline."
                    ),
                },
                request_id=req.request_id,
            )

        # 3. Route to read-only handlers
        handler_name = f"_handle_{req.operation}"
        handler = getattr(self, handler_name, None)
        if not handler:
            return ContractResponse(
                operation=req.operation,
                success=False,
                error={"code": "NOT_IMPLEMENTED", "message": f"Handler '{handler_name}' is not wired."},
                request_id=req.request_id,
            )

        try:
            return handler(req)
        except FileNotFoundError as fnf:
            return ContractResponse(
                operation=req.operation,
                success=False,
                error={"code": "NOT_FOUND", "message": str(fnf)},
                request_id=req.request_id,
            )
        except ValueError as ve:
            return ContractResponse(
                operation=req.operation,
                success=False,
                error={"code": "VALIDATION_ERROR", "message": str(ve)},
                request_id=req.request_id,
            )
        except Exception as exc:
            return ContractResponse(
                operation=req.operation,
                success=False,
                error={"code": "INTERNAL_ERROR", "message": f"Error executing '{req.operation}': {str(exc)}"},
                request_id=req.request_id,
            )

    # -----------------------------------------------------------------------
    # Internal Helpers
    # -----------------------------------------------------------------------

    def _resolve_project_dir(self, params: Dict[str, Any]) -> Path:
        proj_name = params["project_name"]
        custom_base = params.get("projects_dir")
        base_dir = get_capcut_projects_dir(Path(custom_base) if custom_base else None)
        proj_dir = base_dir / proj_name
        if not proj_dir.is_dir():
            raise FileNotFoundError(f"CapCut project directory not found: {proj_dir}")
        return proj_dir

    def _load_project(self, params: Dict[str, Any]):
        proj_dir = self._resolve_project_dir(params)
        return read_draft_project(proj_dir, validate=False)

    # -----------------------------------------------------------------------
    # Handlers (Read-Only)
    # -----------------------------------------------------------------------

    def _handle_get_capabilities(self, req: ContractRequest) -> ContractResponse:
        return ContractResponse(
            operation=req.operation,
            success=True,
            data=self.registry.to_dict(),
            request_id=req.request_id,
        )

    def _handle_inspect_project(self, req: ContractRequest) -> ContractResponse:
        proj = self._load_project(req.parameters)
        data = {
            "project_name": proj.name,
            "id": proj.id,
            "duration_us": proj.duration,
            "duration_sec": round(proj.duration / 1_000_000.0, 3),
            "fps": proj.fps,
            "canvas_config": proj.canvas_config,
            "tracks_count": len(proj.tracks),
            "track_summary": {
                "video_tracks": sum(1 for t in proj.tracks if t.type == "video"),
                "audio_tracks": sum(1 for t in proj.tracks if t.type == "audio"),
                "text_tracks": sum(1 for t in proj.tracks if t.type == "text"),
            },
            "materials_count": {
                "videos": len(proj.videos),
                "audios": len(proj.audios),
                "texts": len(proj.texts),
            },
        }
        return ContractResponse(
            operation=req.operation,
            success=True,
            data=data,
            request_id=req.request_id,
        )

    def _handle_inspect_timeline(self, req: ContractRequest) -> ContractResponse:
        proj = self._load_project(req.parameters)
        tracks_data = [t.to_dict() for t in proj.tracks]
        return ContractResponse(
            operation=req.operation,
            success=True,
            data={
                "project_name": proj.name,
                "duration_us": proj.duration,
                "duration_sec": round(proj.duration / 1_000_000.0, 3),
                "tracks": tracks_data,
            },
            request_id=req.request_id,
        )

    def _handle_inspect_media(self, req: ContractRequest) -> ContractResponse:
        proj = self._load_project(req.parameters)
        check_files = bool(req.parameters.get("check_files", True))

        videos_info = []
        for v in proj.videos:
            v_dict = v.to_dict()
            if check_files:
                v_dict["exists_on_disk"] = Path(v.path).is_file()
            videos_info.append(v_dict)

        audios_info = []
        for a in proj.audios:
            a_dict = a.to_dict()
            if check_files:
                a_dict["exists_on_disk"] = Path(a.path).is_file()
            audios_info.append(a_dict)

        return ContractResponse(
            operation=req.operation,
            success=True,
            data={
                "project_name": proj.name,
                "videos": videos_info,
                "audios": audios_info,
            },
            request_id=req.request_id,
        )

    def _handle_inspect_subtitles(self, req: ContractRequest) -> ContractResponse:
        proj = self._load_project(req.parameters)
        subtitles = extract_subtitle_items(proj)
        return ContractResponse(
            operation=req.operation,
            success=True,
            data={
                "project_name": proj.name,
                "subtitles_count": len(subtitles),
                "subtitles": [s.to_dict() for s in subtitles],
            },
            request_id=req.request_id,
        )

    def _handle_analyze_gaps(self, req: ContractRequest) -> ContractResponse:
        proj = self._load_project(req.parameters)
        subtitles = extract_subtitle_items(proj)
        min_gap = float(req.parameters.get("min_gap_sec", 1.0))
        gaps = detect_subtitle_gaps(subtitles, min_gap_sec=min_gap)

        total_gap_us = sum(g.gap_duration_us for g in gaps)
        return ContractResponse(
            operation=req.operation,
            success=True,
            data={
                "project_name": proj.name,
                "min_gap_sec": min_gap,
                "gaps_count": len(gaps),
                "total_gap_sec": round(total_gap_us / 1_000_000.0, 3),
                "gaps": [g.to_dict() for g in gaps],
            },
            request_id=req.request_id,
        )

    def _handle_analyze_duplicates(self, req: ContractRequest) -> ContractResponse:
        proj = self._load_project(req.parameters)
        subtitles = extract_subtitle_items(proj)
        max_dist = float(req.parameters.get("max_time_distance_sec", 60.0))
        high_th = float(req.parameters.get("high_threshold", 0.85))
        poss_th = float(req.parameters.get("possible_threshold", 0.70))

        duplicates = detect_duplicate_candidates(
            subtitles,
            max_time_distance_sec=max_dist,
            high_threshold=high_th,
            possible_threshold=poss_th,
        )

        return ContractResponse(
            operation=req.operation,
            success=True,
            data={
                "project_name": proj.name,
                "candidates_count": len(duplicates),
                "candidates": [d.to_dict() for d in duplicates],
            },
            request_id=req.request_id,
        )

    def _handle_create_edit_plan(self, req: ContractRequest) -> ContractResponse:
        proj = self._load_project(req.parameters)
        min_gap = float(req.parameters.get("min_pause_gap_sec", 1.0))
        max_dist = float(req.parameters.get("max_duplicate_distance_sec", 60.0))

        plan = generate_edit_plan(
            proj,
            min_pause_gap_sec=min_gap,
            max_duplicate_distance_sec=max_dist,
        )

        return ContractResponse(
            operation=req.operation,
            success=True,
            data=plan.to_dict(),
            request_id=req.request_id,
        )

    def _handle_validate_edit_plan(self, req: ContractRequest) -> ContractResponse:
        plan_raw = req.parameters["plan"]
        errors = []
        warnings = []

        if not isinstance(plan_raw, dict):
            errors.append("Plan must be a JSON object (dictionary)")
        else:
            if "items" not in plan_raw or not isinstance(plan_raw["items"], list):
                errors.append("Plan must contain an 'items' array")
            else:
                for idx, item in enumerate(plan_raw["items"]):
                    if not isinstance(item, dict):
                        errors.append(f"plan.items[{idx}] is not an object")
                        continue
                    action = item.get("action")
                    valid_actions = {a.value for a in EditAction}
                    if action not in valid_actions:
                        errors.append(f"plan.items[{idx}] has unknown action '{action}'")

        is_valid = len(errors) == 0
        return ContractResponse(
            operation=req.operation,
            success=True,
            data={"is_valid": is_valid, "errors": errors, "warnings": warnings},
            request_id=req.request_id,
        )

    def _handle_preview_edit_plan(self, req: ContractRequest) -> ContractResponse:
        proj = self._load_project(req.parameters)
        plan_raw = req.parameters.get("plan")

        if plan_raw:
            items = plan_raw.get("items", [])
        else:
            min_gap = float(req.parameters.get("min_pause_gap_sec", 1.0))
            plan = generate_edit_plan(proj, min_pause_gap_sec=min_gap)
            items = [item.to_dict() for item in plan.items]

        # Calculate projected time saved from trim gap operations
        projected_trim_us = 0
        for item in items:
            if item.get("action") == EditAction.TRIM_GAP.value:
                tr = item.get("time_range")
                if isinstance(tr, dict):
                    projected_trim_us += int(tr.get("duration", 0))

        curr_dur_sec = proj.duration / 1_000_000.0
        saved_sec = projected_trim_us / 1_000_000.0
        projected_dur_sec = max(0.0, curr_dur_sec - saved_sec)

        return ContractResponse(
            operation=req.operation,
            success=True,
            data={
                "project_name": proj.name,
                "current_duration_sec": round(curr_dur_sec, 3),
                "projected_duration_sec": round(projected_dur_sec, 3),
                "net_time_saved_sec": round(saved_sec, 3),
                "planned_actions_count": len(items),
                "is_dry_run": True,
            },
            request_id=req.request_id,
        )

    def _handle_get_execution_receipt(self, req: ContractRequest) -> ContractResponse:
        exec_id = req.parameters["execution_id"]
        receipt = self.receipt_store.get(exec_id)
        if not receipt:
            return ContractResponse(
                operation=req.operation,
                success=False,
                error={"code": "RECEIPT_NOT_FOUND", "message": f"Execution receipt '{exec_id}' not found."},
                request_id=req.request_id,
            )

        return ContractResponse(
            operation=req.operation,
            success=True,
            data=receipt.to_dict(),
            request_id=req.request_id,
        )


def dispatch_contract_request(request_data: Union[ContractRequest, Dict[str, Any]]) -> ContractResponse:
    """Convenience module-level dispatcher function."""
    dispatcher = ContractDispatcher()
    return dispatcher.dispatch(request_data)
