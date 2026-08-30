import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'od_theme';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle({ className, compact = false }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        compact && 'w-9 px-0',
        className
      )}
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      {!compact && <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>}
    </button>
  );
}
