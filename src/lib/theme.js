export const STYLE_KEY = 'rootminster_style';
export const MODE_KEY = 'od_theme';
export const THEMES = [
  { id: 'classic', name: 'Tabler', description: 'Clean dashboard, controls and forms.' },
  { id: 'fieldwork', name: 'Fieldwork', description: 'Warm paper, forest ink, editorial type.' },
];
export const MODES = ['light', 'dark', 'system'];
export function readAppearance(storage) {
  let style, mode;
  try {
    style = storage.getItem(STYLE_KEY);
    mode = storage.getItem(MODE_KEY);
  } catch { /* Preferences remain usable when browser storage is blocked. */ }
  return {
    style: THEMES.some(theme => theme.id === style) ? style : 'classic',
    mode: MODES.includes(mode) ? mode : 'system',
  };
}
export function applyAppearance({ style, mode }, prefersDark, root) {
  const resolvedMode = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
  root.dataset.theme = style;
  root.classList.toggle('dark', resolvedMode === 'dark');
  root.style.colorScheme = resolvedMode;
  return resolvedMode;
}
export function getBrowserAppearance() {
  try { return readAppearance(window.localStorage); }
  catch { return readAppearance(null); }
}
export function initializeAppearance() {
  applyAppearance(getBrowserAppearance(), window.matchMedia('(prefers-color-scheme: dark)').matches, document.documentElement);
}
