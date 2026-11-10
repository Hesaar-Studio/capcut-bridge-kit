'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { BridgeServiceManager } = require('../bridge_system/service_manager.cjs');

test('desktop project index delegates to the typed list_projects contract', async () => {
  const contractData = {
    projects: [{ name: 'SampleDraft', modified_at: '2026-10-02T00:00:00Z', read_error: false }],
    count: 1,
    source: 'local-draft-json-index',
  };
  const manager = new BridgeServiceManager({
    appRoot: process.cwd(),
    resourcesPath: process.cwd(),
    isPackaged: false,
    platform: 'linux',
    userDataPath: process.cwd(),
  });
  let call;
  manager.mcpClient = {
    async callTool(name, args) {
      call = { name, args };
      return {
        data: {
          operation: 'list_projects',
          success: true,
          data: contractData,
        },
      };
    },
  };

  const result = await manager.listProjects();
  assert.deepEqual(call, { name: 'bridge_contract_list_projects', args: {} });
  assert.deepEqual(result, contractData);
});

test('desktop manager exposes the static CapCut surface map through the read-only contract allowlist', async () => {
  const surfaceData = { surface_count: 10, runtime_probes_performed: false, surfaces: [] };
  const manager = new BridgeServiceManager({
    appRoot: process.cwd(),
    resourcesPath: process.cwd(),
    isPackaged: false,
    platform: 'linux',
    userDataPath: process.cwd(),
  });
  let call;
  manager.mcpClient = {
    async callTool(name, args) {
      call = { name, args };
      return {
        data: {
          operation: 'get_capcut_surface_map',
          success: true,
          data: surfaceData,
        },
      };
    },
  };

  const result = await manager.callContract('get_capcut_surface_map');
  assert.deepEqual(call, { name: 'bridge_contract_get_capcut_surface_map', args: {} });
  assert.deepEqual(result, {
    operation: 'get_capcut_surface_map',
    success: true,
    data: surfaceData,
  });
});
