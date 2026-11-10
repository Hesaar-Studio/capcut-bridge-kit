'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function isValidGeminiKey(value) {
  return typeof value === 'string'
    && value.trim().length >= 20
    && value.trim().length <= 512
    && !/[\r\n\0]/.test(value);
}

function normalizeExternalUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const parsed = new URL(value);
    if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

const hsTechApi = Object.freeze({
  getGeminiKeyStatus: () => ipcRenderer.invoke('hs-tech:key-status'),
  saveGeminiApiKey: (key) => {
    if (!isValidGeminiKey(key)) {
      return Promise.resolve({ saved: false, error: 'Enter a valid Gemini API key (20–512 characters).' });
    }
    return ipcRenderer.invoke('hs-tech:key-save', key.trim());
  },
  clearGeminiApiKey: () => ipcRenderer.invoke('hs-tech:key-clear'),
  selectMedia: () => ipcRenderer.invoke('hs-tech:select-media'),
  getMcpConfig: () => ipcRenderer.invoke('hs-tech:mcp-config'),
  openLogs: () => ipcRenderer.invoke('hs-tech:open-logs'),
  openExternal: (value) => {
    const url = normalizeExternalUrl(value);
    if (!url) return Promise.resolve({ opened: false, error: 'Unsupported or invalid external URL.' });
    return ipcRenderer.invoke('hs-tech:open-external', url);
  },
});

contextBridge.exposeInMainWorld('hsTech', hsTechApi);
