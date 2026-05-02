import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

// Shim a minimal browser surface — vitest runs node-env by default; we don't
// want to flip the whole suite to jsdom for one settings module.
beforeAll(() => {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
  (globalThis as { window?: unknown }).window = {
    localStorage,
    dispatchEvent: () => true,
  };
  (globalThis as { localStorage?: unknown }).localStorage = localStorage;
});

// Import AFTER the shim so the module's typeof window check resolves.
const {
  defaultSettings,
  loadSettings,
  saveSettings,
  updateSettings,
  actionForCode,
} = await import('../../src/systems/settings');

const STORAGE_KEY = 'wyrdloom:settings:v1';

describe('settings', () => {
  beforeEach(() => {
    (window as Window).localStorage.removeItem(STORAGE_KEY);
  });

  it('defaults populate every section with sensible values', () => {
    const d = defaultSettings();
    expect(d.video.colorBlind).toBe('none');
    expect(d.video.reduceMotion).toBe(false);
    expect(d.video.fontScale).toBe(1.0);
    expect(d.audio.muteOnBlur).toBe(true);
    expect(d.keybinds['open-inventory']).toBe('KeyI');
  });

  it('round-trips through localStorage', () => {
    const next = { ...defaultSettings(), video: { ...defaultSettings().video, reduceMotion: true } };
    saveSettings(next);
    const loaded = loadSettings();
    expect(loaded.video.reduceMotion).toBe(true);
  });

  it('returns defaults when no payload exists', () => {
    expect(loadSettings()).toEqual(defaultSettings());
  });

  it('merges partial payloads with current defaults', () => {
    // Write only a partial section — load should fill in the rest.
    (window as Window).localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ video: { colorBlind: 'deuteranopia' } }),
    );
    const loaded = loadSettings();
    expect(loaded.video.colorBlind).toBe('deuteranopia');
    expect(loaded.video.fontScale).toBe(1.0); // default fills in
    expect(loaded.audio.muteOnBlur).toBe(true);
  });

  it('falls back to defaults on malformed JSON', () => {
    (window as Window).localStorage.setItem(STORAGE_KEY, '{not valid}');
    expect(loadSettings()).toEqual(defaultSettings());
  });

  it('updateSettings merges patches and persists', () => {
    const next = updateSettings({ video: { colorBlind: 'protanopia', reduceMotion: true, fontScale: 1.2 } });
    expect(next.video.colorBlind).toBe('protanopia');
    expect(next.video.fontScale).toBe(1.2);
    // Subsequent load reflects the patch.
    const loaded = loadSettings();
    expect(loaded.video.colorBlind).toBe('protanopia');
  });

  it('actionForCode resolves a code back to its action id', () => {
    const s = defaultSettings();
    expect(actionForCode(s, 'KeyI')).toBe('open-inventory');
    expect(actionForCode(s, 'Digit3')).toBe('skill-3');
    expect(actionForCode(s, 'NonExistent')).toBeNull();
  });
});
