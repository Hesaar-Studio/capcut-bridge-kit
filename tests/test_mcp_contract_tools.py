import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from draft_engine.writer import write_raw_draft_json_atomic
import bridge_system.bridge_server as bridge_server


class McpContractToolTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.projects_dir = Path(self.temp_dir.name)
        self.project_name = "McpPlanFixture"
        self.content = {
            "id": "MCP_PLAN_FIXTURE",
            "duration": 8_000_000,
            "materials": {
                "videos": [],
                "audios": [],
                "texts": [
                    {"id": "text_a", "type": "text", "content": "First line"},
                    {"id": "text_b", "type": "text", "content": "Second line"},
                ],
            },
            "tracks": [{
                "id": "track_text",
                "type": "text",
                "segments": [
                    {"id": "seg_a", "material_id": "text_a", "target_timerange": {"start": 0, "duration": 2_000_000}, "source_timerange": {"start": 0, "duration": 2_000_000}},
                    {"id": "seg_b", "material_id": "text_b", "target_timerange": {"start": 5_000_000, "duration": 2_000_000}, "source_timerange": {"start": 0, "duration": 2_000_000}},
                ],
            }],
        }
        result = write_raw_draft_json_atomic(self.projects_dir, self.project_name, self.content)
        self.project_path = Path(result["target_dir"])
        self.draft_file = self.project_path / "draft_content.json"
        self.original_bytes = self.draft_file.read_bytes()

    def tearDown(self):
        self.temp_dir.cleanup()

    def call_mcp(self, requests):
        input_stream = io.StringIO("\n".join(json.dumps(item) for item in requests) + "\n")
        output_stream = io.StringIO()
        error_stream = io.StringIO()
        with patch.object(bridge_server.sys, "stdin", input_stream), \
             patch.object(bridge_server.sys, "stdout", output_stream), \
             patch.object(bridge_server.sys, "stderr", error_stream), \
             patch("ai_contract.dispatcher.get_capcut_projects_dir", return_value=self.projects_dir):
            bridge_server.run_mcp_stdio()
        return [json.loads(line) for line in output_stream.getvalue().splitlines() if line.strip()]

    def test_tools_list_exposes_contract_and_marks_execution_unavailable(self):
        responses = self.call_mcp([
            {"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "bridge_contract_get_capabilities", "arguments": {}}},
            {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "bridge_contract_get_capcut_surface_map", "arguments": {}}},
        ])
        tools = responses[0]["result"]["tools"]
        names = {tool["name"] for tool in tools}
        self.assertIn("bridge_contract_get_capcut_surface_map", names)
        self.assertIn("bridge_contract_list_projects", names)
        self.assertIn("bridge_contract_create_edit_plan", names)
        self.assertIn("bridge_contract_preview_edit_plan", names)
        self.assertIn("bridge_contract_execute_edit_plan", names)
        execute_description = next(tool["description"] for tool in tools if tool["name"] == "bridge_contract_execute_edit_plan")
        self.assertIn("UNAVAILABLE", execute_description)
        capability_text = responses[1]["result"]["content"][0]["text"]
        capability_payload = json.loads(capability_text)
        self.assertTrue(capability_payload["success"])
        self.assertTrue(any(tool["name"] == "execute_edit_plan" and tool["status"] == "unavailable" for tool in capability_payload["data"]["tools"]))
        surface_payload = json.loads(responses[2]["result"]["content"][0]["text"])
        self.assertTrue(surface_payload["success"])
        self.assertEqual(surface_payload["operation"], "get_capcut_surface_map")
        self.assertEqual(surface_payload["data"]["surface_count"], 10)
        self.assertFalse(surface_payload["data"]["runtime_probes_performed"])
        self.assertEqual(self.draft_file.read_bytes(), self.original_bytes)

    def test_legacy_project_list_delegates_to_contract_and_keeps_response_shape(self):
        responses = self.call_mcp([
            {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_capcut_projects", "arguments": {}}},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "bridge_contract_list_projects", "arguments": {}}},
        ])
        legacy = json.loads(responses[0]["result"]["content"][0]["text"])
        contract = json.loads(responses[1]["result"]["content"][0]["text"])
        self.assertEqual(set(legacy), {"projects", "count"})
        self.assertEqual(legacy["projects"], [self.project_name])
        self.assertEqual(legacy["count"], 1)
        self.assertTrue(contract["success"])
        self.assertEqual(contract["operation"], "list_projects")
        self.assertEqual(contract["data"]["projects"][0]["name"], self.project_name)
        self.assertNotIn("path", contract["data"]["projects"][0])

    def test_create_plan_preview_and_disabled_execution_do_not_mutate(self):
        responses = self.call_mcp([
            {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "bridge_contract_create_edit_plan", "arguments": {"project_name": self.project_name}}},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "bridge_contract_preview_edit_plan", "arguments": {"project_name": self.project_name}}},
            {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "bridge_contract_execute_edit_plan", "arguments": {"project_name": self.project_name, "confirm_token": "explicit", "plan": {"items": []}}}},
        ])
        plan = json.loads(responses[0]["result"]["content"][0]["text"])
        preview = json.loads(responses[1]["result"]["content"][0]["text"])
        self.assertTrue(plan["success"])
        self.assertEqual(plan["data"]["project_name"], self.project_name)
        self.assertTrue(preview["success"])
        self.assertTrue(preview["data"]["is_dry_run"])
        self.assertTrue(responses[2]["result"]["isError"])
        unavailable = json.loads(responses[2]["result"]["content"][0]["text"])
        self.assertFalse(unavailable["success"])
        self.assertEqual(unavailable["error"]["code"], "UNSUPPORTED_OPERATION")
        self.assertEqual(self.draft_file.read_bytes(), self.original_bytes)

    def test_mcp_contract_rejects_custom_filesystem_root(self):
        responses = self.call_mcp([
            {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "bridge_contract_inspect_project", "arguments": {"project_name": self.project_name, "projects_dir": str(self.projects_dir)}}},
        ])
        self.assertTrue(responses[0]["result"]["isError"])
        self.assertIn("current account's CapCut projects directory only", responses[0]["result"]["content"][0]["text"])


if __name__ == "__main__":
    unittest.main()
