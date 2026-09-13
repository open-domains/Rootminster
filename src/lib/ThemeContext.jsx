import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';
import { applyAppearance, getBrowserAppearance, MODE_KEY, MODES, STYLE_KEY, THEMES } from './theme';

const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
  const [appearance, setAppearance] = useState(getBrowserAppearance);
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const resolvedMode = appearance.mode === 'system' ? (prefersDark ? 'dark' : 'light') : appearance.mode;
  useLayoutEffect(() => {
    applyAppearance(appearance, prefersDark, document.documentElement);
  }, [appearance, prefersDark]);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = event => setPrefersDark(event.matches);
    const onStorage = event => {
      if (!event.key || [STYLE_KEY, MODE_KEY].includes(event.key)) setAppearance(getBrowserAppearance());
    };
    query.addEventListener('change', onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      query.removeEventListener('change', onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  function update(key, value) {
    if (key === 'style' ? !THEMES.some(theme => theme.id === value) : !MODES.includes(value)) return;
    setAppearance(current => ({ ...current, [key]: value }));
    try { window.localStorage.setItem(key === 'style' ? STYLE_KEY : MODE_KEY, value); }
    catch { /* Keep the in-memory preference for this visit. */ }
  }
  return <ThemeContext.Provider value={{ ...appearance, resolvedMode, setStyle: value => update('style', value), setMode: value => update('mode', value) }}>{children}</ThemeContext.Provider>;
}
export function useAppearance() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppearance requires ThemeProvider');
  return context;
}
