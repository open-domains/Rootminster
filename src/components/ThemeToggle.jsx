import { IconPalette as Palette, IconSun as Sun, IconMoon as Moon, IconDeviceDesktop as Monitor } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { useAppearance } from '@/lib/ThemeContext';
import { THEMES } from '@/lib/theme';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export default function ThemeToggle({ className, compact = false }) {
  const { style, mode, setStyle, setMode } = useAppearance();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Choose appearance" title="Choose appearance" className={cn(
          'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          compact && 'w-9 px-0', className,
        )}>
          <Palette size={16} aria-hidden="true" />
          {!compact && <span>Appearance</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="appearance-menu w-72 p-2">
        <DropdownMenuLabel>Site theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={style} onValueChange={setStyle} aria-label="Site theme">
          {THEMES.map(theme => (
            <DropdownMenuRadioItem key={theme.id} value={theme.id} className="min-h-16 gap-3 pr-3">
              <span className={`theme-swatch theme-swatch--${theme.id}`} aria-hidden="true">Aa</span>
              <span><span className="block font-medium">{theme.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{theme.description}</span></span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Color mode</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mode} onValueChange={setMode} aria-label="Color mode">
          {[[Sun, 'light', 'Light'], [Moon, 'dark', 'Dark'], [Monitor, 'system', 'System']].map(([Icon, value, label]) => (
            <DropdownMenuRadioItem key={value} value={value} className="min-h-11 gap-2"><Icon size={16} aria-hidden="true" />{label}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <p className="px-2 pb-1 pt-2 text-xs text-muted-foreground">Saved in this browser.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
