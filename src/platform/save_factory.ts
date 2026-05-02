// Picks the right SaveAdapter for the current runtime. In Tauri the
// `__TAURI_INTERNALS__` global exists; otherwise we're in a browser tab.

import type { SaveAdapter } from './SaveAdapter';
import { WebSaveAdapter } from './WebSaveAdapter';
import { TauriSaveAdapter } from './TauriSaveAdapter';

export function makeSaveAdapter(): SaveAdapter {
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
  if (typeof window !== 'undefined' && w.__TAURI_INTERNALS__) {
    return new TauriSaveAdapter();
  }
  return new WebSaveAdapter();
}
