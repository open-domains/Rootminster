import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { openCookieSettings } from '@/lib/cookie-consent';
import { usePublicConfig } from '@/lib/public-config';
import { cn } from '@/lib/utils';

const DISCORD_URL = 'https://discord.gg/rRjgTNxhx9';

export function CookieSettingsButton({ className, showIcon = true }) {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={openCookieSettings} className={cn('inline-flex items-center gap-1.5 transition-colors hover:text-foreground', className)}>
      {showIcon && <Cookie size={13} aria-hidden="true" />}
      {t('footer.cookieSettings')}
    </button>
  );
}

export default function SiteFooter({ className, containerClassName, showBrand = true }) {
  const { config } = usePublicConfig();
  const branding = config.branding;
  const { t } = useTranslation();
  const links = [
    { to: '/about', label: t('nav.about') },
    { to: '/guides', label: t('nav.guides') },
    { to: '/api-docs', label: t('footer.apiDocs') },
    { to: '/contact', label: t('footer.contact') },
    { to: '/report-abuse', label: t('footer.reportAbuse') },
    { to: '/privacy-policy', label: t('footer.privacy') },
    { to: '/terms-of-service', label: t('footer.terms') },
    { to: '/cookie-policy', label: t('footer.cookiePolicy') },
  ];

  return (
    <footer className={cn('border-t border-border bg-background', className)}>
      <div className={cn('mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 text-xs text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8', containerClassName)}>
        {showBrand ? (
          <div className="flex items-center gap-2">
            <img src={branding.logo_url} alt="" className="h-6 w-6 rounded bg-white p-0.5 ring-1 ring-border" />
            <span className="font-medium text-foreground">{branding.short_name}</span>
            <span aria-hidden="true">·</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
        ) : (
          <span>© {new Date().getFullYear()} {branding.short_name}</span>
        )}
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {links.map(link => <Link key={link.to} to={link.to} className="transition-colors hover:text-foreground">{link.label}</Link>)}
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">{t('nav.discord')}</a>
          <CookieSettingsButton />
        </nav>
      </div>
    </footer>
  );
}
