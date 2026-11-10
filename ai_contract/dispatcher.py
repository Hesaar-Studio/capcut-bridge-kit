"""
Contract Dispatcher
===================
Pure routing layer for the AI Editing Contract.
Validates requests, routes supported read-only inspection/analysis operations,
rejects unavailable mutating operations, and returns structured ContractResponse objects.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from draft_engine.reader import get_capcut_projects_dir, read_draft_project, read_raw_draft_json, safe_draft_name
from smart_editing.duplicate_detection import detect_duplicate_candidates
from smart_editing.edit_planner import generate_edit_plan
from smart_editing.models import EditAction, EditPlan, PlanItem
from smart_editing.pause_detection import detect_subtitle_gaps, extract_subtitle_items

from .capabilities import CapabilityRegistry, CapabilityStatus, build_capability_registry
from .receipt import GLOBAL_RECEIPT_STORE, ExecutionReceipt, ExecutionStatus, ReceiptStore
from .schemas import ContractRequest, ContractResponse, validate_contract_request
from .surface_map import get_capcut_surface_map


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
        proj_name = safe_draft_name(params["project_name"])
        custom_base = params.get("projects_dir")
        base_dir = get_capcut_projects_dir(Path(custom_base) if custom_base else None)
        proj_dir = base_dir / proj_name
        if proj_dir.is_symlink():
            raise ValueError(f"Refusing to follow a symbolic-link project directory: {proj_dir}")
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

    def _handle_get_capcut_surface_map(self, req: ContractRequest) -> ContractResponse:
        """Return static pathway evidence without probing or touching the host."""
        return ContractResponse(
            operation=req.operation,
            success=True,
            data=get_capcut_surface_map(),
            request_id=req.request_id,
        )

    def _handle_list_projects(self, req: ContractRequest) -> ContractResponse:
        """List safe, direct-child draft folders without exposing local absolute paths."""
        if "projects_dir" in req.parameters:
            raise ValueError("Project listing uses the current account's CapCut projects directory only.")
        projects_dir = get_capcut_projects_dir()
        if projects_dir.is_symlink():
            raise ValueError("Refusing to list projects through a symbolic-link root.")
        if not projects_dir.exists():
            return ContractResponse(
                operation=req.operation,
                success=True,
                data={"projects": [], "count": 0, "source": "local-draft-json-index"},
                request_id=req.request_id,
            )
        if projects_dir.is_symlink() or not projects_dir.is_dir():
            raise ValueError("CapCut projects root is not a safe directory.")

        try:
            project_entries = list(projects_dir.iterdir())
        except OSError as exc:
            raise ValueError("Could not read the current account's CapCut projects directory.") from exc

        projects: List[Dict[str, Any]] = []
        for project_dir in sorted(project_entries, key=lambda item: item.name.casefold()):
            if project_dir.name.startswith(".") or project_dir.is_symlink() or not project_dir.is_dir():
                continue
            try:
                safe_draft_name(project_dir.name)
            except ValueError:
                continue

            summary: Dict[str, Any] = {
                "name": project_dir.name,
                "modified_at": None,
                "duration_seconds": None,
                "media_count": None,
                "video_count": None,
                "audio_count": None,
                "timeline_count": None,
                "clip_count": None,
                "read_error": False,
            }
            try:
                content_candidates = [project_dir / "draft_content.json", project_dir / "draft_info.json"]
                content_path = next((candidate for candidate in content_candidates if candidate.is_file()), None)
                if content_path is None:
                    raise FileNotFoundError("No draft JSON file was found.")
                if content_path.is_symlink():
                    raise ValueError("Draft JSON is a symbolic link.")
                stat = content_path.stat()
                summary["modified_at"] = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat().replace("+00:00", "Z")
                content, _content_path = read_raw_draft_json(project_dir)
                raw_duration = content.get("duration")
                if raw_duration is not None:
                    if not isinstance(raw_duration, (int, float)) or isinstance(raw_duration, bool):
                        raise ValueError("Draft duration is malformed.")
                    try:
                        duration_value = float(raw_duration)
                    except (OverflowError, ValueError) as exc:
                        raise ValueError("Draft duration is malformed.") from exc
                    if not math.isfinite(duration_value) or duration_value < 0:
                        raise ValueError("Draft duration is malformed.")
                    summary["duration_seconds"] = round(duration_value / 1_000_000, 3)

                materials = content.get("materials")
                tracks = content.get("tracks")
                if not isinstance(materials, dict) or not isinstance(tracks, list):
                    raise ValueError("Draft metadata has an invalid materials/tracks shape.")
                videos = materials.get("videos", [])
                audios = materials.get("audios", [])
                if not isinstance(videos, list) or not isinstance(audios, list):
                    raise ValueError("Draft media collections are malformed.")
                segment_count = 0
                for track in tracks:
                    if not isinstance(track, dict) or not isinstance(track.get("segments", []), list):
                        raise ValueError("Draft track metadata is malformed.")
                    segment_count += len(track.get("segments", []))
                summary.update({
                    "media_count": len(videos) + len(audios),
                    "video_count": len(videos),
                    "audio_count": len(audios),
                    "timeline_count": len(tracks),
                    "clip_count": segment_count,
                })
            except (OSError, OverflowError, TypeError, ValueError):
                # Keep the real folder visible but do not invent metadata for a corrupt/unreadable draft.
                summary["read_error"] = True
            projects.append(summary)

        return ContractResponse(
            operation=req.operation,
            success=True,
            data={"projects": projects, "count": len(projects), "source": "local-draft-json-index"},
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
        project_dir = self._resolve_project_dir(req.parameters)
        check_files = bool(req.parameters.get("check_files", True))

        def inspect_path(raw_path: str) -> bool:
            path = Path(raw_path).expanduser()
            if not path.is_absolute():
                path = project_dir / path
            return path.is_file()

        videos_info = []
        for v in proj.videos:
            v_dict = v.to_dict()
            if check_files:
                v_dict["exists_on_disk"] = inspect_path(v.path)
            videos_info.append(v_dict)

        audios_info = []
        for a in proj.audios:
            a_dict = a.to_dict()
            if check_files:
                a_dict["exists_on_disk"] = inspect_path(a.path)
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
        project = self._load_project(req.parameters)
        plan_raw = req.parameters["plan"]
        errors: List[str] = []
        warnings: List[str] = []
        valid_actions = {action.value for action in EditAction}
        valid_segment_ids = {
            segment.id
            for track in project.tracks
            for segment in track.segments
            if segment.id
        }

        if not isinstance(plan_raw, dict):
            errors.append("Plan must be a JSON object (dictionary)")
        else:
            if plan_raw.get("project_name") != project.name:
                errors.append("Plan project_name does not match the selected project")
            total_duration = plan_raw.get("total_duration_us")
            if total_duration is not None and total_duration != project.duration:
                errors.append("Plan duration does not match the current project readback")
            items = plan_raw.get("items")
            if not isinstance(items, list):
                errors.append("Plan must contain an 'items' array")
            elif len(items) > 5000:
                errors.append("Plan contains more than 5000 items")
            else:
                for idx, item in enumerate(items):
                    if not isinstance(item, dict):
                        errors.append(f"plan.items[{idx}] is not an object")
                        continue
                    action = item.get("action")
                    if action not in valid_actions:
                        errors.append(f"plan.items[{idx}] has unknown action '{action}'")
                    description = item.get("description", "")
                    if not isinstance(description, str) or len(description) > 2000:
                        errors.append(f"plan.items[{idx}].description must be text of at most 2000 characters")
                    target_ids = item.get("target_segment_ids", [])
                    if not isinstance(target_ids, list) or any(not isinstance(value, str) for value in target_ids):
                        errors.append(f"plan.items[{idx}].target_segment_ids must be an array of strings")
                    else:
                        missing = [value for value in target_ids if value not in valid_segment_ids]
                        if missing:
                            errors.append(f"plan.items[{idx}] references unknown segment IDs: {missing[:10]}")
                        if action in valid_actions and not target_ids:
                            errors.append(f"plan.items[{idx}] must reference at least one project segment")
                    item_parameters = item.get("parameters", {})
                    if not isinstance(item_parameters, dict):
                        errors.append(f"plan.items[{idx}].parameters must be an object")
                    time_range = item.get("time_range")
                    if time_range is not None:
                        if not isinstance(time_range, dict):
                            errors.append(f"plan.items[{idx}].time_range must be an object or null")
                        else:
                            start = time_range.get("start")
                            duration = time_range.get("duration")
                            if not isinstance(start, (int, float)) or isinstance(start, bool) or start < 0:
                                errors.append(f"plan.items[{idx}].time_range.start must be non-negative")
                            if not isinstance(duration, (int, float)) or isinstance(duration, bool) or duration <= 0:
                                errors.append(f"plan.items[{idx}].time_range.duration must be positive")
                            elif isinstance(start, (int, float)) and start + duration > project.duration:
                                errors.append(f"plan.items[{idx}].time_range exceeds the current project duration")

        is_valid = len(errors) == 0
        return ContractResponse(
            operation=req.operation,
            success=True,
            data={"is_valid": is_valid, "errors": errors, "warnings": warnings, "read_only": True},
            request_id=req.request_id,
        )

    def _handle_preview_edit_plan(self, req: ContractRequest) -> ContractResponse:
        proj = self._load_project(req.parameters)
        plan_raw = req.parameters.get("plan")

        if plan_raw is not None:
            if not isinstance(plan_raw, dict):
                return ContractResponse(
                    operation=req.operation,
                    success=False,
                    error={"code": "INVALID_PLAN", "message": "Plan must be a JSON object."},
                    request_id=req.request_id,
                )
            validation_response = self._handle_validate_edit_plan(ContractRequest(
                operation="validate_edit_plan",
                parameters={"project_name": req.parameters["project_name"], "plan": plan_raw, **({"projects_dir": req.parameters["projects_dir"]} if req.parameters.get("projects_dir") else {})},
                request_id=req.request_id,
            ))
            validation_data = validation_response.data or {}
            if not validation_data.get("is_valid"):
                return ContractResponse(
                    operation=req.operation,
                    success=False,
                    error={"code": "INVALID_PLAN", "message": "Plan did not validate against the current project.", "errors": validation_data.get("errors", [])},
                    request_id=req.request_id,
                )
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
