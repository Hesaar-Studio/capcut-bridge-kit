"""
Unit and Integration Tests for AI Editing Contract Layer (Phase 4B)
===================================================================
Tests capability discovery, schema validation, provider-neutral routing,
unsupported operation handling, read-only guarantees, and execution receipts.
"""

import json
import tempfile
import unittest
from pathlib import Path

from ai_contract.capabilities import CapabilityStatus, build_capability_registry
from ai_contract.dispatcher import ContractDispatcher, dispatch_contract_request
from ai_contract.receipt import ExecutionReceipt, ExecutionStatus, ReceiptStore
from ai_contract.schemas import ContractRequest, ContractResponse, validate_contract_request
from draft_engine.models import (
    AudioMaterial,
    DraftProject,
    Segment,
    TextMaterial,
    TimeRange,
    Track,
    VideoMaterial,
)
from draft_engine.writer import write_draft_project


def setup_sample_project(projects_dir: Path, name: str = "TestAIReel") -> Path:
    """Helper to write a valid sample project in a temp directory."""
    v1 = VideoMaterial(id="v1", path=str(projects_dir / "clip1.mp4"), duration=10_000_000)
    (projects_dir / "clip1.mp4").write_bytes(b"dummy_video_bytes")

    t1 = TextMaterial(id="t1", content="Hello and welcome to AI editing")
    t2 = TextMaterial(id="t2", content="Hello and welcome to AI editing")  # exact duplicate
    t3 = TextMaterial(id="t3", content="Now let us see how the contract routes commands")

    # Time layout: 0-3s, 5-8s (gap of 2s), 10-13s (gap of 2s)
    seg_v1 = Segment("sv1", "v1", TimeRange(0, 15_000_000), TimeRange(0, 15_000_000))
    seg_t1 = Segment("st1", "t1", TimeRange(0, 3_000_000), TimeRange(0, 3_000_000))
    seg_t2 = Segment("st2", "t2", TimeRange(5_000_000, 3_000_000), TimeRange(0, 3_000_000))
    seg_t3 = Segment("st3", "t3", TimeRange(10_000_000, 3_000_000), TimeRange(0, 3_000_000))

    trk_v = Track("trk_v", "video", segments=[seg_v1])
    trk_t = Track("trk_t", "text", segments=[seg_t1, seg_t2, seg_t3])

    proj = DraftProject(
        id="sample_proj_uuid",
        name=name,
        duration=15_000_000,
        videos=[v1],
        texts=[t1, t2, t3],
        tracks=[trk_v, trk_t],
    )

    res = write_draft_project(projects_dir, proj, draft_name=name)
    return Path(res["target_dir"])


class TestCapabilityRegistry(unittest.TestCase):
    def test_registry_serialization(self):
        reg = build_capability_registry(current_platform="win32")
        d = reg.to_dict()
        self.assertEqual(d["protocol_version"], "2026.1")
        self.assertEqual(d["platform"], "win32")
        self.assertGreater(d["capabilities_count"], 10)
        self.assertGreater(d["available_tools_count"], 5)

        # Ensure valid JSON serialization
        json_str = json.dumps(d)
        self.assertIsInstance(json_str, str)

    def test_tool_status_distinction(self):
        reg = build_capability_registry()
        # Read-only tools must be AVAILABLE
        inspect_tool = reg.get_tool("inspect_project")
        self.assertIsNotNone(inspect_tool)
        self.assertEqual(inspect_tool.status, CapabilityStatus.AVAILABLE)
        self.assertTrue(inspect_tool.read_only)
        self.assertFalse(inspect_tool.mutating)

        # Mutating tool execute_edit_plan must be UNAVAILABLE in Phase 4B
        exec_tool = reg.get_tool("execute_edit_plan")
        self.assertIsNotNone(exec_tool)
        self.assertEqual(exec_tool.status, CapabilityStatus.UNAVAILABLE)
        self.assertTrue(exec_tool.mutating)
        self.assertTrue(exec_tool.requires_confirmation)


class TestSchemaValidation(unittest.TestCase):
    def test_valid_request(self):
        req = ContractRequest(operation="inspect_project", parameters={"project_name": "ValidName_01"})
        valid, err = validate_contract_request(req)
        self.assertTrue(valid)
        self.assertIsNone(err)

    def test_missing_operation(self):
        req = ContractRequest(operation="")
        valid, err = validate_contract_request(req)
        self.assertFalse(valid)
        self.assertIn("Missing 'operation'", err)

    def test_missing_required_parameter(self):
        req = ContractRequest(operation="inspect_project", parameters={})
        valid, err = validate_contract_request(req)
        self.assertFalse(valid)
        self.assertIn("missing required parameter 'project_name'", err)

    def test_path_traversal_rejection(self):
        req = ContractRequest(operation="inspect_project", parameters={"project_name": "../escape_dir"})
        valid, err = validate_contract_request(req)
        self.assertFalse(valid)
        self.assertIn("Invalid project_name", err)


class TestExecutionReceipt(unittest.TestCase):
    def test_receipt_serialization_and_store(self):
        store = ReceiptStore()
        receipt = ExecutionReceipt(
            execution_id="exec_12345",
            project_name="TestProject",
            requested_operation="execute_edit_plan",
            status=ExecutionStatus.VERIFIED,
            applied=True,
            actions_count=2,
            backup_path="/backups/.TestProject.backup-999",
            validation_passed=True,
            readback_verified=True,
            metadata={"source": "unit_test"},
        )
        store.store(receipt)

        retrieved = store.get("exec_12345")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.status, ExecutionStatus.VERIFIED)
        self.assertTrue(retrieved.applied)

        d = retrieved.to_dict()
        self.assertEqual(d["execution_id"], "exec_12345")
        self.assertEqual(d["status"], "VERIFIED")

        restored = ExecutionReceipt.from_dict(d)
        self.assertEqual(restored.execution_id, "exec_12345")
        self.assertEqual(restored.status, ExecutionStatus.VERIFIED)


class TestContractDispatcher(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.projects_dir = Path(self.temp_dir.name)
        self.project_path = setup_sample_project(self.projects_dir, "MyReel")
        self.receipt_store = ReceiptStore()
        self.dispatcher = ContractDispatcher(receipt_store=self.receipt_store)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_get_capabilities_routing(self):
        req = ContractRequest(operation="get_capabilities")
        res = self.dispatcher.dispatch(req)
        self.assertTrue(res.success)
        self.assertIn("tools", res.data)
        self.assertIn("protocol_version", res.data)

    def test_inspect_project_routing(self):
        req = ContractRequest(
            operation="inspect_project",
            parameters={"project_name": "MyReel", "projects_dir": str(self.projects_dir)},
        )
        res = self.dispatcher.dispatch(req)
        self.assertTrue(res.success)
        self.assertEqual(res.data["project_name"], "MyReel")
        self.assertEqual(res.data["duration_sec"], 15.0)
        self.assertEqual(res.data["track_summary"]["video_tracks"], 1)
        self.assertEqual(res.data["track_summary"]["text_tracks"], 1)

    def test_inspect_timeline_routing(self):
        req = ContractRequest(
            operation="inspect_timeline",
            parameters={"project_name": "MyReel", "projects_dir": str(self.projects_dir)},
        )
        res = self.dispatcher.dispatch(req)
        self.assertTrue(res.success)
        self.assertEqual(len(res.data["tracks"]), 2)

    def test_inspect_media_routing(self):
        req = ContractRequest(
            operation="inspect_media",
            parameters={"project_name": "MyReel", "projects_dir": str(self.projects_dir), "check_files": True},
        )
        res = self.dispatcher.dispatch(req)
        self.assertTrue(res.success)
        self.assertEqual(len(res.data["videos"]), 1)
        self.assertTrue(res.data["videos"][0]["exists_on_disk"])

    def test_inspect_subtitles_routing(self):
        req = ContractRequest(
            operation="inspect_subtitles",
            parameters={"project_name": "MyReel", "projects_dir": str(self.projects_dir)},
        )
        res = self.dispatcher.dispatch(req)
        self.assertTrue(res.success)
        self.assertEqual(res.data["subtitles_count"], 3)
        self.assertEqual(res.data["subtitles"][0]["content"], "Hello and welcome to AI editing")

    def test_analyze_gaps_routing(self):
        req = ContractRequest(
            operation="analyze_gaps",
            parameters={"project_name": "MyReel", "projects_dir": str(self.projects_dir), "min_gap_sec": 1.0},
        )
        res = self.dispatcher.dispatch(req)
        self.assertTrue(res.success)
        # In our sample, gaps are at 3-5s (2s) and 8-10s (2s) -> 2 gaps of 2.0s
        self.assertEqual(res.data["gaps_count"], 2)
        self.assertEqual(res.data["total_gap_sec"], 4.0)

    def test_analyze_duplicates_routing(self):
        req = ContractRequest(
            operation="analyze_duplicates",
            parameters={"project_name": "MyReel", "projects_dir": str(self.projects_dir)},
        )
        res = self.dispatcher.dispatch(req)
        self.assertTrue(res.success)
        self.assertEqual(res.data["candidates_count"], 1)
        self.assertEqual(res.data["candidates"][0]["category"], "EXACT_DUPLICATE")

    def test_create_and_preview_edit_plan(self):
        # 1. Create plan
        req_plan = ContractRequest(
            operation="create_edit_plan",
            parameters={"project_name": "MyReel", "projects_dir": str(self.projects_dir), "min_pause_gap_sec": 1.0},
        )
        res_plan = self.dispatcher.dispatch(req_plan)
        self.assertTrue(res_plan.success)
        plan_dict = res_plan.data
        self.assertEqual(plan_dict["project_name"], "MyReel")
        self.assertGreater(plan_dict["planned_operations_count"], 0)

        # 2. Validate plan
        req_val = ContractRequest(
            operation="validate_edit_plan",
            parameters={"project_name": "MyReel", "plan": plan_dict},
        )
        res_val = self.dispatcher.dispatch(req_val)
        self.assertTrue(res_val.success)
        self.assertTrue(res_val.data["is_valid"])

        # 3. Preview plan
        req_prev = ContractRequest(
            operation="preview_edit_plan",
            parameters={"project_name": "MyReel", "projects_dir": str(self.projects_dir), "plan": plan_dict},
        )
        res_prev = self.dispatcher.dispatch(req_prev)
        self.assertTrue(res_prev.success)
        self.assertEqual(res_prev.data["current_duration_sec"], 15.0)
        self.assertLess(res_prev.data["projected_duration_sec"], 15.0)
        self.assertEqual(res_prev.data["net_time_saved_sec"], 4.0)

    def test_unsupported_mutating_operation_rejection(self):
        """Crucial test: execute_edit_plan must be rejected with UNSUPPORTED_OPERATION, zero fake success."""
        req = ContractRequest(
            operation="execute_edit_plan",
            parameters={
                "project_name": "MyReel",
                "plan": {"items": []},
                "confirm_token": "USER_APPROVED_TOKEN_123",
            },
        )
        res = self.dispatcher.dispatch(req)
        self.assertFalse(res.success)
        self.assertEqual(res.error["code"], "UNSUPPORTED_OPERATION")
        self.assertEqual(res.error["status"], "unavailable")

    def test_provider_neutrality(self):
        """Proves that requests from different AI clients (Claude, ChatGPT, Gravity) receive identical results."""
        for client in ("claude-3-opus", "chatgpt-gpt4", "gravity-agent", "gemini-pro"):
            req = ContractRequest(
                operation="inspect_project",
                parameters={"project_name": "MyReel", "projects_dir": str(self.projects_dir)},
                client_id=client,
            )
            res = self.dispatcher.dispatch(req)
            self.assertTrue(res.success)
            self.assertEqual(res.data["duration_sec"], 15.0)

    def test_non_mutation_guarantee(self):
        """Verifies that all dispatched read-only operations cause zero file modifications on the source project."""
        content_path = self.project_path / "draft_content.json"
        before_bytes = content_path.read_bytes()

        for op in ("inspect_project", "inspect_timeline", "inspect_media", "inspect_subtitles", "analyze_gaps"):
            req = ContractRequest(
                operation=op,
                parameters={"project_name": "MyReel", "projects_dir": str(self.projects_dir)},
            )
            res = self.dispatcher.dispatch(req)
            self.assertTrue(res.success)

        after_bytes = content_path.read_bytes()
        self.assertEqual(before_bytes, after_bytes)


if __name__ == "__main__":
    unittest.main()
