import { useTranslation } from 'react-i18next';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN', flag: 'gb' },
  { code: 'es', label: 'Español', short: 'ES', flag: 'es' },
  { code: 'pt', label: 'Português', short: 'PT', flag: 'pt' },
  { code: 'fr', label: 'Français', short: 'FR', flag: 'fr' },
  { code: 'de', label: 'Deutsch', short: 'DE', flag: 'de' },
  { code: 'hi', label: 'हिन्दी', short: 'HI', flag: 'in' },
];

export default function LanguageSwitcher({ className = '' }) {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage || 'en';
  const active = LANGUAGES.find(l => l.code === current) || LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors w-full ${className}`}
        >
          <img
            src={`https://flagcdn.com/20x15/${active.flag}.png`}
            alt={active.label}
            className="h-[14px] w-[19px] rounded-[2px] object-cover shrink-0"
          />
          <span className="flex-1 text-left truncate">{active.label}</span>
          <ChevronDown size={14} className="shrink-0 text-slate-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48 bg-slate-800 border-slate-700 text-slate-200">
        <DropdownMenuLabel className="text-slate-400 text-xs font-medium">Language</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-700" />
        {LANGUAGES.map(lang => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`flex items-center gap-2 cursor-pointer text-sm ${
              current === lang.code
                ? 'bg-indigo-600/20 text-white focus:bg-indigo-600/30'
                : 'focus:bg-slate-700/60'
            }`}
          >
            <img
              src={`https://flagcdn.com/20x15/${lang.flag}.png`}
              alt={lang.label}
              className="h-[14px] w-[19px] rounded-[2px] object-cover shrink-0"
            />
            <span className="flex-1">{lang.label}</span>
            <span className="text-xs text-slate-500 font-mono">{lang.short}</span>
            {current === lang.code && <Check size={14} className="text-indigo-400 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}