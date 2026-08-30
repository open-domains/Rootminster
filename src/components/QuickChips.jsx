import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/**
 * Quick action chips - small clickable buttons that fill a text field
 * with a canned message. Used by staff as a quick alternative to typing.
 *
 * @param {string} titleKey  i18n key for the section label
 * @param {Array<{labelKey:string, text:string}>} options
 * @param {(text:string)=>void} onSelect
 * @param {string} [tone] 'default' | 'destructive'
 */
export default function QuickChips({ titleKey, options, onSelect, tone = 'default' }) {
  const { t } = useTranslation();
  if (!options?.length) return null;
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">{t(titleKey)}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.labelKey}
            type="button"
            onClick={() => onSelect(opt.text)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
              tone === 'destructive'
                ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
                : 'border-border bg-muted/40 text-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}