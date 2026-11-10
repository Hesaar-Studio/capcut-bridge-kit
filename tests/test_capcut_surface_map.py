import unittest
from unittest.mock import patch

from ai_contract.capabilities import CapabilityStatus
from ai_contract.dispatcher import ContractDispatcher
from ai_contract.schemas import ContractRequest, validate_contract_request
from ai_contract.surface_map import (
    CapCutSurfaceStatus,
    get_capcut_surface_map,
    surface_status_values,
)


EXPECTED_SURFACE_IDS = {
    "official_api_plugin",
    "local_ipc",
    "extension_plugin_surfaces",
    "accessibility_ui_automation",
    "local_services",
    "project_draft_format",
    "file_based_timeline_manipulation",
    "local_communication_protocols",
    "public_open_source_implementations",
    "black_box_behavior_analysis",
}


class CapCutSurfaceMapTests(unittest.TestCase):
    def test_map_has_exact_ten_pathways_and_allowed_independent_statuses(self):
        data = get_capcut_surface_map()
        surfaces = data["surfaces"]

        self.assertEqual(data["surface_count"], 10)
        self.assertEqual(len(surfaces), 10)
        self.assertEqual({surface["id"] for surface in surfaces}, EXPECTED_SURFACE_IDS)
        self.assertEqual(len({surface["id"] for surface in surfaces}), 10)
        self.assertEqual(
            {surface["status"] for surface in surfaces} | set(data["status_legend"]),
            set(surface_status_values()),
        )
        self.assertEqual(
            set(data["status_legend"]),
            {status.value for status in CapCutSurfaceStatus},
        )
        self.assertFalse(issubclass(CapCutSurfaceStatus, CapabilityStatus))

        for surface in surfaces:
            self.assertIn(surface["status"], surface_status_values())
            self.assertIn("evidence", surface)
            self.assertIn("safe_next_probe", surface)
            self.assertFalse(surface["runtime_verified"])

    def test_map_is_read_only_and_does_not_claim_a_runtime_probe(self):
        data = get_capcut_surface_map()
        self.assertTrue(data["read_only"])
        self.assertFalse(data["runtime_probes_performed"])
        guidance = " ".join(data["agent_guidance"])
        self.assertIn("do not automatically execute", guidance)
        self.assertIn("apply subtitles", guidance)
        self.assertIn("same integrity level", guidance)
        self.assertIn("bypass UIPI", guidance)

    def test_official_route_keeps_regional_scope_separate(self):
        official = next(
            surface for surface in get_capcut_surface_map()["surfaces"]
            if surface["id"] == "official_api_plugin"
        )
        self.assertEqual(official["status"], CapCutSurfaceStatus.SUPPORTED.value)
        regional = {item["scope"]: item["status"] for item in official["regional_availability"]}
        self.assertEqual(regional["U.S. network egress, per the published official runbook"], CapCutSurfaceStatus.UNAVAILABLE.value)
        self.assertEqual(regional["Outside-U.S. regions, per the product page"], CapCutSurfaceStatus.SUPPORTED.value)

        protocols = next(
            surface for surface in get_capcut_surface_map()["surfaces"]
            if surface["id"] == "local_communication_protocols"
        )
        self.assertEqual(protocols["status"], CapCutSurfaceStatus.UNVERIFIED.value)

    def test_map_returns_fresh_nested_data(self):
        first = get_capcut_surface_map()
        second = get_capcut_surface_map()
        first["surfaces"][0]["limitations"].append("test mutation")
        first["surfaces"][0]["evidence"][0]["label"] = "changed"
        first["status_legend"]["FOUND"] = "changed"
        self.assertNotIn("test mutation", second["surfaces"][0]["limitations"])
        self.assertNotEqual(first["surfaces"][0]["evidence"][0]["label"], second["surfaces"][0]["evidence"][0]["label"])
        self.assertNotEqual(first["status_legend"]["FOUND"], second["status_legend"]["FOUND"])

    def test_contract_schema_accepts_no_argument_map_operation(self):
        request = ContractRequest(operation="get_capcut_surface_map")
        is_valid, error = validate_contract_request(request)
        self.assertTrue(is_valid, error)

    def test_dispatcher_returns_map_without_filesystem_or_process_probe(self):
        dispatcher = ContractDispatcher()
        with patch("ai_contract.dispatcher.get_capcut_projects_dir", side_effect=AssertionError("filesystem probe")), \
             patch("ai_contract.dispatcher.get_capcut_surface_map", wraps=get_capcut_surface_map) as map_fn:
            response = dispatcher.dispatch(ContractRequest(operation="get_capcut_surface_map"))

        self.assertTrue(response.success)
        self.assertEqual(response.operation, "get_capcut_surface_map")
        self.assertEqual(response.data["surface_count"], 10)
        map_fn.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
