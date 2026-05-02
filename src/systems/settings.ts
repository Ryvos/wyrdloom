// Settings — global, slot-independent player preferences. Lives in
// `window.localStorage` per spec line 235 (settings → localStorage; full
// state → IndexedDB / Tauri FS). Surviving a save delete is the point.
//
// SETTINGS_CHANGED_EVENT fires after every successful saveSettings(); main.ts
// + each Lit panel listens and re-applies runtime side effects (color-blind
// filter, reduce-motion gates, font-scale CSS variable).
//
// Storage key is versioned so a future shape break can branch via a sibling
// key rather than a migration walk like SaveAdapter does. Settings are
// non-critical; if parse fails we fall back to defaults.

const STORAGE_KEY = 'wyrdloom:settings:v1';

export const COLOR_BLIND_PRESETS = ['none', 'deuteranopia', 'protanopia', 'tritanopia'] as const;
export type ColorBlindPreset = (typeof COLOR_BLIND_PRESETS)[number];

// Action ids that map to keys in src/main.ts's keyboard handler. The Settings
// panel renders a row per id; rebind writes a new KeyboardEvent.code into the
// keybinds map and main.ts reads from it on every keydown.
export const REMAPPABLE_ACTIONS = [
  'open-inventory',
  'open-character',
  'open-bind',
  'open-imbuer',
  'open-echo-portal',
  'open-settings',
  'manual-save',
  'skill-1',
  'skill-2',
  'skill-3',
  'skill-4',
] as const;
export type ActionId = (typeof REMAPPABLE_ACTIONS)[number];

export interface SettingsState {
  readonly video: {
    readonly colorBlind: ColorBlindPreset;
    readonly reduceMotion: boolean;
    readonly fontScale: number; // 0.8..1.5
  };
  readonly audio: {
    readonly masterVolume: number; // 0..1
    readonly sfxVolume: number;    // 0..1
    readonly musicVolume: number;  // 0..1
    readonly muteOnBlur: boolean;
  };
  readonly gameplay: {
    readonly holdToCast: boolean;
    readonly alwaysSubtitles: boolean;
  };
  readonly keybinds: Readonly<Record<ActionId, string>>; // KeyboardEvent.code
}

export function defaultSettings(): SettingsState {
  return {
    video: {
      colorBlind: 'none',
      reduceMotion: false,
      fontScale: 1.0,
    },
    audio: {
      masterVolume: 1.0,
      sfxVolume: 1.0,
      musicVolume: 0.7,
      muteOnBlur: true,
    },
    gameplay: {
      holdToCast: false,
      alwaysSubtitles: false,
    },
    keybinds: {
      'open-inventory': 'KeyI',
      'open-character': 'KeyC',
      'open-bind': 'KeyB',
      'open-imbuer': 'KeyM',
      'open-echo-portal': 'KeyE',
      'open-settings': 'KeyO',
      'manual-save': 'KeyS',
      'skill-1': 'Digit1',
      'skill-2': 'Digit2',
      'skill-3': 'Digit3',
      'skill-4': 'Digit4',
    },
  };
}

export const SETTINGS_CHANGED_EVENT = 'wyrdloom:settings-changed';

export function loadSettings(): SettingsState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return defaultSettings();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    // Shallow-merge with defaults so a partial-or-malformed payload doesn't
    // strip newly-added fields. Each section is its own merge to allow
    // adding a new gameplay toggle in v0.11.x without bumping the storage key.
    const d = defaultSettings();
    return {
      video: { ...d.video, ...(parsed.video ?? {}) },
      audio: { ...d.audio, ...(parsed.audio ?? {}) },
      gameplay: { ...d.gameplay, ...(parsed.gameplay ?? {}) },
      keybinds: { ...d.keybinds, ...(parsed.keybinds ?? {}) },
    };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(s: SettingsState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: s }));
  } catch (err) {
    console.warn('saveSettings failed:', err);
  }
}

// Convenience for inline mutations from the settings panel.
export function updateSettings(patch: Partial<SettingsState>): SettingsState {
  const cur = loadSettings();
  const next: SettingsState = {
    video: { ...cur.video, ...(patch.video ?? {}) },
    audio: { ...cur.audio, ...(patch.audio ?? {}) },
    gameplay: { ...cur.gameplay, ...(patch.gameplay ?? {}) },
    keybinds: { ...cur.keybinds, ...(patch.keybinds ?? {}) },
  };
  saveSettings(next);
  return next;
}

// Map a KeyboardEvent.code to the action it triggers (or null). Used by
// main.ts's keyboard handler to honor remapped binds.
export function actionForCode(s: SettingsState, code: string): ActionId | null {
  for (const a of REMAPPABLE_ACTIONS) {
    if (s.keybinds[a] === code) return a;
  }
  return null;
}
