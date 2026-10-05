// Service worker. Phase 2 needs it only so tests and pages can reach
// chrome.storage; later phases add alarms for RSS and the jar.
chrome.runtime.onInstalled.addListener(() => {
  // Nothing to migrate yet. Defaults are applied at read time by lib/settings.js.
});
