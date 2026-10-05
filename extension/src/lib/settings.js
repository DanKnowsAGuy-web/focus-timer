// Settings live in chrome.storage.sync under one key so a single onChanged
// listener covers everything. Stored values are merged over DEFAULTS so new
// toggles get a default without a migration. Falls back to memory when
// chrome.storage is absent (unit tests).

export const DEFAULT_SETTINGS = {
  sites: {
    youtube: {
      enabled: true,
      hideHomeFeed: true,
      hideShorts: true,
      hideRecommendedSidebar: true,
      hideEndScreens: true,
      disableAutoplay: true,
      hideComments: false,
      hideMetrics: true,
      hideSubscriberCounts: true,
      hideNotificationCount: true,
      hideTrendingExplore: true,
      redirectHomeToSubscriptions: true,
    },
  },
};

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

export function deepMerge(base, patch) {
  if (!isObject(patch)) return isObject(base) ? structuredClone(base) : patch;
  const out = isObject(base) ? structuredClone(base) : {};
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isObject(v) && isObject(out[k]) ? deepMerge(out[k], v) : (isObject(v) ? structuredClone(v) : v);
  }
  return out;
}

export function mergeSettings(stored) {
  return deepMerge(DEFAULT_SETTINGS, stored || {});
}

const memory = { settings: undefined };

function area() {
  return globalThis.chrome && globalThis.chrome.storage && globalThis.chrome.storage.sync;
}

export async function getSettings() {
  const a = area();
  if (!a) return mergeSettings(memory.settings);
  const r = await a.get('settings');
  return mergeSettings(r && r.settings);
}

/** Deep-merge a patch into stored settings. Returns the merged result. */
export async function updateSettings(patch) {
  const a = area();
  if (!a) {
    memory.settings = deepMerge(memory.settings || {}, patch);
    return mergeSettings(memory.settings);
  }
  const r = await a.get('settings');
  const next = deepMerge((r && r.settings) || {}, patch);
  await a.set({ settings: next });
  return mergeSettings(next);
}

export function onSettingsChange(cb) {
  const c = globalThis.chrome;
  if (!c || !c.storage || !c.storage.onChanged) return () => {};
  const listener = (changes, areaName) => {
    if (areaName !== 'sync' || !changes.settings) return;
    cb(mergeSettings(changes.settings.newValue));
  };
  c.storage.onChanged.addListener(listener);
  return () => c.storage.onChanged.removeListener(listener);
}
